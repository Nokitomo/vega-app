import {useQuery} from '@tanstack/react-query';
import {providerManager} from '../services/ProviderManager';
import {cacheStorage} from '../storage';
import {EpisodeLink} from '../providers/types';
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

const EPISODES_STALE_MS = 4 * 60 * 60 * 1000;

export const useEpisodes = (
  episodesLink: string | undefined,
  providerValue: string,
  enabled: boolean = true,
) => {
  const providerCacheScope = getProviderCacheScope(providerValue);
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

      const episodes = await providerManager.getEpisodes({
        url: episodesLink,
        providerValue: providerValue,
      });

      // Cache successful responses
      if (episodes && episodes.length > 0 && episodesCacheKey) {
        writePersistedCache(cacheStorage, episodesCacheKey, episodes);
      }

      return episodes || [];
    },
    enabled: enabled && !!episodesLink && !!providerValue,
    staleTime: EPISODES_STALE_MS,
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

      return readPersistedCache<EpisodeLink[]>(cacheStorage, episodesCacheKey)
        ?.value;
    },
    initialDataUpdatedAt: () =>
      episodesCacheKey
        ? readPersistedCache<EpisodeLink[]>(cacheStorage, episodesCacheKey)
            ?.updatedAt
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
