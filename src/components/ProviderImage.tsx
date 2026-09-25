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
  const isMounted = useRef(true);

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
      setSourceUri(fallbackUri);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const cached = getCachedProviderPoster(providerValue, link);
    if (cached?.value.poster) {
      setSourceUri(cached.value.poster);
    } else if (cached) {
      setSourceUri(fallbackUri);
    } else {
      setSourceUri(PLACEHOLDER_IMAGE);
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
          setSourceUri(poster || fallbackUri);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSourceUri(fallbackUri);
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
    uri,
  ]);

  const resolveFallback = useCallback(async () => {
    if (hasTriedFallback) {
      return;
    }
    setHasTriedFallback(true);

    if (providerValue !== ANIMEUNITY_PROVIDER || !link) {
      if (isMounted.current) {
        setSourceUri(PLACEHOLDER_IMAGE);
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
          setSourceUri(image);
        }
        return;
      }
    } catch (error) {
      console.warn('Fallback image lookup failed:', error);
    }

    if (isMounted.current) {
      setSourceUri(PLACEHOLDER_IMAGE);
    }
  }, [artworkHints, hasTriedFallback, link, providerCacheScope, providerValue]);

  const handleError: ImageProps['onError'] = useCallback(
    (event: Parameters<NonNullable<ImageProps['onError']>>[0]) => {
      if (onError) {
        onError(event);
      }
      resolveFallback();
    },
    [onError, resolveFallback],
  );

  return <Image {...rest} source={{uri: sourceUri}} onError={handleError} />;
};

export default ProviderImage;
