import {cacheStorage, mainStorage} from './StorageService';
import {
  isEpisodeManuallyWatched,
  SERIES_EPISODE_PROGRESS_PREFIX,
  WATCH_COMPLETION_PERCENT,
} from './ManualEpisodeCompletionStorage';

type SeriesCatalog = {
  episodeLinks: string[];
  complete: boolean;
  fullyWatched: boolean;
  updatedAt: number;
};

type EpisodeProgress = Record<string, number>;

const catalogKey = (contentLink: string) => `seriesCatalog_${contentLink}`;
const progressKey = (contentLink: string) =>
  `${SERIES_EPISODE_PROGRESS_PREFIX}${contentLink}`;
const CATALOG_KEYS = 'seriesCatalogContentLinks';

const readCatalog = (contentLink: string): SeriesCatalog | undefined =>
  mainStorage.getObject<SeriesCatalog>(catalogKey(contentLink));

const readProgress = (contentLink: string): EpisodeProgress =>
  mainStorage.getObject<EpisodeProgress>(progressKey(contentLink)) || {};

const trackContent = (contentLink: string): void => {
  const contents = mainStorage.getArray<string>(CATALOG_KEYS) || [];
  if (!contents.includes(contentLink)) {
    mainStorage.setArray(CATALOG_KEYS, [...contents, contentLink]);
  }
};

const percentageFromCache = (episodeLink: string): number => {
  try {
    const value = JSON.parse(cacheStorage.getString(episodeLink) || '{}');
    const position = Number(value.position);
    const duration = Number(value.duration);
    return Number.isFinite(position) && Number.isFinite(duration) && duration > 0
      ? Math.min(Math.max((position / duration) * 100, 0), 100)
      : 0;
  } catch {
    return 0;
  }
};

export const recomputeSeriesCompletion = (contentLink: string): boolean => {
  const catalog = readCatalog(contentLink);
  if (!catalog) {
    return false;
  }
  const progress = readProgress(contentLink);
  const fullyWatched =
    catalog.complete &&
    catalog.episodeLinks.length > 0 &&
    catalog.episodeLinks.every(
      episodeLink =>
        isEpisodeManuallyWatched(contentLink, episodeLink) ||
        (progress[episodeLink] ?? percentageFromCache(episodeLink)) >=
          WATCH_COMPLETION_PERCENT,
    );
  if (catalog.fullyWatched !== fullyWatched) {
    mainStorage.setObject(catalogKey(contentLink), {...catalog, fullyWatched});
  }
  return fullyWatched;
};

export const isSeriesComplete = (contentLink: string): boolean =>
  readCatalog(contentLink)?.fullyWatched === true;

export const setSeriesCatalog = (
  contentLink: string,
  episodeLinks: string[],
  complete: boolean,
): void => {
  if (!contentLink) {
    return;
  }
  const uniqueLinks = [...new Set(episodeLinks.filter(Boolean))];
  const previous = readCatalog(contentLink);
  if (
    previous?.complete === complete &&
    previous.episodeLinks.length === uniqueLinks.length &&
    previous.episodeLinks.every((link, index) => link === uniqueLinks[index])
  ) {
    return;
  }
  mainStorage.setObject(catalogKey(contentLink), {
    episodeLinks: uniqueLinks,
    complete,
    fullyWatched: false,
    updatedAt: Date.now(),
  } satisfies SeriesCatalog);
  trackContent(contentLink);
  recomputeSeriesCompletion(contentLink);
};

export const recordEpisodePlaybackProgress = (
  contentLink: string,
  episodeLink: string,
  currentTime: number,
  duration: number,
): void => {
  if (!contentLink || !episodeLink || !Number.isFinite(currentTime) ||
      !Number.isFinite(duration) || duration <= 0) {
    return;
  }
  const percentage = Math.min(Math.max((currentTime / duration) * 100, 0), 100);
  const progress = readProgress(contentLink);
  if (Math.abs((progress[episodeLink] ?? -1) - percentage) < 0.5 &&
      (progress[episodeLink] >= WATCH_COMPLETION_PERCENT) ===
        (percentage >= WATCH_COMPLETION_PERCENT)) {
    return;
  }
  progress[episodeLink] = percentage;
  mainStorage.setObject(progressKey(contentLink), progress);
  trackContent(contentLink);
  recomputeSeriesCompletion(contentLink);
};

export const clearEpisodePlaybackProgress = (
  contentLink: string,
  episodeLink: string,
): void => {
  const progress = readProgress(contentLink);
  if (episodeLink in progress) {
    delete progress[episodeLink];
    mainStorage.setObject(progressKey(contentLink), progress);
  }
  recomputeSeriesCompletion(contentLink);
};

export const clearSeriesCompletion = (contentLink: string): void => {
  mainStorage.delete(catalogKey(contentLink));
  mainStorage.delete(progressKey(contentLink));
  const contents = mainStorage.getArray<string>(CATALOG_KEYS) || [];
  mainStorage.setArray(CATALOG_KEYS, contents.filter(link => link !== contentLink));
};

export const clearAllSeriesCompletions = (): void => {
  const contents = mainStorage.getArray<string>(CATALOG_KEYS) || [];
  contents.forEach(contentLink => {
    mainStorage.delete(catalogKey(contentLink));
    mainStorage.delete(progressKey(contentLink));
  });
  mainStorage.delete(CATALOG_KEYS);
};
