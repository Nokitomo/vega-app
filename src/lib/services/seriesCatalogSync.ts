import type {EpisodeLink, Link} from '../providers/types';
import {
  readSharedAnimeEpisodes,
  writeSharedAnimeEpisodes,
} from './animeMetadataSharing';
import {extensionManager} from './ExtensionManager';
import {
  type SeriesCatalogEpisode,
  setSeriesCatalog,
} from '../storage/SeriesCompletionStorage';
import {providerManager} from './ProviderManager';
import {perfTrace, startPerfSpan} from '../utils/perfTrace';

const EPISODE_CACHE_FRESH_MS = 4 * 60 * 60 * 1000;

type SyncOptions = {
  contentLink: string;
  providerValue: string;
  groups: Link[];
  activeSeasonLink?: string;
  activeEpisodes?: EpisodeLink[];
};

type ActiveSync = {
  queued?: SyncOptions;
  promise: Promise<void>;
};

// A season change can request a newer catalog while the previous scan is in
// progress. Finish the current request, then run only the latest queued one.
const activeSyncs = new Map<string, ActiveSync>();

const syncCatalogOnce = async (
  {contentLink, providerValue, groups, activeSeasonLink, activeEpisodes}: SyncOptions,
  isSuperseded: () => boolean,
): Promise<void> => {
  const finish = startPerfSpan('series.catalog', {provider: providerValue});
  const episodesInCatalog: SeriesCatalogEpisode[] = [];
  const providerVersion =
    extensionManager.getProviderModules(providerValue)?.version || '';
  let complete = true;
  let cacheHits = 0;
  let fetches = 0;

  try {
    for (const group of groups) {
      if (isSuperseded()) {
        return;
      }
      if (group.availabilityStatus === 'upcoming') {
        continue;
      }
      let episodes: EpisodeLink[] = [];
      if (group.episodesLink) {
        if (group.episodesLink === activeSeasonLink && activeEpisodes?.length) {
          episodes = activeEpisodes;
        } else {
          const cached = readSharedAnimeEpisodes(providerValue, group.episodesLink);
          if (cached && Date.now() - cached.checkedAt < EPISODE_CACHE_FRESH_MS) {
            episodes = cached.value;
            cacheHits += 1;
          } else {
            try {
              fetches += 1;
              episodes = await providerManager.getEpisodes({
                url: group.episodesLink,
                providerValue,
              });
              if (episodes.length > 0) {
                writeSharedAnimeEpisodes(
                  providerValue,
                  group.episodesLink,
                  episodes,
                  providerVersion,
                );
              }
            } catch {
              complete = false;
              episodes = cached?.value || [];
            }
          }
        }
        if (episodes.length === 0 && group.directLinks?.length) {
          episodes = group.directLinks;
        }
      } else {
        episodes = group.directLinks || [];
      }
      const playable = episodes.filter(episode => !!episode?.link);
      if (playable.length === 0) {
        complete = false;
      }
      episodesInCatalog.push(...playable.map(episode => ({
        link: episode.link,
        title: episode.title,
        episodeNumber: episode.episodeNumber,
        seasonNumber: episode.seasonNumber ?? group.seasonNumber,
        seasonEpisodesLink: group.episodesLink,
      })));
    }

    if (!isSuperseded()) {
      setSeriesCatalog(contentLink, episodesInCatalog, complete);
    }
  } finally {
    perfTrace('series_catalog_summary', {
      provider: providerValue,
      groups: groups.length,
      cacheHits,
      fetches,
      complete,
      superseded: isSuperseded(),
    });
    finish();
  }
};

export const syncSeriesCatalog = (options: SyncOptions): Promise<void> => {
  const key = JSON.stringify([options.providerValue, options.contentLink]);
  const existing = activeSyncs.get(key);
  if (existing) {
    existing.queued = options;
    perfTrace('series_catalog_coalesced', {provider: options.providerValue});
    return existing.promise;
  }

  const sync: ActiveSync = {queued: options, promise: Promise.resolve()};
  activeSyncs.set(key, sync);
  sync.promise = (async () => {
    while (sync.queued) {
      const current = sync.queued;
      sync.queued = undefined;
      await syncCatalogOnce(current, () => !!sync.queued);
    }
  })().finally(() => {
    activeSyncs.delete(key);
  });
  return sync.promise;
};
