import {beforeEach, expect, it} from '@jest/globals';
import {cacheStorage, mainStorage} from '../src/lib/storage/StorageService';
import {WatchHistoryStorage} from '../src/lib/storage/WatchHistoryStorage';
import {
  getEpisodeProgressPercent,
  setEpisodeManuallyWatched,
  clearAllManualEpisodeCompletions,
} from '../src/lib/storage/ManualEpisodeCompletionStorage';
import {selectContinueWatchingItems} from '../src/lib/utils/continueWatching';

const item = (link: string, isSeries = false) => ({
  id: link,
  link,
  title: link,
  isSeries,
});

beforeEach(() => {
  mainStorage.clearAll();
  cacheStorage.clearAll();
});

it('moves a resumed title to the front without duplicating it', () => {
  const storage = new WatchHistoryStorage();
  storage.addToWatchHistory(item('first'));
  storage.addToWatchHistory(item('second'));
  storage.addToWatchHistory({...item('first'), progress: 12, duration: 90});

  expect(storage.getWatchHistory().map(entry => entry.link)).toEqual([
    'first',
    'second',
  ]);
  expect(storage.getWatchHistory()[0].progress).toBe(12);
});

it('keeps a manually watched episode complete after cache is cleared', () => {
  setEpisodeManuallyWatched('show', 'episode-6', true);
  cacheStorage.clearAll();
  expect(getEpisodeProgressPercent('show', 'episode-6')).toBe(100);

  setEpisodeManuallyWatched('show', 'episode-6', false);
  expect(getEpisodeProgressPercent('show', 'episode-6')).toBe(0);
  clearAllManualEpisodeCompletions();
});

it('excludes completed movies before the Home limit and retains history', () => {
  const storage = new WatchHistoryStorage();
  storage.setWatchHistory([
    item('movie-complete'),
    item('series', true),
    item('movie-active'),
  ]);
  mainStorage.setString(
    'watch_history_progress_movie-complete',
    JSON.stringify({percentage: 95}),
  );
  mainStorage.setString(
    'watch_history_progress_series',
    JSON.stringify({percentage: 100}),
  );
  mainStorage.setString(
    'watch_history_progress_movie-active',
    JSON.stringify({percentage: 94}),
  );

  expect(
    selectContinueWatchingItems(storage.getWatchHistory(), 2).map(
      entry => entry.link,
    ),
  ).toEqual(['series', 'movie-active']);
  expect(storage.getWatchHistory()).toHaveLength(3);
});
