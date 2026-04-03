import {create} from 'zustand';
import {WatchHistoryItem, watchHistoryStorage} from '../storage';
import {
  resolveProviderCardTitle,
  shouldResolveProviderCardTitle,
} from '../utils/providerCardTitleResolver';

export interface History {
  history: WatchHistoryItem[];
  addItem: (item: WatchHistoryItem) => void;
  updatePlaybackInfo: (
    link: string,
    playbackInfo: Partial<WatchHistoryItem>,
  ) => void;
  clearHistory: () => void;
  updateItemWithInfo: (link: string, infoData: any) => void;
  removeItem: (item: WatchHistoryItem) => void;
  migrateDisplayTitles: () => Promise<void>;
}

// Helper function to convert between our storage format and zustand format
const convertStorageToZustand = (items: any[]): WatchHistoryItem[] => {
  return items.map(item => ({
    ...item,
    lastPlayed: item.timestamp,
    currentTime: item.progress || 0,
  }));
};

const titleSyncInFlight = new Set<string>();
let titleMigrationInFlight: Promise<void> | null = null;

const refreshHistoryState = (set: (partial: Partial<History>) => void) => {
  set({
    history: convertStorageToZustand(watchHistoryStorage.getWatchHistory()),
  });
};

const getDisplayTitle = (item: WatchHistoryItem): string =>
  (item.displayTitle || item.title || '').trim();

const isLowConfidenceTitle = (value?: string): boolean => {
  const normalized = (value || '').trim();
  if (!normalized) {
    return true;
  }
  return !/[A-Za-z\u00C0-\u024F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/.test(
    normalized,
  );
};

const syncDisplayTitleForLink = async ({
  link,
  set,
}: {
  link?: string;
  set: (partial: Partial<History>) => void;
}) => {
  const normalizedLink = (link || '').trim();
  if (!normalizedLink || titleSyncInFlight.has(normalizedLink)) {
    return;
  }

  titleSyncInFlight.add(normalizedLink);
  try {
    const history = watchHistoryStorage.getWatchHistory();
    const targetItem = history.find(item => item.link === normalizedLink);
    if (!targetItem) {
      return;
    }

    if (!shouldResolveProviderCardTitle(targetItem.provider)) {
      return;
    }

    const currentDisplayTitle = getDisplayTitle(targetItem);
    const fallbackTitle = isLowConfidenceTitle(currentDisplayTitle)
      ? (targetItem.title || '').trim() || currentDisplayTitle
      : currentDisplayTitle;
    const resolvedDisplayTitle = (
      await resolveProviderCardTitle({
        providerValue: targetItem.provider,
        link: targetItem.link,
        fallbackTitle,
      })
    ).trim();

    if (!resolvedDisplayTitle || resolvedDisplayTitle === currentDisplayTitle) {
      return;
    }

    const nextHistory = history.map(item =>
      item.link === normalizedLink
        ? {
            ...item,
            displayTitle: resolvedDisplayTitle,
          }
        : item,
    );
    watchHistoryStorage.setWatchHistory(nextHistory);
    refreshHistoryState(set);
  } catch (error) {
    console.error('❌ Error syncing watch history display title:', error);
  } finally {
    titleSyncInFlight.delete(normalizedLink);
  }
};

const useWatchHistoryStore = create<History>(set => ({
  // Initialize from our storage service
  history: convertStorageToZustand(watchHistoryStorage.getWatchHistory()),

  addItem: item => {
    try {
      // Format item for our storage service
      const storageItem: WatchHistoryItem = {
        id: item.link || item.title,
        title: item.title,
        displayTitle: item.displayTitle || item.title,
        poster: item.poster,
        provider: item.provider,
        link: item.link,
        timestamp: Date.now(),
        duration: item.duration,
        progress: item.currentTime,
        episodeTitle: item.episodeTitle,
        episodeNumber: item.episodeNumber,
        seasonNumber: item.seasonNumber,
        cachedInfoData: item.cachedInfoData,
      };

      // Add to storage
      watchHistoryStorage.addToWatchHistory(storageItem);

      // Update UI state
      refreshHistoryState(set);

      syncDisplayTitleForLink({
        link: storageItem.link,
        set,
      }).catch(error => {
        console.error('❌ Error syncing watch history display title:', error);
      });
    } catch (error) {
      console.error('❌ Error:', error);
    }
  },

  updatePlaybackInfo: (link, playbackInfo) => {
    try {
      const history = watchHistoryStorage.getWatchHistory();
      const existingItem = history.find(item => item.link === link);

      if (existingItem) {
        const updatedItem = {
          ...existingItem,
          progress: playbackInfo.currentTime,
          duration: playbackInfo.duration || existingItem.duration,
          timestamp: Date.now(),
        };

        watchHistoryStorage.addToWatchHistory(updatedItem);
      }

      refreshHistoryState(set);
    } catch (error) {
      console.error('❌ Error updating watch history:', error);
    }
  },

  removeItem: item => {
    watchHistoryStorage.removeFromWatchHistory(item.link);
    watchHistoryStorage.clearProgressForLink(item.link);
    refreshHistoryState(set);
  },

  clearHistory: () => {
    const items = watchHistoryStorage.getWatchHistory();
    watchHistoryStorage.clearWatchHistory();
    items.forEach(item => {
      watchHistoryStorage.clearProgressForLink(item.link);
    });
    watchHistoryStorage.clearProgressKeys();
    set({history: []});
  },

  updateItemWithInfo: (link, infoData) => {
    try {
      const history = watchHistoryStorage.getWatchHistory();
      const existingItem = history.find(item => item.link === link);

      if (existingItem) {
        const updatedItem = {
          ...existingItem,
          cachedInfoData: infoData,
        };

        watchHistoryStorage.addToWatchHistory(updatedItem);
      }

      refreshHistoryState(set);
    } catch (error) {
      console.error('❌ Error caching info data:', error);
    }
  },

  migrateDisplayTitles: async () => {
    if (titleMigrationInFlight) {
      await titleMigrationInFlight;
      return;
    }

    titleMigrationInFlight = (async () => {
      const uniqueLinks = new Set<string>();
      const history = watchHistoryStorage.getWatchHistory();

      for (const item of history) {
        if (!item?.link || uniqueLinks.has(item.link)) {
          continue;
        }
        uniqueLinks.add(item.link);

        if (!shouldResolveProviderCardTitle(item.provider)) {
          continue;
        }

        await syncDisplayTitleForLink({
          link: item.link,
          set,
        });
      }
    })()
      .catch(error => {
        console.error('❌ Error migrating watch history display titles:', error);
      })
      .finally(() => {
        titleMigrationInFlight = null;
      });

    await titleMigrationInFlight;
  },
}));

export default useWatchHistoryStore;
