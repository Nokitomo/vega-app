import {beforeEach, expect, it} from '@jest/globals';
import {cacheStorage, mainStorage} from '../src/lib/storage/StorageService';
import {WatchHistoryStorage} from '../src/lib/storage/WatchHistoryStorage';
import {
  getEpisodeProgressPercent,
  setEpisodeManuallyWatched,
  clearAllManualEpisodeCompletions,
} from '../src/lib/storage/ManualEpisodeCompletionStorage';
import {selectContinueWatchingItems} from '../src/lib/utils/continueWatching';
import {
  getHiddenContinueWatchingLinks,
  hideFromContinueWatching,
  showInContinueWatching,
} from '../src/lib/storage/ContinueWatchingStorage';
import {
  isSeriesComplete,
  recomputeSeriesCompletion,
  recordEpisodePlaybackProgress,
  setSeriesCatalog,
} from '../src/lib/storage/SeriesCompletionStorage';
import {syncSeriesCatalog} from '../src/lib/services/seriesCatalogSync';

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

it('hides a title only from Continue Watching until playback resumes', () => {
  const storage = new WatchHistoryStorage();
  storage.addToWatchHistory(item('show', true));
  const hidden = hideFromContinueWatching('show');
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30, hidden)).toEqual([]);
  expect(storage.getWatchHistory()).toHaveLength(1);
  expect(getHiddenContinueWatchingLinks()).toEqual(['show']);

  expect(showInContinueWatching('show')).toEqual([]);
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30)).toHaveLength(1);
});

it('completes a whole series only when every known episode reaches 95%', () => {
  const storage = new WatchHistoryStorage();
  storage.addToWatchHistory(item('show', true));
  setSeriesCatalog('show', ['s1e1', 's2e1'], true);
  recordEpisodePlaybackProgress('show', 's1e1', 95, 100);
  expect(isSeriesComplete('show')).toBe(false);

  setEpisodeManuallyWatched('show', 's2e1', true);
  setSeriesCatalog('show', ['s1e1', 's2e1'], true);
  // The user action recalculates completion after the manual mark.
  recomputeSeriesCompletion('show');
  expect(isSeriesComplete('show')).toBe(true);
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30)).toEqual([]);
  expect(storage.getWatchHistory()).toHaveLength(1);

  setSeriesCatalog('show', ['s1e1', 's2e1', 's2e2'], true);
  expect(isSeriesComplete('show')).toBe(false);
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30)).toHaveLength(1);
});

it('keeps a series visible when an available season has no episode list', async () => {
  const storage = new WatchHistoryStorage();
  storage.addToWatchHistory(item('show', true));
  await syncSeriesCatalog({
    contentLink: 'show',
    providerValue: 'fixture',
    groups: [
      {title: 'Season 1', directLinks: [{title: 'Episode 1', link: 's1e1'}]},
      {title: 'Season 2'},
      {title: 'Season 3', availabilityStatus: 'upcoming'},
    ],
  });
  recordEpisodePlaybackProgress('show', 's1e1', 100, 100);
  expect(isSeriesComplete('show')).toBe(false);
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30)).toHaveLength(1);
});

it('uses durable playback progress after the temporary cache is cleared', () => {
  setSeriesCatalog('show', ['s1e1'], true);
  recordEpisodePlaybackProgress('show', 's1e1', 95, 100);
  cacheStorage.clearAll();
  expect(getEpisodeProgressPercent('show', 's1e1')).toBe(95);
  expect(isSeriesComplete('show')).toBe(true);
});
