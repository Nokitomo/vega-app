import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Image, ImageProps} from 'react-native';
import {providerManager} from '../lib/services/ProviderManager';
import {cacheStorageService} from '../lib/storage';

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
  }, [uri]);

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

    const cacheKey = `animeunity:poster:${link}`;
    const cached = cacheStorageService.getString(cacheKey);
    if (cached) {
      if (isMounted.current) {
        setSourceUri(cached);
      }
      return;
    }

    try {
      const info = await providerManager.getMetaData({
        link,
        provider: providerValue,
      });
      const image = info?.poster || info?.image;
      if (image) {
        cacheStorageService.setString(cacheKey, image);
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
  }, [hasTriedFallback, link, providerValue]);

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
