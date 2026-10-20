import type {WatchHistoryItem} from '../storage/WatchHistoryStorage';
import {mainStorage} from '../storage/StorageService';
import {isLatestManualEpisodeMark} from './continueWatching';
import {getWatchProgressString, watchProgressKey} from '../storage/SharedAnimeWatchIdentity';

const clamp = (value: number): number => Math.min(Math.max(value, 0), 100);

/** Read progress only for a card that the virtualized history list renders. */
export const getWatchHistoryCardProgress = (item: WatchHistoryItem): number => {
  if (isLatestManualEpisodeMark(item)) {
    return 100;
  }
  try {
    const stored = getWatchProgressString(item.link);
    if (stored) {
      const progress = JSON.parse(stored);
      if (Number.isFinite(Number(progress.percentage))) {
        return clamp(Number(progress.percentage));
      }
      if (Number(progress.duration) > 0 && Number.isFinite(Number(progress.currentTime))) {
        return clamp(Number(progress.currentTime) / Number(progress.duration) * 100);
      }
    }
    if (item.episodeTitle) {
      const episodeKey = `${watchProgressKey(item.link)}_${item.episodeTitle.replace(/\s+/g, '_')}`;
      const episode = mainStorage.getString(episodeKey);
      if (episode) {
        const percentage = Number(JSON.parse(episode).percentage);
        if (Number.isFinite(percentage)) {
          return clamp(percentage);
        }
      }
    }
    const cached = mainStorage.getString(item.link);
    if (cached) {
      const progress = JSON.parse(cached);
      if (Number(progress.duration) > 0 && Number.isFinite(Number(progress.position))) {
        return clamp(Number(progress.position) / Number(progress.duration) * 100);
      }
    }
    const currentTime = Number(item.currentTime ?? item.progress);
    const duration = Number(item.duration);
    return Number.isFinite(currentTime) && Number.isFinite(duration) && duration > 0
      ? clamp(currentTime / duration * 100)
      : 0;
  } catch {
    return 0;
  }
};
