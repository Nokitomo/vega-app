import {beforeEach, expect, it} from '@jest/globals';
import {cacheStorage, mainStorage} from '../src/lib/storage/StorageService';
import {WatchHistoryStorage} from '../src/lib/storage/WatchHistoryStorage';
import {
  getEpisodeProgressPercent,
  setEpisodeManuallyWatched,
  clearAllManualEpisodeCompletions,
} from '../src/lib/storage/ManualEpisodeCompletionStorage';
import {
  getContinueWatchingPresentation,
  selectContinueWatchingItems,
} from '../src/lib/utils/continueWatching';
import {
  getHiddenContinueWatchingLinks,
  hideFromContinueWatching,
  showInContinueWatching,
} from '../src/lib/storage/ContinueWatchingStorage';
import {
  isSeriesComplete,
  getSeriesCatalog,
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

it('shows the next episode with zero progress after the previous one is complete', () => {
  const show = {...item('show', true), episodeNumber: 1, seasonNumber: 1};
  setSeriesCatalog('show', [
    {link: 's1e1', seasonNumber: 1, episodeNumber: 1},
    {link: 's1e2', seasonNumber: 1, episodeNumber: 2},
  ], true);
  recordEpisodePlaybackProgress('show', 's1e1', 95, 100);
  mainStorage.setString('watch_history_progress_show', JSON.stringify({
    episodeLink: 's1e1', percentage: 95,
  }));

  expect(getContinueWatchingPresentation(show)).toMatchObject({
    target: {link: 's1e2', seasonNumber: 1, episodeNumber: 2},
    progressPercent: 0,
    hasNewEpisodes: false,
  });
});

it('keeps legacy episode progress when the saved summary has no episode link', () => {
  setSeriesCatalog('show', [
    {link: 's1e1', seasonNumber: 1, episodeNumber: 1},
    {link: 's1e2', seasonNumber: 1, episodeNumber: 2},
  ], true);
  mainStorage.setString('watch_history_progress_show', JSON.stringify({
    percentage: 40,
  }));
  expect(getContinueWatchingPresentation({
    ...item('show', true), episodeNumber: 1, seasonNumber: 1,
  })).toMatchObject({
    target: {link: 's1e1'}, progressPercent: 40,
  });
});

it('restores a completed show when a season appears and targets its first episode', () => {
  const storage = new WatchHistoryStorage();
  storage.addToWatchHistory({...item('show', true), episodeNumber: 3, seasonNumber: 3});
  const oldEpisodes = [1, 2, 3].map(seasonNumber => ({
    link: `s${seasonNumber}e1`, seasonNumber, episodeNumber: 1,
    seasonEpisodesLink: `season-${seasonNumber}`,
  }));
  setSeriesCatalog('show', oldEpisodes, true);
  oldEpisodes.forEach(episode =>
    setEpisodeManuallyWatched('show', episode.link, true),
  );
  recomputeSeriesCompletion('show');
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30)).toEqual([]);

  setSeriesCatalog('show', [...oldEpisodes, {
    link: 's4e1', seasonNumber: 4, episodeNumber: 1,
    seasonEpisodesLink: 'season-4',
  }], true);
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30)).toHaveLength(1);
  expect(getContinueWatchingPresentation(storage.getWatchHistory()[0])).toMatchObject({
    target: {
      link: 's4e1', seasonNumber: 4, episodeNumber: 1,
      seasonEpisodesLink: 'season-4',
    },
    progressPercent: 0,
    hasNewEpisodes: true,
  });
  expect(getSeriesCatalog('show')?.newEpisodeLinks).toEqual(['s4e1']);
  expect(storage.getWatchHistory()).toHaveLength(1);

  recordEpisodePlaybackProgress('show', 's4e1', 20, 100);
  expect(getContinueWatchingPresentation(storage.getWatchHistory()[0])).toMatchObject({
    target: {link: 's4e1'}, progressPercent: 20, hasNewEpisodes: false,
  });
});
