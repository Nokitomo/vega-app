import {afterEach, beforeEach, expect, it, jest} from '@jest/globals';
import {mainStorage, cacheStorage} from '../src/lib/storage/StorageService';
import {WatchHistoryStorage} from '../src/lib/storage/WatchHistoryStorage';
import {queryClient} from '../src/lib/client';
import * as metadata from '../src/lib/storage/MetadataDatabase';
import {providerManager} from '../src/lib/services/ProviderManager';
import {checkContinueWatchingSeries} from '../src/lib/services/continueWatchingRefresh';
import {
  getContinueWatchingPresentation,
  selectContinueWatchingItems,
} from '../src/lib/utils/continueWatching';
import {
  getSeriesCatalog,
  isSeriesComplete,
  recomputeSeriesCompletion,
  setSeriesCatalog,
} from '../src/lib/storage/SeriesCompletionStorage';
import {setEpisodeManuallyWatched} from '../src/lib/storage/ManualEpisodeCompletionStorage';

const records = new Map<string, metadata.MetadataRecord<any>>();
const recordKey = (kind: string, provider: string, identity: string) =>
  `${kind}:${provider}:${identity}`;

beforeEach(() => {
  mainStorage.clearAll();
  cacheStorage.clearAll();
  records.clear();
  jest.spyOn(metadata, 'readMetadata').mockImplementation((kind, provider, identity) =>
    records.get(recordKey(kind, provider, identity)),
  );
  jest.spyOn(metadata, 'writeMetadata').mockImplementation((kind, provider, identity, value) => {
    records.set(recordKey(kind, provider, identity), {
      value, updatedAt: Date.now(), checkedAt: Date.now(), providerVersion: '',
    });
  });
  jest.spyOn(metadata, 'markMetadataChecked').mockImplementation(() => undefined);
});

afterEach(() => {
  queryClient.clear();
  jest.restoreAllMocks();
});

it('finds a new provider season and restores a completed title without changing history', async () => {
  const storage = new WatchHistoryStorage();
  const historyItem = {
    id: 'show', link: 'show', title: 'Show', provider: 'streamingunity',
    isSeries: true, episodeTitle: 'Episode 1', episodeNumber: 1, seasonNumber: 1,
  };
  storage.addToWatchHistory(historyItem);
  setSeriesCatalog('show', [{link: 'old-episode', episodeNumber: 1,
    seasonNumber: 1, seasonEpisodesLink: 'season-1'}], true);
  setEpisodeManuallyWatched('show', 'old-episode', true);
  recomputeSeriesCompletion('show');
  expect(isSeriesComplete('show')).toBe(true);
  const previousHistory = storage.getWatchHistory();
  metadata.writeMetadata('contentInfo', 'streamingunity', 'show', {
    title: 'Show', synopsis: '', image: '', type: 'series',
    episodesCount: 1,
    linkList: [{title: 'Season 1', seasonNumber: 1,
      directLinks: [{title: 'Episode 1', link: 'old-episode'}]}],
  });
  jest.spyOn(providerManager, 'getContentInventory').mockResolvedValue({
    complete: true, episodesCount: 2,
  });
  const fullInfo = {
    title: 'Show', synopsis: '', image: '', imdbId: '', type: 'series' as const,
    episodesCount: 2,
    linkList: [
      {title: 'Season 1', seasonNumber: 1,
        directLinks: [{title: 'Episode 1', link: 'old-episode',
          episodeNumber: 1, seasonNumber: 1}]},
      {title: 'Season 2', seasonNumber: 2,
        directLinks: [{title: 'Episode 1', link: 'new-episode',
          episodeNumber: 1, seasonNumber: 2}]},
    ],
  };
  const fullFetch = jest.spyOn(providerManager, 'getMetaData').mockResolvedValue(fullInfo);

  expect(await checkContinueWatchingSeries(storage.getWatchHistory(), [])).toBe(true);
  expect(fullFetch).toHaveBeenCalledTimes(1);
  expect(getSeriesCatalog('show')?.newEpisodeLinks).toEqual(['new-episode']);
  expect(selectContinueWatchingItems(storage.getWatchHistory(), 30)).toHaveLength(1);
  expect(getContinueWatchingPresentation(storage.getWatchHistory()[0])).toMatchObject({
    target: {link: 'new-episode', seasonNumber: 2, episodeNumber: 1},
    progressPercent: 0, hasNewEpisodes: true,
  });
  expect(storage.getWatchHistory()).toEqual(previousHistory);
  expect(await checkContinueWatchingSeries(storage.getWatchHistory(), [])).toBe(false);
  expect(fullFetch).toHaveBeenCalledTimes(1);
});

it('uses AnimeUnity check timing only for StreamCenter anime routes', async () => {
  const hour = 60 * 60 * 1000;
  const animeLink = 'streamcenter:v1:meta:animeunity:' + encodeURIComponent(
    JSON.stringify({url: 'https://www.animeunity.to/anime/42-example'}),
  );
  const filmLink = 'streamcenter:v1:meta:streamingunity:' + encodeURIComponent(
    JSON.stringify({url: 'https://streamingunity.example/it/titles/42-example'}),
  );
  const anime = {
    id: animeLink, link: animeLink, title: 'Anime', provider: 'streamcenter',
    isSeries: true,
  };
  const film = {
    id: filmLink, link: filmLink, title: 'Series', provider: 'streamcenter',
    isSeries: true,
  };
  mainStorage.setObject('continueWatchingProviderChecks', {
    [`streamcenter:${animeLink}`]: Date.now() - 5 * hour,
    [`streamcenter:${filmLink}`]: Date.now() - 7 * hour,
  });
  metadata.writeMetadata('contentInfo', 'streamcenter', filmLink, {
    title: 'Series', synopsis: '', image: '', imdbId: '', type: 'series',
    linkList: [], extra: {meta: {status: 'Returning Series'}},
  });
  const inventory = jest.spyOn(providerManager, 'getContentInventory')
    .mockRejectedValue(new Error('Inventory unavailable'));

  expect(await checkContinueWatchingSeries([anime, film], [])).toBe(false);
  expect(inventory).toHaveBeenCalledTimes(1);
  expect(inventory).toHaveBeenCalledWith({
    link: animeLink,
    providerValue: 'streamcenter',
  });
});

it('publishes automatically refreshed StreamCenter anime Info to AnimeUnity', async () => {
  const sourceLink = 'https://www.animeunity.to/anime/42-example';
  const animeLink = 'streamcenter:v1:meta:animeunity:' + encodeURIComponent(
    JSON.stringify({url: sourceLink}),
  );
  const item = {
    id: animeLink, link: animeLink, title: 'Anime',
    provider: 'streamcenter', isSeries: true,
  };
  jest.spyOn(providerManager, 'getContentInventory').mockResolvedValue({
    complete: true, episodesCount: 2,
  });
  jest.spyOn(providerManager, 'getMetaData').mockResolvedValue({
    title: 'Anime', synopsis: '', image: '', imdbId: '', type: 'series',
    episodesCount: 2,
    linkList: [{title: 'Season 1', directLinks: [
      {title: 'Episode 1', link: 'streamcenter:v1:stream:animeunity:%7B%22url%22%3A%2242%7C1%22%7D'},
      {title: 'Episode 2', link: 'streamcenter:v1:stream:animeunity:%7B%22url%22%3A%2242%7C2%22%7D'},
    ]}],
  });

  expect(await checkContinueWatchingSeries([item], [])).toBe(true);
  const source = metadata.readMetadata<any>('contentInfo', 'animeunity', sourceLink);
  expect(source?.value.episodesCount).toBe(2);
  expect(source?.value.linkList[0].directLinks[1].link).toBe('42|2');
  expect(metadata.readMetadata<any>('contentInfo', 'streamcenter', animeLink)
    ?.value.linkList[0].directLinks[1].link)
    .toContain('streamcenter:v1:stream:animeunity:');
});
