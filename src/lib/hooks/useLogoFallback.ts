import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {providerManager} from '../services/ProviderManager';
import {streamCenterMetaOrigin} from '../services/streamCenterMetadata';
import {
  orderedLogoUrls,
  validLogoUrl,
  type WorkingLogo,
} from '../services/logoFallbackPolicy';
import {
  readMetadata,
  removeMetadata,
  writeMetadata,
} from '../storage/MetadataDatabase';

const MAX_RECOVERY_REQUESTS = 3;
const RECOVERY_PROVIDERS = new Set([
  'animeunity',
  'streamingunity',
  'streamcenter',
]);

/** Advance through known logos and request a new source only after failure. */
export const useLogoFallback = ({
  providerValue,
  link,
  candidates,
  onExhausted,
}: {
  providerValue: string;
  link: string;
  candidates: string[];
  onExhausted?: () => void;
}) => {
  const source =
    providerValue === 'streamcenter' ? streamCenterMetaOrigin(link) : undefined;
  const storageProvider = source?.source || providerValue;
  const storageLink = source?.data.url || link;
  const candidateKey = candidates.join('\u0000');
  const saved = useMemo(
    () =>
      storageLink
        ? readMetadata<WorkingLogo>('workingLogo', storageProvider, storageLink)
        : undefined,
    [storageProvider, storageLink],
  );
  const baseUrls = useMemo(
    () => orderedLogoUrls(candidates, saved, Date.now()),
    [candidates, saved],
  );
  const [extraUrls, setExtraUrls] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const failedUrlsRef = useRef(new Set<string>());
  const requestsRef = useRef(0);
  const pendingRef = useRef(false);
  const [isResolving, setIsResolving] = useState(false);
  const fullRepairRequestedRef = useRef(false);
  const requestScope = `${providerValue}\u0000${link}\u0000${candidateKey}`;
  const requestScopeRef = useRef(requestScope);
  requestScopeRef.current = requestScope;
  const urls = useMemo(
    () => Array.from(new Set([...baseUrls, ...extraUrls])),
    [baseUrls, extraUrls],
  );
  const uri = urls[index] || '';

  useEffect(() => {
    setExtraUrls([]);
    setIndex(0);
    failedUrlsRef.current = new Set();
    requestsRef.current = 0;
    pendingRef.current = false;
    setIsResolving(false);
    fullRepairRequestedRef.current = false;
  }, [providerValue, link, candidateKey]);

  const onError = useCallback(() => {
    if (!uri) {
      return;
    }
    failedUrlsRef.current.add(uri);
    if (index + 1 < urls.length) {
      setIndex(index + 1);
      return;
    }
    setIndex(urls.length);
    if (storageProvider === 'streamingunity') {
      if (!fullRepairRequestedRef.current) {
        fullRepairRequestedRef.current = true;
        onExhausted?.();
      }
      return;
    }
    if (
      !RECOVERY_PROVIDERS.has(providerValue) ||
      pendingRef.current ||
      requestsRef.current >= MAX_RECOVERY_REQUESTS
    ) {
      return;
    }
    pendingRef.current = true;
    setIsResolving(true);
    requestsRef.current += 1;
    const failedUrls = Array.from(failedUrlsRef.current);
    const scope = requestScope;
    providerManager
      .getArtwork({
        link,
        provider: providerValue,
        fields: ['logo'],
        failedUrls,
      })
      .then(artwork => {
        if (requestScopeRef.current !== scope) {
          return;
        }
        const next = artwork?.logo?.trim();
        if (!validLogoUrl(next) || failedUrlsRef.current.has(next)) {
          return;
        }
        setExtraUrls(previous =>
          previous.includes(next) ? previous : [...previous, next],
        );
        setIndex(urls.length);
      })
      .catch(error => console.warn('Logo recovery failed:', error))
      .finally(() => {
        if (requestScopeRef.current === scope) {
          pendingRef.current = false;
          setIsResolving(false);
        }
      });
  }, [
    index,
    link,
    onExhausted,
    providerValue,
    requestScope,
    storageProvider,
    uri,
    urls.length,
  ]);

  const onLoad = useCallback(() => {
    if (!uri || !storageLink) {
      return;
    }
    const preferredUrl = candidates[0]?.trim() || '';
    if (uri === preferredUrl) {
      if (saved) {
        removeMetadata('workingLogo', storageProvider, storageLink);
      }
      return;
    }
    if (
      preferredUrl &&
      (saved?.value.url !== uri || saved.value.preferredUrl !== preferredUrl)
    ) {
      writeMetadata<WorkingLogo>('workingLogo', storageProvider, storageLink, {
        url: uri,
        preferredUrl,
      });
    }
  }, [candidates, saved, storageLink, storageProvider, uri]);

  return {uri, onError, onLoad, isResolving};
};
