import {mainStorage} from './StorageService';
import {
  getEpisodeProgressSnapshot,
  WATCH_COMPLETION_PERCENT,
} from './ManualEpisodeCompletionStorage';
import {
  clearSharedEpisodeProgress,
  readSharedEpisodeProgress,
  sharedEpisodeProgressKey,
} from './SharedAnimeEpisodeProgressStorage';
import {
  relatedWatchContentLinks,
  sharedWatchContentKey,
  sharedWatchEpisodeKey,
} from './SharedAnimeWatchIdentity';

export type SeriesCatalogEpisode = {
  link: string;
  episodeNumber?: number;
  seasonNumber?: number;
  seasonEpisodesLink?: string;
  title?: string;
};

export type SeriesCatalog = {
  episodeLinks: string[];
  episodes?: SeriesCatalogEpisode[];
  complete: boolean;
  fullyWatched: boolean;
  updatedAt: number;
  newEpisodeLinks?: string[];
  newEpisodesDetectedAt?: number;
};

type EpisodeProgress = Record<string, number>;

const catalogKey = (contentLink: string) => `seriesCatalog_${contentLink}`;
const progressKey = (contentLink: string) =>
  sharedEpisodeProgressKey(contentLink);
const CATALOG_KEYS = 'seriesCatalogContentLinks';
const completionRevisions = new Map<string, string>();

const readCatalog = (contentLink: string): SeriesCatalog | undefined =>
  mainStorage.getObject<SeriesCatalog>(catalogKey(contentLink));

export const getSeriesCatalog = (contentLink: string): SeriesCatalog | undefined => {
  if (sharedWatchContentKey(contentLink) !== contentLink) {
    const revision = () => [
      mainStorage.getKeyRevision(catalogKey(contentLink)),
      mainStorage.getKeyRevision(progressKey(contentLink)),
      mainStorage.getKeyRevision(`manualWatchedEpisodes_${sharedWatchContentKey(contentLink)}`),
      mainStorage.getKeyRevision('watchHistory'),
      mainStorage.getKeyRevision('manualWatchedEpisodeContents'),
      mainStorage.getKeyRevision(CATALOG_KEYS),
      mainStorage.getKeyRevision('watchHistoryEpisodeKeys'),
    ].join(':');
    if (completionRevisions.get(contentLink) !== revision()) {
      recomputeSeriesCompletion(contentLink);
      completionRevisions.set(contentLink, revision());
    }
  }
  return readCatalog(contentLink);
};

const readProgress = (contentLink: string): EpisodeProgress =>
  readSharedEpisodeProgress(contentLink);

const trackContent = (contentLink: string): void => {
  const contents = mainStorage.getArray<string>(CATALOG_KEYS) || [];
  if (!contents.includes(contentLink)) {
    mainStorage.setArray(CATALOG_KEYS, [...contents, contentLink]);
  }
};

export const recomputeSeriesCompletion = (contentLink: string): boolean => {
  const catalog = readCatalog(contentLink);
  if (!catalog) {
    return false;
  }
  const progress = getEpisodeProgressSnapshot(contentLink, [
    ...catalog.episodeLinks,
    ...(catalog.newEpisodeLinks || []),
  ]);
  const fullyWatched =
    catalog.complete &&
    catalog.episodeLinks.length > 0 &&
    catalog.episodeLinks.every(episodeLink =>
      (progress.get(episodeLink) || 0) >= WATCH_COMPLETION_PERCENT);
  const newEpisodeStarted = catalog.newEpisodeLinks?.some(
    link => (progress.get(link) || 0) > 0,
  );
  if (catalog.fullyWatched !== fullyWatched || newEpisodeStarted) {
    mainStorage.setObject(catalogKey(contentLink), {
      ...catalog,
      fullyWatched,
      newEpisodeLinks: newEpisodeStarted ? [] : catalog.newEpisodeLinks,
      newEpisodesDetectedAt: newEpisodeStarted
        ? undefined
        : catalog.newEpisodesDetectedAt,
    });
  }
  return fullyWatched;
};

export const isSeriesComplete = (contentLink: string): boolean =>
  getSeriesCatalog(contentLink)?.fullyWatched === true;

export const setSeriesCatalog = (
  contentLink: string,
  episodeLinks: Array<string | SeriesCatalogEpisode>,
  complete: boolean,
): void => {
  if (!contentLink) {
    return;
  }
  const seen = new Set<string>();
  const episodes = episodeLinks
    .map(episode => typeof episode === 'string' ? {link: episode} : episode)
    .filter(episode => {
      if (!episode?.link || seen.has(episode.link)) {
        return false;
      }
      seen.add(episode.link);
      return true;
    });
  const uniqueLinks = episodes.map(episode => episode.link);
  const previous = readCatalog(contentLink);
  const unchangedEpisodes = previous?.episodes?.length === episodes.length &&
    previous.episodes.every((episode, index) =>
      episode.link === episodes[index].link &&
      episode.episodeNumber === episodes[index].episodeNumber &&
      episode.seasonNumber === episodes[index].seasonNumber &&
      episode.seasonEpisodesLink === episodes[index].seasonEpisodesLink &&
      episode.title === episodes[index].title,
    );
  if (
    previous?.complete === complete &&
    previous.episodeLinks.length === uniqueLinks.length &&
    previous.episodeLinks.every((link, index) => link === uniqueLinks[index]) &&
    unchangedEpisodes
  ) {
    return;
  }
  const previousLinks = new Set(previous?.episodeLinks || []);
  const added = previous?.complete && complete && previousLinks.size > 0
    ? uniqueLinks.filter(link => !previousLinks.has(link))
    : [];
  const newEpisodeLinks = [
    ...(previous?.newEpisodeLinks || []).filter(link => seen.has(link)),
    ...added,
  ];
  mainStorage.setObject(catalogKey(contentLink), {
    episodeLinks: uniqueLinks,
    episodes,
    complete,
    fullyWatched: false,
    updatedAt: Date.now(),
    newEpisodeLinks: [...new Set(newEpisodeLinks)],
    newEpisodesDetectedAt: added.length > 0
      ? Date.now()
      : newEpisodeLinks.length > 0
        ? previous?.newEpisodesDetectedAt
        : undefined,
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
  const episodeKey = sharedWatchEpisodeKey(contentLink, episodeLink);
  if (Math.abs((progress[episodeKey] ?? -1) - percentage) < 0.5 &&
      (progress[episodeKey] >= WATCH_COMPLETION_PERCENT) ===
        (percentage >= WATCH_COMPLETION_PERCENT)) {
    return;
  }
  progress[episodeKey] = percentage;
  mainStorage.setObject(progressKey(contentLink), progress);
  trackContent(contentLink);
  recomputeSeriesCompletion(contentLink);
};

export const clearEpisodePlaybackProgress = (
  contentLink: string,
  episodeLink: string,
): void => {
  const progress = readProgress(contentLink);
  const episodeKey = sharedWatchEpisodeKey(contentLink, episodeLink);
  if (sharedWatchContentKey(contentLink) !== contentLink) {
    progress[episodeKey] = 0;
    mainStorage.setObject(progressKey(contentLink), progress);
  } else if (episodeKey in progress) {
    delete progress[episodeKey];
    mainStorage.setObject(progressKey(contentLink), progress);
  }
  recomputeSeriesCompletion(contentLink);
};

export const clearSeriesCompletion = (contentLink: string): void => {
  const aliases = relatedWatchContentLinks(contentLink);
  aliases.forEach(link => mainStorage.delete(catalogKey(link)));
  clearSharedEpisodeProgress(contentLink);
  const contents = mainStorage.getArray<string>(CATALOG_KEYS) || [];
  mainStorage.setArray(CATALOG_KEYS, contents.filter(link => !aliases.includes(link)));
};

export const clearAllSeriesCompletions = (): void => {
  const contents = mainStorage.getArray<string>(CATALOG_KEYS) || [];
  contents.forEach(contentLink => {
    mainStorage.delete(catalogKey(contentLink));
    clearSharedEpisodeProgress(contentLink);
  });
  mainStorage.delete(CATALOG_KEYS);
};
