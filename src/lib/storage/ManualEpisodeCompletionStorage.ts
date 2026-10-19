import {cacheStorage, mainStorage} from './StorageService';
import {watchHistoryStorage} from './WatchHistoryStorage';

export const WATCH_COMPLETION_PERCENT = 95;
export const SERIES_EPISODE_PROGRESS_PREFIX = 'seriesEpisodeProgress_';

const keyForContent = (contentLink: string) =>
  `manualWatchedEpisodes_${contentLink}`;
const CONTENT_KEYS = 'manualWatchedEpisodeContents';

export const isEpisodeManuallyWatched = (
  contentLink: string,
  episodeLink: string,
): boolean =>
  !!mainStorage
    .getArray<string>(keyForContent(contentLink))
    ?.includes(episodeLink);

export const getEpisodeProgressPercent = (
  contentLink: string,
  episodeLink: string,
): number => {
  if (isEpisodeManuallyWatched(contentLink, episodeLink)) {
    return 100;
  }
  const recorded = mainStorage.getObject<Record<string, number>>(
    `${SERIES_EPISODE_PROGRESS_PREFIX}${contentLink}`,
  )?.[episodeLink];
  if (Number.isFinite(recorded)) {
    return Math.min(Math.max(recorded!, 0), 100);
  }
  // Legacy manual marks wrote an untracked 1/1 cache entry. After clearing
  // history that entry must never make the episode appear watched again.
  if (!watchHistoryStorage.getEpisodeKeys(contentLink).includes(episodeLink)) {
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
  const manual = new Set(getManuallyWatchedEpisodeLinks(contentLink));
  const recorded = mainStorage.getObject<Record<string, number>>(
    `${SERIES_EPISODE_PROGRESS_PREFIX}${contentLink}`,
  ) || {};
  const tracked = new Set(watchHistoryStorage.getEpisodeKeys(contentLink));
  const result = new Map<string, number>();
  for (const link of episodeLinks) {
    if (manual.has(link)) {
      result.set(link, 100);
    } else if (Number.isFinite(recorded[link])) {
      result.set(link, Math.min(Math.max(recorded[link], 0), 100));
    } else if (!tracked.has(link)) {
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
  mainStorage.getArray<string>(keyForContent(contentLink)) || [];

export const markEpisodesManuallyWatched = (
  contentLink: string,
  episodeLinks: readonly string[],
): void => {
  if (!contentLink || episodeLinks.length === 0) {
    return;
  }
  const next = [...new Set([
    ...getManuallyWatchedEpisodeLinks(contentLink),
    ...episodeLinks.filter(Boolean),
  ])];
  mainStorage.setArray(keyForContent(contentLink), next);
  const contents = mainStorage.getArray<string>(CONTENT_KEYS) || [];
  if (!contents.includes(contentLink)) {
    mainStorage.setArray(CONTENT_KEYS, [...contents, contentLink]);
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
  const current = mainStorage.getArray<string>(key) || [];
  const next = current.filter(link => link !== episodeLink);
  if (watched) {
    next.push(episodeLink);
  }
  if (next.length > 0) {
    mainStorage.setArray(key, next);
  } else {
    mainStorage.delete(key);
  }
  const contents = mainStorage.getArray<string>(CONTENT_KEYS) || [];
  const nextContents = contents.filter(link => link !== contentLink);
  if (next.length > 0) {
    nextContents.push(contentLink);
  }
  mainStorage.setArray(CONTENT_KEYS, nextContents);
};

export const clearManualEpisodeCompletions = (contentLink: string): void => {
  if (!contentLink) {
    return;
  }
  mainStorage.delete(keyForContent(contentLink));
  const contents = mainStorage.getArray<string>(CONTENT_KEYS) || [];
  mainStorage.setArray(
    CONTENT_KEYS,
    contents.filter(link => link !== contentLink),
  );
};

export const clearAllManualEpisodeCompletions = (): void => {
  const contents = mainStorage.getArray<string>(CONTENT_KEYS) || [];
  contents.forEach(contentLink => mainStorage.delete(keyForContent(contentLink)));
  mainStorage.delete(CONTENT_KEYS);
};
