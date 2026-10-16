import {useQuery} from '@tanstack/react-query';
import {providerManager} from '../services/ProviderManager';
import {cacheStorage} from '../storage';
import {EpisodeLink, Info} from '../providers/types';
import {extensionManager} from '../services';
import i18n from '../../i18n';
import {
  buildProviderCacheKey,
  getProviderCacheScope,
} from '../utils/providerCacheScope';
import {
  readPersistedCache,
  writePersistedCache,
} from '../utils/persistedCache';
import {perfTrace} from '../utils/perfTrace';
import {
  markMetadataChecked,
  readMetadata,
  removeMetadata,
  writeMetadata,
} from '../storage/MetadataDatabase';
import {getMetadataCheckInterval} from '../services/metadataRefreshPolicy';
import {reconcileEpisodes} from '../services/episodeReconciliation';
import {
  episodeIdentity,
  streamCenterEpisodesOrigin,
  unwrapStreamCenterEpisodes,
  wrapStreamCenterEpisodes,
} from '../services/streamCenterMetadata';

const EPISODES_STALE_MS = 4 * 60 * 60 * 1000;

export const useEpisodes = (
  episodesLink: string | undefined,
  providerValue: string,
  enabled: boolean = true,
  contentInfo?: Info,
) => {
  const providerCacheScope = getProviderCacheScope(providerValue);
  const providerVersion =
    extensionManager.getProviderModules(providerValue)?.version || '';
  const origin =
    providerValue === 'streamcenter' && episodesLink
      ? streamCenterEpisodesOrigin(episodesLink)
      : undefined;
  const isIncrementalProvider =
    providerValue === 'animeunity' ||
    providerValue === 'streamingunity' ||
    !!origin;
  const episodeKey = origin ? episodeIdentity : (link: string) => link;
  const readDurableEpisodes = () => {
    const own = readMetadata<EpisodeLink[]>(
      'episodes',
      providerValue,
      episodesLink || '',
    );
    if (!origin) {return own;}
    const source = readMetadata<EpisodeLink[]>(
      'episodes',
      origin.source,
      origin.data.url,
    );
    return source && (!own || source.updatedAt > own.updatedAt)
      ? {...source, value: wrapStreamCenterEpisodes(source.value, origin)}
      : own;
  };
  const installedRecord = readMetadata<EpisodeLink[]>(
    'episodes',
    providerValue,
    episodesLink || '',
  );
  const providerUpdated =
    !!installedRecord && installedRecord.providerVersion !== providerVersion;
  const saveEpisodes = (episodes: EpisodeLink[]) => {
    if (!episodesLink) {return;}
    const durableEpisodes = origin
      ? wrapStreamCenterEpisodes(
          unwrapStreamCenterEpisodes(episodes),
          origin,
        )
      : episodes;
    writeMetadata(
      'episodes',
      providerValue,
      episodesLink,
      durableEpisodes,
      providerVersion,
    );
    if (origin) {
      writeMetadata(
        'episodes',
        origin.source,
        origin.data.url,
        unwrapStreamCenterEpisodes(episodes),
        extensionManager.getProviderModules(origin.source)?.version || '',
      );
    }
  };
  const episodesCacheKey = episodesLink
    ? buildProviderCacheKey('episodes', providerValue, episodesLink)
    : '';
  return useQuery<EpisodeLink[], Error>({
    queryKey: [
      'episodes',
      episodesLink,
      providerValue,
      providerCacheScope,
    ],
    queryFn: async () => {
      if (!episodesLink || !providerValue || !enabled) {
        return [];
      }

      console.log('Fetching episodes for:', episodesLink);

      // Check if provider has episodes module
      const hasEpisodesModule =
        extensionManager.getProviderModules(providerValue)?.modules.episodes;

      console.log('Has episodes module:', !!hasEpisodesModule);

      if (!hasEpisodesModule) {
        return [];
      }

      const durable = readDurableEpisodes();
      if (isIncrementalProvider && durable && !providerUpdated) {
        const inventory = await providerManager.getEpisodeInventory({
          url: episodesLink,
          providerValue,
        });
        if (inventory?.complete) {
          const priorMissing =
            readMetadata<string[]>(
              'episodeMissing',
              providerValue,
              episodesLink,
            )?.value || [];
          const reconciliation = reconcileEpisodes(
            durable.value,
            inventory.episodes,
            priorMissing,
            episodeKey,
          );
          if (reconciliation.missing.length > 0) {
            writeMetadata(
              'episodeMissing',
              providerValue,
              episodesLink,
              reconciliation.missing,
            );
          } else {
            removeMetadata('episodeMissing', providerValue, episodesLink);
          }

          if (
            reconciliation.added.length === 0 &&
            reconciliation.confirmedRemoved.length === 0
          ) {
            markMetadataChecked(
              'episodes',
              providerValue,
              episodesLink,
              providerVersion,
            );
            if (origin) {
              markMetadataChecked(
                'episodes',
                origin.source,
                origin.data.url,
                extensionManager.getProviderModules(origin.source)?.version || '',
              );
              if (
                !readMetadata<EpisodeLink[]>(
                  'episodes',
                  providerValue,
                  episodesLink,
                )
              ) {
                saveEpisodes(durable.value);
              }
            }
            return durable.value;
          }

          let nextEpisodes = reconciliation.episodes;
          if (reconciliation.added.length > 0) {
            const detailed = await providerManager.getEpisodes({
              url: episodesLink,
              providerValue,
              knownEpisodes: durable.value,
            });
            const detailsByLink = new Map(
              detailed.map(episode => [episodeKey(episode.link), episode]),
            );
            if (
              reconciliation.added.some(link => !detailsByLink.has(link))
            ) {
              throw new Error('Incomplete enriched episode response');
            }
            nextEpisodes = nextEpisodes.map(
              episode =>
                detailsByLink.get(episodeKey(episode.link)) || episode,
            );
          }
          writePersistedCache(cacheStorage, episodesCacheKey, nextEpisodes);
          saveEpisodes(nextEpisodes);
          return nextEpisodes;
        }
      }

      const episodes = await providerManager.getEpisodes({
        url: episodesLink,
        providerValue: providerValue,
      });

      // Cache successful responses
      if (episodes && episodes.length > 0 && episodesCacheKey) {
        writePersistedCache(cacheStorage, episodesCacheKey, episodes);
        saveEpisodes(episodes);
      }

      return episodes || [];
    },
    enabled: enabled && !!episodesLink && !!providerValue,
    staleTime: isIncrementalProvider
      ? providerUpdated
        ? 0
        : getMetadataCheckInterval(origin?.source || providerValue, contentInfo)
      : EPISODES_STALE_MS,
    gcTime: 60 * 60 * 1000, // 1 hour (was cacheTime)
    retry: (failureCount, _error) => {
      // Don't retry on provider/network errors
      if (failureCount >= 2) {
        return false;
      }
      return true;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Use cached data as initial data
    initialData: () => {
      if (!episodesLink) {
        return undefined;
      }

      const durable = readDurableEpisodes();
      const cached = durable
        ? undefined
        : readPersistedCache<EpisodeLink[]>(cacheStorage, episodesCacheKey);
      perfTrace('episodes_cache', {
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
      episodesCacheKey
        ? (() => {
            const durable = readDurableEpisodes();
            if (durable) {
              return origin || durable.providerVersion === providerVersion
                ? durable.checkedAt
                : 0;
            }
            return isIncrementalProvider
              ? 0
              : readPersistedCache<EpisodeLink[]>(
                  cacheStorage,
                  episodesCacheKey,
                )?.updatedAt;
          })()
        : undefined,
    // Prevent background refetches unless data is stale
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
  });
};

// Hook for managing streams for external player
export const useStreamData = () => {
  const fetchStreams = async (
    link: string,
    type: string,
    providerValue: string,
  ) => {
    const controller = new AbortController();

    try {
      const stream = await providerManager.getStream({
        link,
        type,
        signal: controller.signal,
        providerValue,
      });

      return stream || [];
    } catch (error) {
      console.error('Error fetching streams:', error);
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : i18n.t('Failed to fetch streams');
      throw new Error(errorMessage);
    }
  };

  return {fetchStreams};
};
