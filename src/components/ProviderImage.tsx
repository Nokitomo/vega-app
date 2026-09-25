import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Image, ImageProps} from 'react-native';
import {getProviderCacheScope} from '../lib/utils/providerCacheScope';
import {
  getCachedProviderPoster,
  resolveProviderPoster,
} from '../lib/services/ProviderArtwork';

const PLACEHOLDER_IMAGE =
  'https://placehold.jp/24/363636/ffffff/500x500.png?text=Vega';
const ANIMEUNITY_PROVIDER = 'animeunity';

type ProviderImageProps = Omit<ImageProps, 'source'> & {
  uri?: string;
  link?: string;
  providerValue?: string;
};

const ProviderImage = ({
  uri,
  link,
  providerValue,
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
    setSourceUri(uri || PLACEHOLDER_IMAGE);
    setHasTriedFallback(false);
    if (providerValue !== ANIMEUNITY_PROVIDER || !link) {
      return;
    }
    let cancelled = false;
    const cached = getCachedProviderPoster(providerValue, link);
    if (cached?.value) {
      setSourceUri(cached.value);
    }
    resolveProviderPoster({providerValue, link})
      .then(poster => {
        if (!cancelled && poster) {
          setSourceUri(poster);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [link, providerCacheScope, providerValue, uri]);

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
  }, [hasTriedFallback, link, providerCacheScope, providerValue]);

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
