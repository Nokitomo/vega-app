import {cacheStorage, mainStorage} from './StorageService';

export const WATCH_COMPLETION_PERCENT = 95;

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
