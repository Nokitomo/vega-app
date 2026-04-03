import {useQuery} from '@tanstack/react-query';
import {providerManager} from '../services/ProviderManager';
import {cacheStorage} from '../storage';
import i18n from '../../i18n';
import {buildEnhancedMetaKey, fetchEnhancedMetadata} from '../services/enhancedMeta';

const STREAMINGUNITY_PROVIDER = 'streamingunity';
const STREAMINGUNITY_META_CACHE_VERSION = 'v2';

const buildContentInfoCacheKey = (link: string, providerValue: string) => {
  if (!link) {
    return '';
  }
  if (providerValue === STREAMINGUNITY_PROVIDER) {
    return `contentInfo:${STREAMINGUNITY_META_CACHE_VERSION}:${providerValue}:${link}`;
  }
  return link;
};

// Hook for fetching content info/metadata
export const useContentInfo = (link: string, providerValue: string) => {
  const cacheKey = buildContentInfoCacheKey(link, providerValue);

  return useQuery({
    queryKey: ['contentInfo', link, providerValue],
    queryFn: async () => {
      console.log('Fetching content info for:', link);

      const data = await providerManager.getMetaData({
        link,
        provider: providerValue,
      });
      if (!data || (!data?.title && !data?.synopsis && !data?.image)) {
        throw new Error(i18n.t('Error: No data returned from provider'));
      }

      return data;
    },
    enabled: !!link && !!providerValue,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
    // Use cached data as initial data
    initialData: () => {
      if (!cacheKey) {
        return undefined;
      }
      const cached = cacheStorage.getString(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return undefined;
        }
      }
      return undefined;
    },
    // Cache successful responses
    meta: {
      onSuccess: (data: any) => {
        if (data && cacheKey) {
          cacheStorage.setString(cacheKey, JSON.stringify(data));
        }
      },
    },
  });
};

// Hook for fetching enhanced metadata from Stremio
export const useEnhancedMetadata = (
  imdbId: string,
  type: string,
  animeIds?: {malId?: number; anilistId?: number},
) => {
  const metaKey = buildEnhancedMetaKey({
    imdbId,
    type,
    malId: animeIds?.malId,
    anilistId: animeIds?.anilistId,
  });

  return useQuery({
    queryKey: ['enhancedMeta', metaKey],
    queryFn: async () => {
      try {
        if (!metaKey) {
          return {};
        }
        if (imdbId && !type) {
          throw new Error(i18n.t('Invalid imdbId or type'));
        }
      } catch (error) {
        console.log('Error validating imdbId or type:', error);
        return {};
      }
      return fetchEnhancedMetadata({
        imdbId,
        type,
        malId: animeIds?.malId,
        anilistId: animeIds?.anilistId,
      });
    },
    enabled: !!metaKey,
    staleTime: 30 * 60 * 1000, // 30 minutes - metadata changes rarely
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 1, // Don't retry too much for external API
    // Use cached data as initial data
    initialData: () => {
      if (!metaKey) {
        return undefined;
      }
      const cached = cacheStorage.getString(metaKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return undefined;
        }
      }
      return undefined;
    },
    // Cache successful responses
    meta: {
      onSuccess: (data: any) => {
        if (data && metaKey) {
          cacheStorage.setString(metaKey, JSON.stringify(data));
        }
      },
    },
  });
};

// Combined hook for both info and metadata
export const useContentDetails = (link: string, providerValue: string) => {
  // First, get the basic content info
  const {
    data: info,
    isLoading: infoLoading,
    error: infoError,
    refetch: refetchInfo,
  } = useContentInfo(link, providerValue);

  const animeIds = info?.extra?.ids;
  const allowExternalMeta =
    providerValue !== 'animeunity' ||
    !!animeIds?.malId ||
    !!animeIds?.anilistId;
  const externalImdbId = allowExternalMeta ? info?.imdbId || '' : '';
  const externalType = allowExternalMeta ? info?.type || '' : '';
  const externalAnimeIds = allowExternalMeta ? animeIds : undefined;

  // Then, get enhanced metadata if external IDs are available
  const {
    data: meta,
    isLoading: metaLoading,
    error: metaError,
    refetch: refetchMeta,
  } = useEnhancedMetadata(
    externalImdbId,
    externalType,
    externalAnimeIds,
  );

  return {
    info,
    meta,
    isLoading: infoLoading || metaLoading,
    error: infoError || (!info ? metaError : undefined),
    refetch: async () => {
      await Promise.all([refetchInfo(), refetchMeta()]);
    },
  };
};
