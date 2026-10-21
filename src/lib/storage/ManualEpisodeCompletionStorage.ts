import {cacheStorage, mainStorage} from './StorageService';
import {watchHistoryStorage} from './WatchHistoryStorage';
import {
  createSharedWatchEpisodeKeyResolver,
  relatedWatchContentLinks,
  sharedWatchContentKey,
  sharedWatchEpisodeKey,
} from './SharedAnimeWatchIdentity';
import {
  readSharedEpisodeProgress,
  SERIES_EPISODE_PROGRESS_PREFIX,
} from './SharedAnimeEpisodeProgressStorage';

export const WATCH_COMPLETION_PERCENT = 95;
export {SERIES_EPISODE_PROGRESS_PREFIX};

const keyForContent = (contentLink: string) =>
  `manualWatchedEpisodes_${sharedWatchContentKey(contentLink)}`;
const CONTENT_KEYS = 'manualWatchedEpisodeContents';
const migrationRevisions = new Map<string, string>();

const migrationRevision = (): string => [
  mainStorage.getKeyRevision('watchHistory'),
  mainStorage.getKeyRevision(CONTENT_KEYS),
  mainStorage.getKeyRevision('seriesCatalogContentLinks'),
  mainStorage.getKeyRevision('watchHistoryEpisodeKeys'),
].join(':');

const getManualSet = (contentLink: string): Set<string> => {
  const key = sharedWatchContentKey(contentLink);
  const links = new Set(
    (mainStorage.getArray<string>(keyForContent(contentLink)) || [])
      .map(link => sharedWatchEpisodeKey(contentLink, link)),
  );
  if (key !== contentLink && migrationRevisions.get(key) !== migrationRevision()) {
    let migrated = false;
    for (const alias of relatedWatchContentLinks(contentLink)) {
      if (alias === key) {continue;}
      const legacyKey = `manualWatchedEpisodes_${alias}`;
      for (const episode of mainStorage.getArray<string>(legacyKey) || []) {
        links.add(sharedWatchEpisodeKey(contentLink, episode));
        migrated = true;
      }
      if (mainStorage.contains(legacyKey)) {
        mainStorage.delete(legacyKey);
        migrated = true;
      }
    }
    if (migrated) {
      mainStorage.setArray(keyForContent(contentLink), [...links]);
      const contents = mainStorage.getArray<string>(CONTENT_KEYS) || [];
      mainStorage.setArray(CONTENT_KEYS, [
        ...new Set([...contents.filter(link =>
          !relatedWatchContentLinks(contentLink).includes(link)), key]),
      ]);
    }
    migrationRevisions.set(key, migrationRevision());
  }
  return links;
};

export const isEpisodeManuallyWatched = (
  contentLink: string,
  episodeLink: string,
): boolean =>
  getManualSet(contentLink).has(sharedWatchEpisodeKey(contentLink, episodeLink));

export const getEpisodeProgressPercent = (
  contentLink: string,
  episodeLink: string,
): number => {
  if (isEpisodeManuallyWatched(contentLink, episodeLink)) {
    return 100;
  }
  const recorded = readSharedEpisodeProgress(contentLink)[
    sharedWatchEpisodeKey(contentLink, episodeLink)];
  if (Number.isFinite(recorded)) {
    return Math.min(Math.max(recorded!, 0), 100);
  }
  // Legacy manual marks wrote an untracked 1/1 cache entry. After clearing
  // history that entry must never make the episode appear watched again.
  if (!watchHistoryStorage.getEpisodeKeys(contentLink).some(link =>
    sharedWatchEpisodeKey(contentLink, link) ===
    sharedWatchEpisodeKey(contentLink, episodeLink))) {
    return 0;
  }
  try {
    const progress = JSON.parse(cacheStorage.getString(episodeLink) || '{}');
    const position = Number(progress.position);
    const duration = Number(progress.duration);
    if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) {
      return 0;
    }
    return Math.min(Math.max((position / duration) * 100, 0), 100);
  } catch {
    return 0;
  }
};

/** Read the shared progress records once when checking a whole season or series. */
export const getEpisodeProgressSnapshot = (
  contentLink: string,
  episodeLinks: readonly string[],
): Map<string, number> => {
  const episodeKeyFor = createSharedWatchEpisodeKeyResolver(contentLink);
  const manual = getManualSet(contentLink);
  const recorded = readSharedEpisodeProgress(contentLink);
  const tracked = new Set(watchHistoryStorage.getEpisodeKeys(contentLink).map(link =>
    episodeKeyFor(link)));
  const result = new Map<string, number>();
  for (const link of episodeLinks) {
    const episodeKey = episodeKeyFor(link);
    if (manual.has(episodeKey)) {
      result.set(link, 100);
    } else if (Number.isFinite(recorded[episodeKey])) {
      result.set(link, Math.min(Math.max(recorded[episodeKey], 0), 100));
    } else if (!tracked.has(episodeKey)) {
      result.set(link, 0);
    } else {
      try {
        const progress = JSON.parse(cacheStorage.getString(link) || '{}');
        const position = Number(progress.position);
        const duration = Number(progress.duration);
        result.set(link, Number.isFinite(position) && Number.isFinite(duration) && duration > 0
          ? Math.min(Math.max((position / duration) * 100, 0), 100)
          : 0);
      } catch {
        result.set(link, 0);
      }
    }
  }
  return result;
};

export const getManuallyWatchedEpisodeLinks = (contentLink: string): string[] =>
  [...getManualSet(contentLink)];

export const markEpisodesManuallyWatched = (
  contentLink: string,
  episodeLinks: readonly string[],
): void => {
  if (!contentLink || episodeLinks.length === 0) {
    return;
  }
  const next = [...new Set([
    ...getManuallyWatchedEpisodeLinks(contentLink),
    ...episodeLinks.filter(Boolean).map(link => sharedWatchEpisodeKey(contentLink, link)),
  ])];
  mainStorage.setArray(keyForContent(contentLink), next);
  const contents = mainStorage.getArray<string>(CONTENT_KEYS) || [];
  const key = sharedWatchContentKey(contentLink);
  if (!contents.includes(key)) {
    mainStorage.setArray(CONTENT_KEYS, [...contents, key]);
  }
};

export const setEpisodeManuallyWatched = (
  contentLink: string,
  episodeLink: string,
  watched: boolean,
): void => {
  if (!contentLink || !episodeLink) {
    return;
  }
  const key = keyForContent(contentLink);
  const current = getManualSet(contentLink);
  const episodeKey = sharedWatchEpisodeKey(contentLink, episodeLink);
  const next = [...current].filter(link => link !== episodeKey);
  if (watched) {
    next.push(episodeKey);
  }
  if (next.length > 0) {
    mainStorage.setArray(key, next);
  } else {
    mainStorage.delete(key);
  }
  const contents = mainStorage.getArray<string>(CONTENT_KEYS) || [];
  const contentKey = sharedWatchContentKey(contentLink);
  const nextContents = contents.filter(link => link !== contentKey);
  if (next.length > 0) {
    nextContents.push(contentKey);
  }
  mainStorage.setArray(CONTENT_KEYS, nextContents);
};

export const clearManualEpisodeCompletions = (contentLink: string): void => {
  if (!contentLink) {
    return;
  }
  for (const alias of relatedWatchContentLinks(contentLink)) {
    mainStorage.delete(`manualWatchedEpisodes_${alias}`);
  }
  mainStorage.delete(keyForContent(contentLink));
  const contents = mainStorage.getArray<string>(CONTENT_KEYS) || [];
  mainStorage.setArray(
    CONTENT_KEYS,
    contents.filter(link => !relatedWatchContentLinks(contentLink).includes(link)),
  );
};

export const clearAllManualEpisodeCompletions = (): void => {
  const contents = mainStorage.getArray<string>(CONTENT_KEYS) || [];
  contents.forEach(contentLink => mainStorage.delete(keyForContent(contentLink)));
  mainStorage.delete(CONTENT_KEYS);
};
