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

type SyncResult = {
  complete: boolean;
  revalidateAt: number;
};

const episodeSignature = (episode: EpisodeLink) => [
  episode.link, episode.title, episode.episodeNumber, episode.seasonNumber,
];

/** Only fields that can change the resulting catalog belong in this key. */
export const getSeriesCatalogSyncSignature = (
  options: SyncOptions,
  refreshVersion: number,
  shouldFetchEpisodes: boolean,
): string => JSON.stringify([
  options.providerValue,
  options.contentLink,
  extensionManager.getProviderModules(options.providerValue)?.version || '',
  options.groups.map(group => [
    group.episodesLink,
    group.seasonNumber,
    group.availabilityStatus,
    group.directLinks?.map(episodeSignature),
  ]),
  options.activeSeasonLink,
  options.activeEpisodes?.map(episodeSignature),
  refreshVersion,
  shouldFetchEpisodes,
]);

type ActiveSync = {
  queued?: SyncOptions;
  promise: Promise<SyncResult>;
};

// A season change can request a newer catalog while the previous scan is in
// progress. Finish the current request, then run only the latest queued one.
const activeSyncs = new Map<string, ActiveSync>();

const syncCatalogOnce = async (
  {contentLink, providerValue, groups, activeSeasonLink, activeEpisodes}: SyncOptions,
  isSuperseded: () => boolean,
): Promise<SyncResult> => {
  const finish = startPerfSpan('series.catalog', {provider: providerValue});
  const episodesInCatalog: SeriesCatalogEpisode[] = [];
  const providerVersion =
    extensionManager.getProviderModules(providerValue)?.version || '';
  let complete = true;
  let cacheHits = 0;
  let fetches = 0;
  let revalidateAt = Infinity;

  try {
    for (const group of groups) {
      if (isSuperseded()) {
        return {complete: false, revalidateAt: 0};
      }
      if (group.availabilityStatus === 'upcoming') {
        continue;
      }
      let episodes: EpisodeLink[] = [];
      if (group.episodesLink) {
        if (group.episodesLink === activeSeasonLink && activeEpisodes?.length) {
          episodes = activeEpisodes;
          revalidateAt = Math.min(revalidateAt, Date.now() + EPISODE_CACHE_FRESH_MS);
        } else {
          const cached = readSharedAnimeEpisodes(providerValue, group.episodesLink);
          if (cached && Date.now() - cached.checkedAt < EPISODE_CACHE_FRESH_MS) {
            episodes = cached.value;
            cacheHits += 1;
            revalidateAt = Math.min(revalidateAt, cached.checkedAt + EPISODE_CACHE_FRESH_MS);
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
                revalidateAt = Math.min(revalidateAt, Date.now() + EPISODE_CACHE_FRESH_MS);
              }
            } catch {
              complete = false;
              revalidateAt = 0;
              episodes = cached?.value || [];
            }
          }
        }
        if (episodes.length === 0 && group.directLinks?.length) {
          revalidateAt = 0;
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
    return {complete: complete && !isSuperseded(), revalidateAt};
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

export const syncSeriesCatalog = (options: SyncOptions): Promise<SyncResult> => {
  const key = JSON.stringify([options.providerValue, options.contentLink]);
  const existing = activeSyncs.get(key);
  if (existing) {
    existing.queued = options;
    perfTrace('series_catalog_coalesced', {provider: options.providerValue});
    return existing.promise;
  }

  const sync: ActiveSync = {
    queued: options,
    promise: Promise.resolve({complete: false, revalidateAt: 0}),
  };
  activeSyncs.set(key, sync);
  sync.promise = (async () => {
    let result: SyncResult = {complete: false, revalidateAt: 0};
    while (sync.queued) {
      const current = sync.queued;
      sync.queued = undefined;
      result = await syncCatalogOnce(current, () => !!sync.queued);
    }
    return result;
  })().finally(() => {
    activeSyncs.delete(key);
  });
  return sync.promise;
};
