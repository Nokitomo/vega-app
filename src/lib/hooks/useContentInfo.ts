import {useQuery} from '@tanstack/react-query';
import {providerManager} from '../services/ProviderManager';
import {cacheStorage} from '../storage';
import i18n from '../../i18n';
import {buildEnhancedMetaKey, fetchEnhancedMetadata} from '../services/enhancedMeta';
import {
  buildProviderCacheKey,
  getProviderCacheScope,
} from '../utils/providerCacheScope';
import {
  readPersistedCache,
  writePersistedCache,
} from '../utils/persistedCache';

const CONTENT_INFO_STALE_MS = 24 * 60 * 60 * 1000;
const ENHANCED_META_STALE_MS = 24 * 60 * 60 * 1000;

const buildContentInfoCacheKey = (link: string, providerValue: string) => {
  if (!link) {
    return '';
  }
  return buildProviderCacheKey('contentInfo', providerValue, link);
};

// Hook for fetching content info/metadata
export const useContentInfo = (link: string, providerValue: string) => {
  const cacheKey = buildContentInfoCacheKey(link, providerValue);
  const providerCacheScope = getProviderCacheScope(providerValue);

  return useQuery({
    queryKey: ['contentInfo', link, providerValue, providerCacheScope],
    queryFn: async () => {
      console.log('Fetching content info for:', link);

      const data = await providerManager.getMetaData({
        link,
        provider: providerValue,
      });
      if (!data || (!data?.title && !data?.synopsis && !data?.image)) {
        throw new Error(i18n.t('Error: No data returned from provider'));
      }
      if (cacheKey) {
        writePersistedCache(cacheStorage, cacheKey, data);
      }
      return data;
    },
    enabled: !!link && !!providerValue,
    staleTime: CONTENT_INFO_STALE_MS,
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
    // Use cached data as initial data
    initialData: () => {
      if (!cacheKey) {
        return undefined;
      }
      return readPersistedCache<any>(cacheStorage, cacheKey)?.value;
    },
    initialDataUpdatedAt: () =>
      cacheKey
        ? readPersistedCache<any>(cacheStorage, cacheKey)?.updatedAt
        : undefined,
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
      const data = await fetchEnhancedMetadata({
        imdbId,
        type,
        malId: animeIds?.malId,
        anilistId: animeIds?.anilistId,
      });
      if (metaKey) {
        writePersistedCache(cacheStorage, metaKey, data);
      }
      return data;
    },
    enabled: !!metaKey,
    staleTime: ENHANCED_META_STALE_MS,
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 1, // Don't retry too much for external API
    // Use cached data as initial data
    initialData: () => {
      if (!metaKey) {
        return undefined;
      }
      return readPersistedCache<any>(cacheStorage, metaKey)?.value;
    },
    initialDataUpdatedAt: () =>
      metaKey
        ? readPersistedCache<any>(cacheStorage, metaKey)?.updatedAt
        : undefined,
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

  const artworkSources = info?.extra?.artworkSources;
  const animeArtworkNeedsFallback =
    providerValue === 'animeunity' &&
    !!info &&
    (artworkSources?.logo !== 'tmdb' ||
      artworkSources?.poster !== 'tmdb' ||
      artworkSources?.background !== 'tmdb');

  return {
    info,
    meta,
    isLoading:
      infoLoading ||
      (providerValue === 'animeunity'
        ? animeArtworkNeedsFallback && metaLoading
        : metaLoading),
    error: infoError || (!info ? metaError : undefined),
    refetch: async () => {
      await Promise.all([refetchInfo(), refetchMeta()]);
    },
  };
};
