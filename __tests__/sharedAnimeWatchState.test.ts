import {beforeEach, expect, it} from '@jest/globals';
import {cacheStorage, mainStorage} from '../src/lib/storage/StorageService';
import {WatchHistoryStorage} from '../src/lib/storage/WatchHistoryStorage';
import {
  getEpisodeProgressPercent,
  setEpisodeManuallyWatched,
  markEpisodesManuallyWatched,
} from '../src/lib/storage/ManualEpisodeCompletionStorage';
import {
  clearEpisodePlaybackProgress,
  getSeriesCatalog,
  isSeriesComplete,
  recordEpisodePlaybackProgress,
  setSeriesCatalog,
} from '../src/lib/storage/SeriesCompletionStorage';
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
import useWatchHistoryStore from '../src/lib/zustand/watchHistrory';
import {getWatchProgressString, watchProgressKey} from '../src/lib/storage/SharedAnimeWatchIdentity';

const au = 'https://www.animeunity.to/anime/42-example';
const sc = 'streamcenter:v1:meta:animeunity:' + encodeURIComponent(JSON.stringify({url: au}));
const episode = (number: number) => `42|${number}`;
const scEpisode = (number: number) => 'streamcenter:v1:stream:animeunity:' +
  encodeURIComponent(JSON.stringify({url: episode(number)}));
const entry = (link: string, provider: string) => ({
  id: link, link, title: 'Example', provider, isSeries: true,
});

beforeEach(() => {
  mainStorage.clearAll();
  cacheStorage.clearAll();
  useWatchHistoryStore.getState().refreshHistory();
});

it('shares manual and playback episode completion while retaining route-specific catalogs', () => {
  setSeriesCatalog(au, [episode(1), episode(2)], true);
  setSeriesCatalog(sc, [scEpisode(1), scEpisode(2)], true);
  setEpisodeManuallyWatched(au, episode(1), true);
  expect(getEpisodeProgressPercent(sc, scEpisode(1))).toBe(100);
  recordEpisodePlaybackProgress(sc, scEpisode(2), 96, 100);
  expect(getEpisodeProgressPercent(au, episode(2))).toBe(96);
  expect(isSeriesComplete(au)).toBe(true);
  expect(isSeriesComplete(sc)).toBe(true);
  expect(getSeriesCatalog(au)?.episodeLinks).toEqual([episode(1), episode(2)]);
  expect(getSeriesCatalog(sc)?.episodeLinks).toEqual([scEpisode(1), scEpisode(2)]);

  setEpisodeManuallyWatched(sc, scEpisode(1), false);
  clearEpisodePlaybackProgress(sc, scEpisode(1));
  expect(getEpisodeProgressPercent(au, episode(1))).toBe(0);
  expect(isSeriesComplete(au)).toBe(false);
});

it('merges legacy watched marks and keeps watched as the winner', () => {
  const storage = new WatchHistoryStorage();
  storage.addToWatchHistory(entry(sc, 'streamcenter'));
  mainStorage.setArray(`manualWatchedEpisodes_${sc}`, [scEpisode(1)]);
  mainStorage.setArray('manualWatchedEpisodeContents', [sc]);
  mainStorage.setObject(`seriesEpisodeProgress_${au}`, {[episode(1)]: 20});
  mainStorage.setObject(`seriesEpisodeProgress_${sc}`, {[scEpisode(1)]: 96});

  expect(getEpisodeProgressPercent(au, episode(1))).toBe(100);
  expect(getEpisodeProgressPercent(sc, scEpisode(1))).toBe(100);
  expect(mainStorage.getArray(`manualWatchedEpisodes_${sc}`)).toBeUndefined();
});

it('keeps one history and Continue Watching card, using the last opened provider', () => {
  const storage = new WatchHistoryStorage();
  setSeriesCatalog(au, [episode(1), episode(2)], true);
  setSeriesCatalog(sc, [scEpisode(1), scEpisode(2)], true);
  storage.addToWatchHistory(entry(au, 'animeunity'));
  storage.addToWatchHistory(entry(sc, 'streamcenter'));
  expect(storage.getWatchHistory()).toHaveLength(1);
  expect(storage.getWatchHistory()[0]).toMatchObject({link: sc, provider: 'streamcenter'});
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30)).toHaveLength(1);

  hideFromContinueWatching(au);
  expect(getHiddenContinueWatchingLinks()).toHaveLength(1);
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30,
    getHiddenContinueWatchingLinks())).toHaveLength(0);
  showInContinueWatching(sc);
  expect(getHiddenContinueWatchingLinks()).toHaveLength(0);

  setEpisodeManuallyWatched(au, episode(1), true);
  expect(getContinueWatchingPresentation(storage.getWatchHistory()[0]).target?.link)
    .toBe(scEpisode(2));
  const localInfoItem = {...storage.getWatchHistory()[0], link: au};
  expect(getInfoPlaybackSelection(localInfoItem, undefined, true).target?.link)
    .toBe(episode(2));
});

it('bulk marks in StreamCenter and clears shared state with selected history', () => {
  const storage = new WatchHistoryStorage();
  storage.addToWatchHistory(entry(au, 'animeunity'));
  setSeriesCatalog(au, [episode(1), episode(2)], true);
  setSeriesCatalog(sc, [scEpisode(1), scEpisode(2)], true);
  markEpisodesManuallyWatched(sc, [scEpisode(1), scEpisode(2)]);
  expect(getEpisodeProgressPercent(au, episode(2))).toBe(100);

  useWatchHistoryStore.getState().removeItemsByLinks([au]);
  expect(storage.getWatchHistory()).toHaveLength(0);
  expect(getEpisodeProgressPercent(sc, scEpisode(2))).toBe(0);
  expect(getSeriesCatalog(au)).toBeUndefined();
  expect(getSeriesCatalog(sc)).toBeUndefined();
});

it('migrates the latest legacy resume summary and keeps it shared', () => {
  const storage = new WatchHistoryStorage();
  storage.setWatchHistory([entry(sc, 'streamcenter')]);
  mainStorage.setString(`watch_history_progress_${sc}`, JSON.stringify({
    episodeLink: scEpisode(1), percentage: 40, updatedAt: 20,
  }));
  mainStorage.setString(`watch_history_progress_${au}`, JSON.stringify({
    episodeLink: episode(1), percentage: 10, updatedAt: 10,
  }));
  expect(JSON.parse(getWatchProgressString(au) || '{}').percentage).toBe(40);
  expect(mainStorage.getString(watchProgressKey(sc)))
    .toBe(mainStorage.getString(watchProgressKey(au)));
  expect(mainStorage.getString(`watch_history_progress_${sc}`)).toBeUndefined();
});
