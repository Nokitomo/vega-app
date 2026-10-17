import {mainStorage} from '../storage/StorageService';
import {WatchHistoryItem} from '../storage/WatchHistoryStorage';
import {WATCH_COMPLETION_PERCENT} from '../storage/ManualEpisodeCompletionStorage';

export const getHistoryProgressPercent = (item: WatchHistoryItem): number => {
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
): WatchHistoryItem[] => {
  const seen = new Set<string>();
  return history
    .filter(item => {
      if (seen.has(item.link)) {
        return false;
      }
      seen.add(item.link);
      return true;
    })
    .filter(
      item =>
        item.isSeries !== false ||
        getHistoryProgressPercent(item) < WATCH_COMPLETION_PERCENT,
    )
    .slice(0, limit);
};
