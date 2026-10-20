import type {
  ContentInventory,
  EpisodeLink,
  Info,
} from '../providers/types';
import {queryClient} from '../client';
import {extensionManager} from './ExtensionManager';
import {
  readMetadata,
  writeMetadata,
} from '../storage/MetadataDatabase';
import {mainStorage} from '../storage/StorageService';
import type {WatchHistoryItem} from '../storage/WatchHistoryStorage';
import {
  getSeriesCatalog,
  setSeriesCatalog,
  type SeriesCatalogEpisode,
} from '../storage/SeriesCompletionStorage';
import {getProviderCacheScope} from '../utils/providerCacheScope';
import {hasContentInventoryChanged, getMetadataCheckInterval} from './metadataRefreshPolicy';
import {reconcileEpisodes} from './episodeReconciliation';
import {providerManager} from './ProviderManager';
import {getMetadataSourceProvider} from './streamCenterMetadata';
import {
  animeEpisodesSourceLink,
  animeMetaSourceLink,
  markSharedAnimeEpisodesChecked,
  markSharedAnimeInfoChecked,
  readSharedAnimeEpisodes,
  readSharedAnimeInfo,
  writeSharedAnimeEpisodes,
  writeSharedAnimeInfo,
} from './animeMetadataSharing';

const HOUR = 60 * 60 * 1000;
const MAX_TITLES_PER_VISIT = 12;
const ERROR_RETRY_MS = HOUR;
const ENDED_RECHECK_MS = 24 * HOUR;
const CHECK_KEY = 'continueWatchingProviderChecks';

type CheckTimes = Record<string, number>;

let inFlight: Promise<boolean> | undefined;

const checkId = (item: WatchHistoryItem) => `${item.provider}:${item.link}`;
const checkInterval = (item: WatchHistoryItem): number => {
  const info = readSharedAnimeInfo(item.provider!, item.link)?.value;
  const origin = getMetadataSourceProvider(item.provider!, item.link);
  const metadataProvider = item.provider === 'streamcenter' && origin === 'animeunity'
    ? origin
    : item.provider!;
  const policy = getMetadataCheckInterval(metadataProvider, info);
  return Number.isFinite(policy)
    ? Math.min(policy, ENDED_RECHECK_MS)
    : ENDED_RECHECK_MS;
};

const fetchCatalog = async (
  info: Info,
  providerValue: string,
): Promise<SeriesCatalogEpisode[]> => {
  const result: SeriesCatalogEpisode[] = [];
  const version = extensionManager.getProviderModules(providerValue)?.version || '';
  for (const group of info.linkList || []) {
    if (group.availabilityStatus === 'upcoming') {
      continue;
    }
    let episodes: EpisodeLink[] = [];
    let cacheWritten = false;
    if (group.episodesLink) {
      const cached = readSharedAnimeEpisodes(providerValue, group.episodesLink);
      if (cached?.value.length) {
        const inventory = await providerManager.getEpisodeInventory({
          url: group.episodesLink,
          providerValue,
        });
        if (inventory?.complete) {
          const priorMissing = readMetadata<string[]>(
            'episodeMissing', providerValue, group.episodesLink,
          )?.value || [];
          const reconciled = reconcileEpisodes(
            cached.value,
            inventory.episodes,
            priorMissing,
          );
          writeMetadata(
            'episodeMissing', providerValue, group.episodesLink,
            reconciled.missing,
          );
          episodes = reconciled.episodes;
          if (reconciled.added.length) {
            const detailed = await providerManager.getEpisodes({
              url: group.episodesLink,
              providerValue,
              knownEpisodes: cached.value,
              silent: true,
            });
            const byLink = new Map(detailed.map(episode => [episode.link, episode]));
            if (reconciled.added.some(link => !byLink.has(link))) {
              throw new Error('Incomplete episode update');
            }
            episodes = episodes.map(episode => byLink.get(episode.link) || episode);
          }
          if (reconciled.added.length || reconciled.confirmedRemoved.length) {
            writeSharedAnimeEpisodes(providerValue, group.episodesLink, episodes, version);
            cacheWritten = true;
          } else {
            const sourceLink = animeEpisodesSourceLink(providerValue, group.episodesLink);
            if (providerValue === 'streamcenter' && sourceLink &&
              !readMetadata<EpisodeLink[]>('episodes', 'animeunity', sourceLink)) {
              writeSharedAnimeEpisodes(providerValue, group.episodesLink, episodes, version);
            } else {
              markSharedAnimeEpisodesChecked(providerValue, group.episodesLink, version);
            }
            cacheWritten = true;
          }
        } else {
          episodes = await providerManager.getEpisodes({
            url: group.episodesLink,
            providerValue,
            silent: true,
          });
        }
      } else {
        episodes = await providerManager.getEpisodes({
          url: group.episodesLink,
          providerValue,
          silent: true,
        });
      }
      if (episodes.length && !cacheWritten) {
        writeSharedAnimeEpisodes(providerValue, group.episodesLink, episodes, version);
      }
    } else {
      episodes = (group.directLinks || []) as EpisodeLink[];
    }
    if (episodes.length === 0) {
      throw new Error('Incomplete series catalog');
    }
    result.push(...episodes.filter(episode => !!episode.link).map(episode => ({
      link: episode.link,
      title: episode.title,
      episodeNumber: episode.episodeNumber,
      seasonNumber: episode.seasonNumber ?? group.seasonNumber,
      seasonEpisodesLink: group.episodesLink,
    })));
  }
  if (result.length === 0) {
    throw new Error('Empty series catalog');
  }
  return result;
};

const checkOne = async (item: WatchHistoryItem): Promise<boolean> => {
  const providerValue = item.provider || '';
  const storedInfo = readSharedAnimeInfo(providerValue, item.link);
  const previousInventory = readMetadata<ContentInventory>(
    'contentInventory', providerValue, item.link,
  );
  const inventory = await providerManager.getContentInventory({
    link: item.link,
    providerValue,
  });
  if (!inventory?.complete) {
    return false;
  }
  const currentCatalog = getSeriesCatalog(item.link);
  const changed = !storedInfo || !currentCatalog?.complete ||
    !currentCatalog.episodes?.length ||
    hasContentInventoryChanged(
      storedInfo.value,
      inventory,
      previousInventory?.value,
    );
  if (!changed) {
    writeMetadata('contentInventory', providerValue, item.link, inventory);
    const sourceLink = animeMetaSourceLink(providerValue, item.link);
    if (providerValue === 'streamcenter' && sourceLink && storedInfo &&
      !readMetadata<Info>('contentInfo', 'animeunity', sourceLink)) {
      writeSharedAnimeInfo(
        providerValue, item.link, storedInfo.value,
        extensionManager.getProviderModules(providerValue)?.version || '',
      );
    } else {
      markSharedAnimeInfoChecked(providerValue, item.link);
    }
    return false;
  }

  const info = await providerManager.getMetaData({
    link: item.link,
    provider: providerValue,
  });
  if (info.type !== 'series' || !info.linkList?.length) {
    return false;
  }
  const episodes = await fetchCatalog(info, providerValue);
  setSeriesCatalog(item.link, episodes, true);
  const version = extensionManager.getProviderModules(providerValue)?.version || '';
  writeSharedAnimeInfo(providerValue, item.link, info, version);
  writeMetadata('contentInventory', providerValue, item.link, inventory, version);
  queryClient.setQueryData(
    ['contentInfo', item.link, providerValue, getProviderCacheScope(providerValue)],
    info,
  );
  return true;
};

/** Checks a bounded batch while Home is active. Playback history is never reordered. */
export const checkContinueWatchingSeries = async (
  history: WatchHistoryItem[],
  hiddenLinks: readonly string[],
): Promise<boolean> => {
  if (inFlight) {
    return inFlight;
  }
  inFlight = (async () => {
    const hidden = new Set(hiddenLinks);
    const now = Date.now();
    const checks = mainStorage.getObject<CheckTimes>(CHECK_KEY) || {};
    const candidates = history
      .filter(item => item.isSeries && item.provider && item.link && !hidden.has(item.link))
      .filter(item => {
        return now - (checks[checkId(item)] || 0) >= checkInterval(item);
      })
      .sort((left, right) =>
        (checks[checkId(left)] || 0) - (checks[checkId(right)] || 0),
      )
      .slice(0, MAX_TITLES_PER_VISIT);
    let changed = false;
    for (const item of candidates) {
      try {
        changed = (await checkOne(item)) || changed;
        checks[checkId(item)] = Date.now();
      } catch {
        checks[checkId(item)] = Date.now() - checkInterval(item) + ERROR_RETRY_MS;
      }
      mainStorage.setObject(CHECK_KEY, checks);
    }
    return changed;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = undefined;
  }
};
