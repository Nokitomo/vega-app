import {cacheStorage, mainStorage} from './StorageService';
import {
  relatedWatchContentLinks,
  sameWatchContent,
  sharedWatchContentKey,
  sharedWatchEpisodeKey,
  watchProgressKey,
} from './SharedAnimeWatchIdentity';

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
  manualEpisodeLink?: string;
  manualMarkedAt?: number;
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
    const stored = mainStorage.getArray<WatchHistoryItem>(WatchHistoryKeys.WATCH_HISTORY) || [];
    const seen = new Set<string>();
    const duplicate = stored.some(item => {
      const key = sharedWatchContentKey(item.link);
      if (seen.has(key)) {return true;}
      seen.add(key);
      return false;
    });
    if (!duplicate) {return stored;}
    seen.clear();
    const history = [...stored]
      .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
      .filter(item => {
        const key = sharedWatchContentKey(item.link);
        if (seen.has(key)) {return false;}
        seen.add(key);
        return true;
      });
    this.setWatchHistory(history);
    return history;
  }

  /**
   * Replace the whole watch history list.
   */
  setWatchHistory(items: WatchHistoryItem[]): void {
    mainStorage.setArray(WatchHistoryKeys.WATCH_HISTORY, items || []);
  }

  /**
   * Add or update an item in watch history
   */
  addToWatchHistory(item: WatchHistoryItem): void {
    const history = this.getWatchHistory();
    const normalizedDisplayTitle =
      item.displayTitle?.trim() || item.title?.trim() || undefined;

    // Check if the item already exists
    const existingIndex = history.findIndex(i =>
      sameWatchContent(i.link, item.link) || i.id === item.id);

    if (existingIndex !== -1) {
      // Update existing item
      const updatedItem = {
        ...history[existingIndex],
        ...item,
        displayTitle:
          normalizedDisplayTitle ||
          history[existingIndex].displayTitle ||
          history[existingIndex].title,
        timestamp: Date.now(), // Always update timestamp
      };
      history.splice(existingIndex, 1);
      // Legacy entries can have another ID for the same content link.
      for (let index = history.length - 1; index >= 0; index--) {
        if (sameWatchContent(history[index].link, item.link)) {
          history.splice(index, 1);
        }
      }
      history.unshift(updatedItem);
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
    const filteredHistory = history.filter(item =>
      item.id !== id && !sameWatchContent(item.link, id));
    mainStorage.setArray(WatchHistoryKeys.WATCH_HISTORY, filteredHistory);
  }

  /** Remove every saved entry for the selected content links, including legacy IDs. */
  removeFromWatchHistoryLinks(links: readonly string[]): void {
    const selected = new Set(links);
    if (selected.size === 0) {
      return;
    }
    this.setWatchHistory(
      this.getWatchHistory().filter(item =>
        ![...selected].some(link => sameWatchContent(item.link, link))),
    );
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
    const contentKey = sharedWatchContentKey(link);
    const episodeKey = sharedWatchEpisodeKey(link, episodeLink);
    const list = map[contentKey] || [];
    if (!list.includes(episodeKey)) {
      list.push(episodeKey);
      map[contentKey] = list;
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
    const key = sharedWatchContentKey(link);
    const episodes = new Set(map[key] || []);
    let migrated = false;
    for (const alias of relatedWatchContentLinks(link)) {
      if (alias === key || !map[alias]) {continue;}
      map[alias].forEach(episode => episodes.add(sharedWatchEpisodeKey(link, episode)));
      delete map[alias];
      migrated = true;
    }
    if (migrated || episodes.size !== (map[key] || []).length) {
      map[key] = [...episodes];
      mainStorage.setObject(WatchHistoryKeys.WATCH_HISTORY_EPISODE_KEYS, map);
    }
    return [...episodes];
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
    const aliases = relatedWatchContentLinks(link);
    const keys = aliases.flatMap(alias => map[alias] || []);
    keys.forEach(key => {
      cacheStorage.delete(key);
    });
    if (aliases.some(alias => alias in map)) {
      aliases.forEach(alias => delete map[alias]);
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
    const prefixes = relatedWatchContentLinks(link).map(alias =>
      `watch_history_progress_${alias}`);
    const otherPrefixes = this.getWatchHistory()
      .filter(item => item.link && item.link !== link)
      .map(item => watchProgressKey(item.link));
    const keys = this.getProgressKeys();
    const remaining: string[] = [];
    keys.forEach(key => {
      const belongsToAnotherTitle = otherPrefixes.some(other =>
        key === other || key.startsWith(`${other}_`),
      );
      if (!belongsToAnotherTitle && prefixes.some(prefix =>
        key === prefix || key.startsWith(`${prefix}_`))) {
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
    const baseKey = watchProgressKey(link);
    mainStorage.delete(baseKey);
    for (const alias of relatedWatchContentLinks(link)) {
      mainStorage.delete(`watch_history_progress_${alias}`);
    }
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
