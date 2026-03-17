import {cacheStorage, mainStorage} from './StorageService';

/**
 * Storage keys for watch history
 */
export enum WatchHistoryKeys {
  WATCH_HISTORY = 'watchHistory',
  SERIES_EPISODES = 'seriesEpisodes',
  WATCH_HISTORY_PROGRESS_KEYS = 'watchHistoryProgressKeys',
  WATCH_HISTORY_EPISODE_KEYS = 'watchHistoryEpisodeKeys',
}

/**
 * Interface for watch history item
 */
export interface WatchHistoryItem {
  id: string;
  title: string;
  displayTitle?: string;
  poster?: string;
  provider?: string;
  link: string;
  timestamp?: number;
  duration?: number;
  progress?: number;
  isSeries?: boolean;
  lastPlayed?: number;
  currentTime?: number;
  playbackRate?: number;
  episodeTitle?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  cachedInfoData?: any; // Add cached info data
}

/**
 * Interface for series episode
 */
export interface SeriesEpisode {
  uri: string;
  size: number;
  thumbnail?: string;
}

/**
 * Watch history storage manager
 */
export class WatchHistoryStorage {
  /**
   * Get all watch history items
   */
  getWatchHistory(): WatchHistoryItem[] {
    return (
      mainStorage.getArray<WatchHistoryItem>(WatchHistoryKeys.WATCH_HISTORY) ||
      []
    );
  }

  /**
   * Replace the whole watch history list.
   */
  setWatchHistory(items: WatchHistoryItem[]): void {
    const limitedHistory = (items || []).slice(0, 100);
    mainStorage.setArray(WatchHistoryKeys.WATCH_HISTORY, limitedHistory);
  }

  /**
   * Add or update an item in watch history
   */
  addToWatchHistory(item: WatchHistoryItem): void {
    const history = this.getWatchHistory();
    const normalizedDisplayTitle =
      item.displayTitle?.trim() || item.title?.trim() || undefined;

    // Check if the item already exists
    const existingIndex = history.findIndex(i => i.id === item.id);

    if (existingIndex !== -1) {
      // Update existing item
      history[existingIndex] = {
        ...history[existingIndex],
        ...item,
        displayTitle:
          normalizedDisplayTitle ||
          history[existingIndex].displayTitle ||
          history[existingIndex].title,
        timestamp: Date.now(), // Always update timestamp
      };
    } else {
      // Add new item
      history.unshift({
        ...item,
        displayTitle: normalizedDisplayTitle || item.title,
        timestamp: Date.now(),
      });
    }

    this.setWatchHistory(history);
  }

  /**
   * Remove an item from watch history
   */
  removeFromWatchHistory(id: string): void {
    const history = this.getWatchHistory();
    const filteredHistory = history.filter(item => item.id !== id);
    mainStorage.setArray(WatchHistoryKeys.WATCH_HISTORY, filteredHistory);
  }

  /**
   * Clear all watch history
   */
  clearWatchHistory(): void {
    mainStorage.setArray(WatchHistoryKeys.WATCH_HISTORY, []);
  }

  /**
   * Track progress keys for cleanup.
   */
  addProgressKey(key: string): void {
    if (!key) {
      return;
    }
    const keys = this.getProgressKeys();
    if (keys.includes(key)) {
      return;
    }
    keys.push(key);
    mainStorage.setArray(WatchHistoryKeys.WATCH_HISTORY_PROGRESS_KEYS, keys);
  }

  /**
   * Return all tracked progress keys.
   */
  getProgressKeys(): string[] {
    return (
      mainStorage.getArray<string>(
        WatchHistoryKeys.WATCH_HISTORY_PROGRESS_KEYS,
      ) || []
    );
  }

  /**
   * Track episode cache keys per content link.
   */
  addEpisodeKey(link: string, episodeLink: string): void {
    if (!link || !episodeLink) {
      return;
    }
    const map =
      mainStorage.getObject<Record<string, string[]>>(
        WatchHistoryKeys.WATCH_HISTORY_EPISODE_KEYS,
      ) || {};
    const list = map[link] || [];
    if (!list.includes(episodeLink)) {
      list.push(episodeLink);
      map[link] = list;
      mainStorage.setObject(WatchHistoryKeys.WATCH_HISTORY_EPISODE_KEYS, map);
    }
  }

  /**
   * Return tracked episode cache keys for a content link.
   */
  getEpisodeKeys(link: string): string[] {
    const map =
      mainStorage.getObject<Record<string, string[]>>(
        WatchHistoryKeys.WATCH_HISTORY_EPISODE_KEYS,
      ) || {};
    return map[link] || [];
  }

  /**
   * Remove tracked episode cache keys for a content link.
   */
  clearEpisodeKeys(link: string): void {
    if (!link) {
      return;
    }
    const map =
      mainStorage.getObject<Record<string, string[]>>(
        WatchHistoryKeys.WATCH_HISTORY_EPISODE_KEYS,
      ) || {};
    const keys = map[link] || [];
    keys.forEach(key => {
      cacheStorage.delete(key);
    });
    if (link in map) {
      delete map[link];
      mainStorage.setObject(WatchHistoryKeys.WATCH_HISTORY_EPISODE_KEYS, map);
    }
  }

  /**
   * Remove all progress keys related to a specific content link.
   */
  removeProgressKeysForLink(link: string): void {
    if (!link) {
      return;
    }
    const prefix = `watch_history_progress_${link}`;
    const keys = this.getProgressKeys();
    const remaining: string[] = [];
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        mainStorage.delete(key);
        return;
      }
      remaining.push(key);
    });
    mainStorage.setArray(WatchHistoryKeys.WATCH_HISTORY_PROGRESS_KEYS, remaining);
  }

  /**
   * Clear progress data for a content link (base key + cache + tracked keys).
   */
  clearProgressForLink(link: string): void {
    if (!link) {
      return;
    }
    const baseKey = `watch_history_progress_${link}`;
    mainStorage.delete(baseKey);
    cacheStorage.delete(link);
    this.clearEpisodeKeys(link);
    this.removeProgressKeysForLink(link);
  }

  /**
   * Clear all tracked progress keys.
   */
  clearProgressKeys(): void {
    const keys = this.getProgressKeys();
    keys.forEach(key => {
      mainStorage.delete(key);
    });
    mainStorage.setArray(WatchHistoryKeys.WATCH_HISTORY_PROGRESS_KEYS, []);
  }

  /**
   * Update progress for a specific item
   */
  updateProgress(id: string, progress: number, duration?: number): void {
    const history = this.getWatchHistory();
    const existingIndex = history.findIndex(i => i.id === id);

    if (existingIndex !== -1) {
      history[existingIndex] = {
        ...history[existingIndex],
        progress,
        duration,
        timestamp: Date.now(),
      };

      mainStorage.setArray(WatchHistoryKeys.WATCH_HISTORY, history);
    }
  }

  /**
   * Get series episodes
   */
  getSeriesEpisodes(seriesId: string): Record<string, SeriesEpisode> {
    const allSeries =
      mainStorage.getObject<Record<string, Record<string, SeriesEpisode>>>(
        WatchHistoryKeys.SERIES_EPISODES,
      ) || {};

    return allSeries[seriesId] || {};
  }

  /**
   * Add or update series episodes
   */
  addSeriesEpisodes(
    seriesId: string,
    episodes: Record<string, SeriesEpisode>,
  ): void {
    const allSeries =
      mainStorage.getObject<Record<string, Record<string, SeriesEpisode>>>(
        WatchHistoryKeys.SERIES_EPISODES,
      ) || {};

    allSeries[seriesId] = {
      ...allSeries[seriesId],
      ...episodes,
    };

    mainStorage.setObject(WatchHistoryKeys.SERIES_EPISODES, allSeries);
  }

  /**
   * Remove series episodes
   */
  removeSeriesEpisodes(seriesId: string): void {
    const allSeries =
      mainStorage.getObject<Record<string, Record<string, SeriesEpisode>>>(
        WatchHistoryKeys.SERIES_EPISODES,
      ) || {};

    delete allSeries[seriesId];

    mainStorage.setObject(WatchHistoryKeys.SERIES_EPISODES, allSeries);
  }
}

// Export a singleton instance
export const watchHistoryStorage = new WatchHistoryStorage();
