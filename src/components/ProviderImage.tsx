import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Image, ImageProps} from 'react-native';
import {getProviderCacheScope} from '../lib/utils/providerCacheScope';
import {
  getCachedProviderPoster,
  resolveProviderPoster,
} from '../lib/services/ProviderArtwork';
import type {Post} from '../lib/providers/types';

const PLACEHOLDER_IMAGE =
  'https://placehold.jp/24/363636/ffffff/500x500.png?text=Vega';
const ANIMEUNITY_PROVIDER = 'animeunity';

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
  ...rest
}: ProviderImageProps): React.JSX.Element => {
  const providerCacheScope = getProviderCacheScope(providerValue || '');
  const [sourceUri, setSourceUri] = useState(uri || PLACEHOLDER_IMAGE);
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  const [imageReloadKey, setImageReloadKey] = useState(0);
  const isMounted = useRef(true);

  const updateSourceUri = useCallback((nextUri: string) => {
    setSourceUri(nextUri);
    setImageReloadKey(value => value + 1);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const fallbackUri = uri || PLACEHOLDER_IMAGE;
    setHasTriedFallback(false);
    if (providerValue !== ANIMEUNITY_PROVIDER || !link) {
      updateSourceUri(fallbackUri);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const cached = getCachedProviderPoster(providerValue, link);
    if (cached?.value.poster) {
      updateSourceUri(cached.value.poster);
    } else if (cached) {
      updateSourceUri(fallbackUri);
    } else {
      updateSourceUri(PLACEHOLDER_IMAGE);
    }
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

    if (providerValue !== ANIMEUNITY_PROVIDER || !link) {
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
          updateSourceUri(image);
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
    updateSourceUri,
  ]);

  const handleError: ImageProps['onError'] = useCallback(
    (event: Parameters<NonNullable<ImageProps['onError']>>[0]) => {
      if (onError) {
        onError(event);
      }
      resolveFallback();
    },
    [onError, resolveFallback],
  );

  return (
    <Image
      key={`${link || ''}:${sourceUri}:${imageReloadKey}`}
      {...rest}
      source={{uri: sourceUri}}
      onError={handleError}
    />
  );
};

export default ProviderImage;
