import {useQuery} from '@tanstack/react-query';
import {useRef} from 'react';
import {providerManager} from '../services/ProviderManager';
import {cacheStorage} from '../storage';
import i18n from '../../i18n';
import {
  buildEnhancedMetaKey,
  fetchEnhancedMetadata,
} from '../services/enhancedMeta';
import {
  buildProviderCacheKey,
  getProviderCacheScope,
} from '../utils/providerCacheScope';
import {readPersistedCache, writePersistedCache} from '../utils/persistedCache';
import {shouldFetchAniListBanner} from '../services/animeArtwork';
import {perfTrace} from '../utils/perfTrace';
import {
  markMetadataChecked,
  readMetadata,
  removeMetadata,
  writeMetadata,
} from '../storage/MetadataDatabase';
import type {ContentInventory, Info} from '../providers/types';
import {extensionManager} from '../services/ExtensionManager';
import {
  getMetadataCheckInterval,
  hasContentInventoryChanged,
} from '../services/metadataRefreshPolicy';
import {
  getMetadataSourceProvider,
  streamCenterMetaOrigin,
  unwrapStreamCenterInfo,
  wrapStreamCenterInfo,
} from '../services/streamCenterMetadata';
import {
  markSharedAnimeInfoChecked,
  readSharedAnimeInfo,
  writeSharedAnimeInfo,
} from '../services/animeMetadataSharing';

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
  const providerVersion =
    extensionManager.getProviderModules(providerValue)?.version || '';
  const manualRefreshRef = useRef(false);
  const origin =
    providerValue === 'streamcenter' ? streamCenterMetaOrigin(link) : undefined;
  const readDurableInfo = () => {
    const shared = readSharedAnimeInfo(providerValue, link);
    if (!origin || origin.source === 'animeunity') {return shared;}
    const own = shared;
    const source = readMetadata<Info>(
      'contentInfo',
      origin.source,
      origin.data.url,
    );
    return source && (!own || source.updatedAt > own.updatedAt)
      ? {...source, value: wrapStreamCenterInfo(source.value, origin.source)}
      : own;
  };
  const initialRecord = readDurableInfo();
  const initialInfo = initialRecord?.value;
  const installedRecord = readMetadata<Info>('contentInfo', providerValue, link);
  const sourceRecord = origin?.source === 'animeunity'
    ? readMetadata<Info>('contentInfo', 'animeunity', origin.data.url)
    : undefined;
  const providerUpdated =
    (!!installedRecord && installedRecord.providerVersion !== providerVersion) ||
    (!!sourceRecord && sourceRecord.providerVersion !==
      (extensionManager.getProviderModules('animeunity')?.version || ''));
  const targetProvider =
    providerValue === 'animeunity' ||
    providerValue === 'streamingunity' ||
    !!origin;

  const query = useQuery({
    queryKey: ['contentInfo', link, providerValue, providerCacheScope],
    queryFn: async () => {
      console.log('Fetching content info for:', link);

      const stored = readDurableInfo();
      if (targetProvider && stored && !manualRefreshRef.current && !providerUpdated) {
        const inventory = await providerManager.getContentInventory({
          link,
          providerValue,
        });
        if (inventory?.complete) {
          const previous = readMetadata<ContentInventory>(
            'contentInventory',
            providerValue,
            link,
          );
          if (
            !hasContentInventoryChanged(
              stored.value,
              inventory,
              previous?.value,
            )
          ) {
            writeMetadata(
              'contentInventory',
              providerValue,
              link,
              inventory,
              providerVersion,
            );
            markSharedAnimeInfoChecked(providerValue, link, providerVersion);
            if (origin) {
              if (origin.source !== 'animeunity') {
                // StreamingUnity keeps its existing independent metadata cache.
                markMetadataChecked(
                  'contentInfo', origin.source, origin.data.url,
                  extensionManager.getProviderModules(origin.source)?.version || '',
                );
              }
              if (
                !readMetadata<Info>('contentInfo', providerValue, link) ||
                (origin.source === 'animeunity' &&
                  !readMetadata<Info>('contentInfo', 'animeunity', origin.data.url))
              ) {
                writeSharedAnimeInfo(providerValue, link, stored.value, providerVersion);
              }
            }
            return stored.value;
          }
        }
      }

      const data = await providerManager.getMetaData({
        link,
        provider: providerValue,
      });
      if (!data || (!data?.title && !data?.synopsis && !data?.image)) {
        throw new Error(i18n.t('Error: No data returned from provider'));
      }
      if (cacheKey) {
        writePersistedCache(cacheStorage, cacheKey, data);
        writeSharedAnimeInfo(providerValue, link, data, providerVersion);
        if (origin?.source === 'streamingunity') {
          writeMetadata(
            'contentInfo',
            origin.source,
            origin.data.url,
            unwrapStreamCenterInfo(data),
            extensionManager.getProviderModules(origin.source)?.version || '',
          );
        }
        // A changed full snapshot supersedes the previous inventory baseline.
        // The next cheap check compares against the newly fetched Info.
        removeMetadata('contentInventory', providerValue, link);
      }
      return data;
    },
    enabled: !!link && !!providerValue,
    staleTime: targetProvider
      ? providerUpdated
        ? 0
        : getMetadataCheckInterval(origin?.source || providerValue, initialInfo)
      : CONTENT_INFO_STALE_MS,
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
    // Use cached data as initial data
    initialData: () => {
      if (!cacheKey) {
        return undefined;
      }
      const durable = readDurableInfo();
      const cached = durable
        ? undefined
        : readPersistedCache<any>(cacheStorage, cacheKey);
      perfTrace('content_info_cache', {
        provider: providerValue,
        hit: !!durable || !!cached,
        ageMs: durable
          ? Math.round(Date.now() - durable.updatedAt)
          : cached
            ? Math.round(cached.ageMs)
            : undefined,
      });
      return durable?.value || cached?.value;
    },
    initialDataUpdatedAt: () =>
      cacheKey
        ? (() => {
            const durable = readDurableInfo();
            if (durable) {
              return !providerUpdated && (origin || durable.providerVersion === providerVersion)
                ? durable.checkedAt
                : 0;
            }
            return readPersistedCache<any>(cacheStorage, cacheKey)
              ?.updatedAt;
          })()
        : undefined,
  });
  return {
    ...query,
    check: () => query.refetch(),
    refetch: async () => {
      manualRefreshRef.current = true;
      try {
        return await query.refetch();
      } finally {
        manualRefreshRef.current = false;
      }
    },
  };
};

// Hook for fetching enhanced metadata from Stremio
export const useEnhancedMetadata = (
  imdbId: string,
  type: string,
  animeIds?: {malId?: number; anilistId?: number},
  providerValue?: string,
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
        writeMetadata('enhancedMeta', '', metaKey, data);
      }
      return data;
    },
    enabled: !!metaKey,
    staleTime:
      providerValue === 'animeunity' ||
      providerValue === 'streamingunity' ||
      providerValue === 'streamcenter'
        ? Infinity
        : ENHANCED_META_STALE_MS,
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 1, // Don't retry too much for external API
    // Use cached data as initial data
    initialData: () => {
      if (!metaKey) {
        return undefined;
      }
      return (
        readMetadata<any>('enhancedMeta', '', metaKey)?.value ||
        readPersistedCache<any>(cacheStorage, metaKey)?.value
      );
    },
    initialDataUpdatedAt: () =>
      metaKey
        ? readMetadata<any>('enhancedMeta', '', metaKey)?.updatedAt ||
          readPersistedCache<any>(cacheStorage, metaKey)?.updatedAt
        : undefined,
  });
};

// Combined hook for both info and metadata
export const useContentDetails = (link: string, providerValue: string) => {
  const metadataProvider = getMetadataSourceProvider(providerValue, link);
  // First, get the basic content info
  const {
    data: info,
    isLoading: infoLoading,
    error: infoError,
    refetch: refetchInfo,
    check: checkInfo,
  } = useContentInfo(link, providerValue);

  const animeIds = info?.extra?.ids;
  const allowExternalMeta =
    metadataProvider !== 'animeunity' ||
    !!animeIds?.malId ||
    !!animeIds?.anilistId;
  const preferAnimeMeta = metadataProvider === 'animeunity';
  const externalImdbId =
    allowExternalMeta && !preferAnimeMeta ? info?.imdbId || '' : '';
  const externalType =
    allowExternalMeta && !preferAnimeMeta ? info?.type || '' : '';
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
    providerValue,
  );

  const artworkSources = info?.extra?.artworkSources;
  const animeArtworkNeedsFallback =
    metadataProvider === 'animeunity' &&
    !!info &&
    shouldFetchAniListBanner({
      anilistId: animeIds?.anilistId,
      backgroundSource: artworkSources?.background,
    });

  return {
    info,
    meta,
    isLoading: infoLoading || (animeArtworkNeedsFallback && metaLoading),
    isMetaLoading: metaLoading,
    error: !info ? infoError || metaError : undefined,
    refetch: async () => {
      await Promise.all([refetchInfo(), refetchMeta()]);
    },
    repairInfo: refetchInfo,
    check: checkInfo,
  };
};
