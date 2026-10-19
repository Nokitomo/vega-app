import {beforeEach, expect, it} from '@jest/globals';
import {cacheStorage, mainStorage} from '../src/lib/storage/StorageService';
import {WatchHistoryStorage} from '../src/lib/storage/WatchHistoryStorage';
import {
  getEpisodeProgressPercent,
  markEpisodesManuallyWatched,
  setEpisodeManuallyWatched,
  clearAllManualEpisodeCompletions,
} from '../src/lib/storage/ManualEpisodeCompletionStorage';
import {
  getContinueWatchingPresentation,
  getInfoPlaybackSelection,
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
import useWatchHistoryStore from '../src/lib/zustand/watchHistrory';
import {getEpisodesThroughTarget} from '../src/lib/utils/episodesThroughTarget';
import {getWatchHistoryCardProgress} from '../src/lib/utils/watchHistoryCardProgress';

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

it('retains more than 100 history titles while Home still shows only 30', () => {
  const storage = new WatchHistoryStorage();
  for (let index = 0; index < 150; index++) {
    storage.addToWatchHistory(item(`movie-${index}`));
  }
  expect(storage.getWatchHistory()).toHaveLength(150);
  expect(storage.getWatchHistory().at(-1)?.link).toBe('movie-0');
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30)).toHaveLength(30);
  expect(selectContinueWatchingItems(storage.getWatchHistory(), Number.MAX_SAFE_INTEGER))
    .toHaveLength(150);
  storage.addToWatchHistory(item('movie-0'));
  expect(storage.getWatchHistory()).toHaveLength(150);
  expect(storage.getWatchHistory()[0].link).toBe('movie-0');
});

it('keeps the oldest title after a thousand entries and a later update', () => {
  const storage = new WatchHistoryStorage();
  storage.setWatchHistory(Array.from({length: 1000}, (_, index) => item(`title-${index}`)));
  storage.addToWatchHistory(item('new-title'));
  expect(storage.getWatchHistory()).toHaveLength(1001);
  expect(storage.getWatchHistory().at(-1)?.link).toBe('title-999');
  storage.addToWatchHistory(item('title-999'));
  expect(storage.getWatchHistory()).toHaveLength(1001);
  expect(storage.getWatchHistory()[0].link).toBe('title-999');
});

it('shows a manually marked series in history and targets the next episode', () => {
  const storage = new WatchHistoryStorage();
  setSeriesCatalog('show', [
    {link: 's1e1', seasonNumber: 1, episodeNumber: 1},
    {link: 's1e2', seasonNumber: 1, episodeNumber: 2},
    {link: 's1e3', seasonNumber: 1, episodeNumber: 3},
  ], true);
  setEpisodeManuallyWatched('show', 's1e1', true);
  useWatchHistoryStore.getState().recordManualEpisode({
    ...item('show', true), manualEpisodeLink: 's1e1',
    episodeNumber: 1, seasonNumber: 1, provider: 'fixture', poster: 'poster',
  });

  expect(storage.getWatchHistory()).toHaveLength(1);
  expect(storage.getWatchHistory()[0]).toMatchObject({
    link: 'show', manualEpisodeLink: 's1e1', provider: 'fixture', poster: 'poster',
  });
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30).map(entry => entry.link))
    .toEqual(['show']);
  expect(getContinueWatchingPresentation(storage.getWatchHistory()[0])).toMatchObject({
    target: {link: 's1e2'}, progressPercent: 0,
  });
  expect(getWatchHistoryCardProgress(storage.getWatchHistory()[0])).toBe(100);
});

it('updates the Info play target immediately after a manual mark across seasons', () => {
  const storage = new WatchHistoryStorage();
  setSeriesCatalog('show', [
    {link: 's1e1', seasonNumber: 1, episodeNumber: 1, seasonEpisodesLink: 'season-1'},
    {link: 's1e2', seasonNumber: 1, episodeNumber: 2, seasonEpisodesLink: 'season-1'},
    {link: 's2e1', seasonNumber: 2, episodeNumber: 1, seasonEpisodesLink: 'season-2'},
  ], true);
  storage.addToWatchHistory(item('show', true));
  const initialTarget = {link: 's1e2', seasonNumber: 1, episodeNumber: 2};
  expect(getInfoPlaybackSelection(storage.getWatchHistory()[0], initialTarget, false))
    .toMatchObject({target: initialTarget, playFromBeginning: false});

  markEpisodesManuallyWatched('show', ['s1e1', 's1e2']);
  recomputeSeriesCompletion('show');
  useWatchHistoryStore.getState().recordManualEpisode({
    ...item('show', true), manualEpisodeLink: 's1e2',
    seasonNumber: 1, episodeNumber: 2,
  });
  expect(getInfoPlaybackSelection(storage.getWatchHistory()[0], initialTarget, true))
    .toMatchObject({
      target: {link: 's2e1', seasonNumber: 2, seasonEpisodesLink: 'season-2'},
      playFromBeginning: false,
      resetPlayback: false,
    });

  setEpisodeManuallyWatched('show', 's1e2', false);
  recomputeSeriesCompletion('show');
  expect(getInfoPlaybackSelection(storage.getWatchHistory()[0], initialTarget, true))
    .toMatchObject({target: {link: 's1e2'}, playFromBeginning: false});
});

it('replays the first episode after completing a series and advances when new episodes arrive', () => {
  const storage = new WatchHistoryStorage();
  const first = {link: 's1e1', seasonNumber: 1, episodeNumber: 1, seasonEpisodesLink: 'season-1'};
  setSeriesCatalog('show', [first, {
    link: 's1e2', seasonNumber: 1, episodeNumber: 2, seasonEpisodesLink: 'season-1',
  }], true);
  markEpisodesManuallyWatched('show', ['s1e1', 's1e2']);
  recomputeSeriesCompletion('show');
  storage.addToWatchHistory(item('show', true));
  const entry = storage.getWatchHistory()[0];
  expect(getInfoPlaybackSelection(entry, {link: 's1e2'}, false))
    .toMatchObject({target: first, playFromBeginning: true, resetPlayback: true});

  setSeriesCatalog('show', [first, {
    link: 's1e2', seasonNumber: 1, episodeNumber: 2, seasonEpisodesLink: 'season-1',
  }, {
    link: 's2e1', seasonNumber: 2, episodeNumber: 1, seasonEpisodesLink: 'season-2',
  }], true);
  expect(getInfoPlaybackSelection(entry, {link: 's1e2'}, true))
    .toMatchObject({target: {link: 's2e1'}, playFromBeginning: false});
});

it('updates one existing history card and prefers the latest manual episode', () => {
  const storage = new WatchHistoryStorage();
  setSeriesCatalog('show', [
    {link: 's1e1', seasonNumber: 1, episodeNumber: 1},
    {link: 's1e2', seasonNumber: 1, episodeNumber: 2},
    {link: 's1e3', seasonNumber: 1, episodeNumber: 3},
  ], true);
  storage.setWatchHistory([{...item('show', true), id: 'legacy-id', poster: 'original'}]);
  mainStorage.setString('watch_history_progress_show', JSON.stringify({
    episodeLink: 's1e1', percentage: 50, updatedAt: Date.now() - 1000,
  }));
  markEpisodesManuallyWatched('show', ['s1e1', 's1e2']);
  useWatchHistoryStore.getState().recordManualEpisode({
    ...item('show', true), manualEpisodeLink: 's1e2',
    episodeNumber: 2, seasonNumber: 1,
  });
  const entry = storage.getWatchHistory()[0];
  expect(storage.getWatchHistory()).toHaveLength(1);
  expect(entry.poster).toBe('original');
  expect(getContinueWatchingPresentation(entry)).toMatchObject({
    target: {link: 's1e3'}, progressPercent: 0,
  });
  mainStorage.setString('watch_history_progress_show', JSON.stringify({
    episodeLink: 's1e3', percentage: 25, updatedAt: (entry.manualMarkedAt || 0) + 1,
  }));
  expect(getContinueWatchingPresentation(entry)).toMatchObject({
    target: {link: 's1e3'}, progressPercent: 25,
  });
  expect(getWatchHistoryCardProgress(entry)).toBe(25);
});

it('keeps a manually completed series in history and restores it when episodes arrive', () => {
  const storage = new WatchHistoryStorage();
  setSeriesCatalog('show', [
    {link: 's1e1', seasonNumber: 1, episodeNumber: 1},
    {link: 's1e2', seasonNumber: 1, episodeNumber: 2},
  ], true);
  markEpisodesManuallyWatched('show', ['s1e1', 's1e2']);
  recomputeSeriesCompletion('show');
  useWatchHistoryStore.getState().recordManualEpisode({
    ...item('show', true), manualEpisodeLink: 's1e2',
    episodeNumber: 2, seasonNumber: 1,
  });
  expect(storage.getWatchHistory()).toHaveLength(1);
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30)).toEqual([]);

  setSeriesCatalog('show', [
    {link: 's1e1', seasonNumber: 1, episodeNumber: 1},
    {link: 's1e2', seasonNumber: 1, episodeNumber: 2},
    {link: 's1e3', seasonNumber: 1, episodeNumber: 3},
  ], true);
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30).map(entry => entry.link))
    .toEqual(['show']);
  expect(getContinueWatchingPresentation(storage.getWatchHistory()[0])).toMatchObject({
    target: {link: 's1e3'}, progressPercent: 0, hasNewEpisodes: true,
  });
});

it('removes manual progress when its history title is deleted', () => {
  const storage = new WatchHistoryStorage();
  setSeriesCatalog('show', [{link: 'episode-1', seasonNumber: 1}], true);
  setEpisodeManuallyWatched('show', 'episode-1', true);
  useWatchHistoryStore.getState().recordManualEpisode({
    ...item('show', true), manualEpisodeLink: 'episode-1',
  });
  useWatchHistoryStore.getState().removeItemsByLinks(['show']);
  expect(storage.getWatchHistory()).toHaveLength(0);
  expect(getEpisodeProgressPercent('show', 'episode-1')).toBe(0);
});

it('orders new episodes and playback by the most recent activity', () => {
  const storage = new WatchHistoryStorage();
  const base = Date.now() - 10_000;
  setSeriesCatalog('blue', ['episode-1', 'episode-2'], true);
  const catalog = getSeriesCatalog('blue')!;
  const onePiece = {...item('one-piece', true), timestamp: base + 3_000};
  const blue = {...item('blue', true), timestamp: base + 1_000};
  storage.setWatchHistory([onePiece, blue]);

  mainStorage.setObject('seriesCatalog_blue', {
    ...catalog,
    newEpisodeLinks: ['episode-2'],
    newEpisodesDetectedAt: base + 2_000,
  });
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 1)[0].link)
    .toBe('one-piece');

  mainStorage.setObject('seriesCatalog_blue', {
    ...catalog,
    newEpisodeLinks: ['episode-2'],
    newEpisodesDetectedAt: base + 4_000,
  });
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 1)[0].link)
    .toBe('blue');

  storage.addToWatchHistory(onePiece);
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 1)[0].link)
    .toBe('one-piece');
});

it('deletes only selected history titles and their progress, including legacy IDs', () => {
  const storage = new WatchHistoryStorage();
  storage.setWatchHistory([
    {...item('show'), id: 'legacy-show-id'},
    {...item('show_more'), id: 'legacy-other-id'},
    {...item('movie'), id: 'legacy-movie-id'},
  ]);
  setSeriesCatalog('show', ['episode-1'], true);
  setSeriesCatalog('show_more', ['episode-2'], true);
  setEpisodeManuallyWatched('show', 'episode-1', true);
  setEpisodeManuallyWatched('show_more', 'episode-2', true);
  mainStorage.setString('watch_history_progress_show', '{}');
  mainStorage.setString('watch_history_progress_show_episode_1', '{}');
  mainStorage.setString('watch_history_progress_show_more', '{}');
  storage.addProgressKey('watch_history_progress_show_episode_1');
  storage.addProgressKey('watch_history_progress_show_more');

  useWatchHistoryStore.getState().removeItemsByLinks(['show', 'movie', 'show']);

  expect(storage.getWatchHistory().map(entry => entry.link)).toEqual(['show_more']);
  expect(mainStorage.getString('watch_history_progress_show')).toBeUndefined();
  expect(mainStorage.getString('watch_history_progress_show_episode_1')).toBeUndefined();
  expect(mainStorage.getString('watch_history_progress_show_more')).toBe('{}');
  expect(getSeriesCatalog('show')).toBeUndefined();
  expect(getSeriesCatalog('show_more')).toBeDefined();
  expect(getEpisodeProgressPercent('show', 'episode-1')).toBe(0);
  expect(getEpisodeProgressPercent('show_more', 'episode-2')).toBe(100);
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30).map(entry => entry.link))
    .toEqual(['show_more']);
});

it('clears legacy untracked manual progress with selected history', () => {
  const storage = new WatchHistoryStorage();
  storage.setWatchHistory([item('show', true), item('other', true)]);
  setSeriesCatalog('show', ['show-episode'], true);
  setEpisodeManuallyWatched('show', 'show-episode', true);
  cacheStorage.setString('show-episode', JSON.stringify({position: 1, duration: 1}));
  cacheStorage.setString('other-episode', JSON.stringify({position: 1, duration: 1}));
  storage.addEpisodeKey('other', 'other-episode');

  useWatchHistoryStore.getState().removeItemsByLinks(['show']);

  expect(cacheStorage.getString('show-episode')).toBeUndefined();
  expect(getEpisodeProgressPercent('show', 'show-episode')).toBe(0);
  expect(getEpisodeProgressPercent('other', 'other-episode')).toBe(100);
});

it('ignores an orphaned legacy manual cache entry after clearing all history', () => {
  const storage = new WatchHistoryStorage();
  storage.setWatchHistory([item('show', true)]);
  cacheStorage.setString('episode-1', JSON.stringify({position: 1, duration: 1}));
  useWatchHistoryStore.getState().clearHistory();
  expect(getEpisodeProgressPercent('show', 'episode-1')).toBe(0);
  expect(cacheStorage.getString('episode-1')).toBeDefined();
});

it('marks through the selected episode across seasons without marking later episodes', () => {
  setSeriesCatalog('show', [
    {link: 's2e2', seasonNumber: 2, episodeNumber: 2},
    {link: 's1e2', seasonNumber: 1, episodeNumber: 2},
    {link: 's2e1', seasonNumber: 2, episodeNumber: 1},
    {link: 's1e1', seasonNumber: 1, episodeNumber: 1},
    {link: 'special', seasonNumber: 0, episodeNumber: 1},
    {link: 's2e3', seasonNumber: 2, episodeNumber: 3},
  ], true);
  const selected = getEpisodesThroughTarget(getSeriesCatalog('show'), 's2e2');
  expect(selected?.map(episode => episode.link)).toEqual([
    's1e1', 's1e2', 's2e1', 's2e2',
  ]);
  markEpisodesManuallyWatched('show', selected!.map(episode => episode.link));
  expect(getEpisodeProgressPercent('show', 's1e1')).toBe(100);
  expect(getEpisodeProgressPercent('show', 's2e2')).toBe(100);
  expect(getEpisodeProgressPercent('show', 's2e3')).toBe(0);
  expect(getEpisodeProgressPercent('show', 'special')).toBe(0);
  expect(isSeriesComplete('show')).toBe(false);
});

it('rejects incomplete catalogs and unordered specials for bulk marking', () => {
  setSeriesCatalog('show', [{link: 's1e1', seasonNumber: 1}], false);
  expect(getEpisodesThroughTarget(getSeriesCatalog('show'), 's1e1')).toBeNull();
  setSeriesCatalog('show', [{link: 'special', seasonNumber: 0}], true);
  expect(getEpisodesThroughTarget(getSeriesCatalog('show'), 'special')).toBeNull();
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
