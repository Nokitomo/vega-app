import {mainStorage} from '../storage/StorageService';
import {WatchHistoryItem} from '../storage/WatchHistoryStorage';
import {
  getEpisodeProgressPercent,
  getEpisodeProgressSnapshot,
  WATCH_COMPLETION_PERCENT,
} from '../storage/ManualEpisodeCompletionStorage';
import {
  getSeriesCatalog,
  SeriesCatalogEpisode,
} from '../storage/SeriesCompletionStorage';

export type ContinueWatchingTarget = SeriesCatalogEpisode;

export type ContinueWatchingPresentation = {
  target?: ContinueWatchingTarget;
  progressPercent: number;
  hasNewEpisodes: boolean;
};

const getPlaybackProgress = (link: string): {episodeLink: string; updatedAt: number} => {
  try {
    const raw = mainStorage.getString(`watch_history_progress_${link}`);
    const parsed = raw ? JSON.parse(raw) : undefined;
    return {
      episodeLink: String(parsed?.episodeLink || ''),
      updatedAt: Number(parsed?.updatedAt) || 0,
    };
  } catch {
    return {episodeLink: '', updatedAt: 0};
  }
};

export const isLatestManualEpisodeMark = (item: WatchHistoryItem): boolean =>
  !!item.manualEpisodeLink &&
  getEpisodeProgressPercent(item.link, item.manualEpisodeLink) >= WATCH_COMPLETION_PERCENT &&
  (item.manualMarkedAt || 0) >= getPlaybackProgress(item.link).updatedAt;

export const getContinueWatchingPresentation = (
  item: WatchHistoryItem,
): ContinueWatchingPresentation => {
  const manualLatest = item.isSeries === true && isLatestManualEpisodeMark(item);
  const historyProgress = manualLatest ? 0 : getHistoryProgressPercent(item);
  if (item.isSeries !== true) {
    return {progressPercent: historyProgress, hasNewEpisodes: false};
  }

  const catalog = getSeriesCatalog(item.link);
  const episodes: SeriesCatalogEpisode[] = catalog?.episodes?.length
    ? catalog.episodes
    : catalog?.episodeLinks.map(link => ({link})) || [];
  if (episodes.length === 0) {
    return {progressPercent: historyProgress, hasNewEpisodes: false};
  }
  const episodeProgress = getEpisodeProgressSnapshot(
    item.link, episodes.map(episode => episode.link),
  );

  let lastEpisodeLink = manualLatest
    ? item.manualEpisodeLink || ''
    : getPlaybackProgress(item.link).episodeLink;
  let lastIndex = episodes.findIndex(episode => episode.link === lastEpisodeLink);
  if (lastIndex < 0 && item.episodeNumber != null) {
    lastIndex = episodes.findIndex(episode =>
      episode.episodeNumber === item.episodeNumber &&
      (item.seasonNumber == null || episode.seasonNumber === item.seasonNumber),
    );
    if (lastIndex >= 0) {
      lastEpisodeLink = episodes[lastIndex].link;
    }
  }

  const progressFor = (episode: SeriesCatalogEpisode) => {
    const recorded = episodeProgress.get(episode.link) || 0;
    return !manualLatest && episode.link === lastEpisodeLink
      ? Math.max(recorded, historyProgress)
      : recorded;
  };
  let target: SeriesCatalogEpisode | undefined;
  if (lastIndex >= 0 && progressFor(episodes[lastIndex]) < WATCH_COMPLETION_PERCENT) {
    target = episodes[lastIndex];
  } else if (lastIndex >= 0) {
    target = episodes.slice(lastIndex + 1).find(
      episode => progressFor(episode) < WATCH_COMPLETION_PERCENT,
    );
  }
  // If the viewer skipped an older episode, return to it only after reaching
  // the end of the known catalog.
  target ||= episodes.find(episode => progressFor(episode) < WATCH_COMPLETION_PERCENT);

  return {
    target,
    progressPercent: target ? progressFor(target) : 0,
    hasNewEpisodes: !!catalog?.newEpisodeLinks?.length,
  };
};

export const getHistoryProgressPercent = (item: WatchHistoryItem): number => {
  if (isLatestManualEpisodeMark(item)) {
    return 100;
  }
  try {
    const stored = mainStorage.getString(`watch_history_progress_${item.link}`);
    if (stored) {
      const progress = JSON.parse(stored);
      if (progress.percentage != null) {
        const percentage = Number(progress.percentage);
        if (Number.isFinite(percentage)) {
          return Math.min(Math.max(percentage, 0), 100);
        }
      }
      const currentTime = Number(progress.currentTime);
      const duration = Number(progress.duration);
      if (Number.isFinite(currentTime) && Number.isFinite(duration) && duration > 0) {
        return Math.min(Math.max((currentTime / duration) * 100, 0), 100);
      }
    }
  } catch {
    // Malformed progress must not hide a title.
  }
  const currentTime = Number(item.currentTime ?? item.progress);
  const duration = Number(item.duration);
  return Number.isFinite(currentTime) && Number.isFinite(duration) && duration > 0
    ? Math.min(Math.max((currentTime / duration) * 100, 0), 100)
    : 0;
};

export const selectContinueWatchingItems = (
  history: WatchHistoryItem[],
  limit: number,
  hiddenLinks: readonly string[] = [],
): WatchHistoryItem[] => {
  const seen = new Set<string>();
  const hidden = new Set(hiddenLinks);
  return history
    .filter(item => {
      if (seen.has(item.link) || hidden.has(item.link)) {
        return false;
      }
      seen.add(item.link);
      return true;
    })
    .map(item => ({item, catalog: item.isSeries === true ? getSeriesCatalog(item.link) : undefined}))
    .filter(({item, catalog}) =>
      item.isSeries === true
        ? catalog?.fullyWatched !== true
        : item.isSeries === false
          ? getHistoryProgressPercent(item) < WATCH_COMPLETION_PERCENT
          : true,
    )
    .map(({item, catalog}) => ({
      item,
      activityAt: Math.max(item.timestamp ?? item.lastPlayed ?? 0, catalog?.newEpisodesDetectedAt ?? 0),
    }))
    .sort((left, right) => right.activityAt - left.activityAt)
    .map(({item}) => item)
    .slice(0, limit);
};
