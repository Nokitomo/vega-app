import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Image, ImageProps} from 'react-native';
import {getProviderCacheScope} from '../lib/utils/providerCacheScope';
import {
  getCachedProviderPoster,
  resolveProviderPoster,
} from '../lib/services/ProviderArtwork';
import type {Post} from '../lib/providers/types';
import {getMetadataSourceProvider} from '../lib/services/streamCenterMetadata';
import {resolveLegacyAnimeUnityImageUrl} from '../lib/utils/providerLinks';
import {
  isPerfTraceEnabled,
  observePerfDuration,
  perfNow,
} from '../lib/utils/perfTrace';

const PLACEHOLDER_IMAGE =
  'https://placehold.jp/24/363636/ffffff/500x500.png?text=Vega';
const ANIMEUNITY_PROVIDER = 'animeunity';

const usesAnimeUnityPoster = (providerValue?: string, link?: string): boolean =>
  !!providerValue &&
  !!link &&
  getMetadataSourceProvider(providerValue, link) === ANIMEUNITY_PROVIDER;

const getInitialSourceUri = (
  uri?: string,
  link?: string,
  providerValue?: string,
): string => {
  const fallbackUri = uri || PLACEHOLDER_IMAGE;
  if (!providerValue || !link || !usesAnimeUnityPoster(providerValue, link)) {
    return fallbackUri;
  }
  const cached = getCachedProviderPoster(providerValue, link);
  return cached ? cached.value.poster || fallbackUri : PLACEHOLDER_IMAGE;
};

type ProviderImageProps = Omit<ImageProps, 'source'> & {
  uri?: string;
  link?: string;
  providerValue?: string;
  artworkHints?: Post['artworkHints'];
  shouldResolveArtwork?: boolean;
};

const ProviderImage = ({
  uri,
  link,
  providerValue,
  artworkHints,
  shouldResolveArtwork = true,
  onError,
  onLoad,
  onLoadStart,
  ...rest
}: ProviderImageProps): React.JSX.Element => {
  const providerCacheScope = getProviderCacheScope(providerValue || '');
  const sourceIdentity = JSON.stringify([
    providerCacheScope,
    providerValue,
    link,
    uri,
  ]);
  const initialSourceUri = useMemo(
    () => getInitialSourceUri(uri, link, providerValue),
    [sourceIdentity],
  );
  const [source, setSource] = useState(() => ({
    identity: sourceIdentity,
    uri: initialSourceUri,
  }));
  const sourceUri =
    source.identity === sourceIdentity ? source.uri : initialSourceUri;
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  const [errorRetryKey, setErrorRetryKey] = useState(0);
  const isMounted = useRef(true);
  const imageLoadStartedAt = useRef(0);

  const updateSourceUri = useCallback(
    (nextUri: string) => {
      setSource(previous =>
        previous.identity === sourceIdentity && previous.uri === nextUri
          ? previous
          : {identity: sourceIdentity, uri: nextUri},
      );
    },
    [sourceIdentity],
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const fallbackUri = uri || PLACEHOLDER_IMAGE;
    setHasTriedFallback(false);
    updateSourceUri(getInitialSourceUri(uri, link, providerValue));
    if (!providerValue || !link || !usesAnimeUnityPoster(providerValue, link)) {
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    if (!shouldResolveArtwork) {
      return () => controller.abort();
    }
    resolveProviderPoster({
      providerValue,
      link,
      hints: artworkHints,
      signal: controller.signal,
    })
      .then(poster => {
        if (!cancelled) {
          updateSourceUri(poster || fallbackUri);
        }
      })
      .catch(() => {
        if (!cancelled) {
          updateSourceUri(fallbackUri);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    artworkHints?.anilistId,
    artworkHints?.isMovie,
    artworkHints?.malId,
    link,
    providerCacheScope,
    providerValue,
    shouldResolveArtwork,
    updateSourceUri,
    uri,
  ]);

  const resolveFallback = useCallback(async () => {
    if (hasTriedFallback) {
      return;
    }
    setHasTriedFallback(true);

    if (!providerValue || !link || !usesAnimeUnityPoster(providerValue, link)) {
      if (isMounted.current) {
        updateSourceUri(PLACEHOLDER_IMAGE);
      }
      return;
    }

    try {
      const image = await resolveProviderPoster({
        link,
        providerValue,
        hints: artworkHints,
        forceRefresh: true,
      });
      if (image) {
        if (isMounted.current) {
          if (image === sourceUri) {
            setErrorRetryKey(value => value + 1);
          } else {
            updateSourceUri(image);
          }
        }
        return;
      }
    } catch (error) {
      console.warn('Fallback image lookup failed:', error);
    }

    if (isMounted.current) {
      updateSourceUri(PLACEHOLDER_IMAGE);
    }
  }, [
    artworkHints,
    hasTriedFallback,
    link,
    providerCacheScope,
    providerValue,
    sourceUri,
    updateSourceUri,
  ]);

  const handleError: ImageProps['onError'] = useCallback(
    (event: Parameters<NonNullable<ImageProps['onError']>>[0]) => {
      if (isPerfTraceEnabled && imageLoadStartedAt.current) {
        observePerfDuration('poster_image_error', {provider: providerValue}, perfNow() - imageLoadStartedAt.current);
      }
      if (onError) {
        onError(event);
      }
      resolveFallback();
    },
    [onError, providerValue, resolveFallback],
  );

  const handleLoadStart: ImageProps['onLoadStart'] = useCallback(() => {
    if (isPerfTraceEnabled) {imageLoadStartedAt.current = perfNow();}
    onLoadStart?.();
  }, [onLoadStart]);

  const handleLoad: ImageProps['onLoad'] = useCallback((event: Parameters<NonNullable<ImageProps['onLoad']>>[0]) => {
    if (isPerfTraceEnabled && imageLoadStartedAt.current) {
      observePerfDuration('poster_image_load', {provider: providerValue}, perfNow() - imageLoadStartedAt.current);
    }
    onLoad?.(event);
  }, [onLoad, providerValue]);

  return (
    <Image
      key={errorRetryKey}
      {...rest}
      source={{uri: resolveLegacyAnimeUnityImageUrl(sourceUri)}}
      onError={handleError}
      onLoadStart={handleLoadStart}
      onLoad={handleLoad}
    />
  );
};

export default ProviderImage;
