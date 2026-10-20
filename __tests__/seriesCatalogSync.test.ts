import {afterEach, beforeEach, expect, it, jest} from '@jest/globals';
import {syncSeriesCatalog} from '../src/lib/services/seriesCatalogSync';
import {providerManager} from '../src/lib/services/ProviderManager';
import * as metadata from '../src/lib/storage/MetadataDatabase';
import {getSeriesCatalog} from '../src/lib/storage/SeriesCompletionStorage';
import {cacheStorage, mainStorage} from '../src/lib/storage/StorageService';
import type {EpisodeLink} from '../src/lib/providers/types';

const groups = [
  {title: 'Season 1', seasonNumber: 1, episodesLink: 'season-1'},
  {title: 'Season 2', seasonNumber: 2, episodesLink: 'season-2'},
];
const records = new Map<string, metadata.MetadataRecord<EpisodeLink[]>>();
const recordKey = (kind: string, provider: string, link: string) =>
  `${kind}:${provider}:${link}`;

beforeEach(() => {
  mainStorage.clearAll();
  cacheStorage.clearAll();
  records.clear();
  jest.spyOn(metadata, 'readMetadata').mockImplementation((kind, provider, link) =>
    records.get(recordKey(kind, provider, link)),
  );
  jest.spyOn(metadata, 'writeMetadata').mockImplementation((kind, provider, link, value) => {
    records.set(recordKey(kind, provider, link), {
      value: value as EpisodeLink[],
      updatedAt: Date.now(),
      checkedAt: Date.now(),
      providerVersion: '',
    });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('coalesces overlapping scans and reuses fetched seasons on reopen', async () => {
  let releaseFirst: () => void = () => {};
  const firstRequest = new Promise<void>(resolve => {
    releaseFirst = resolve;
  });
  const fetched: string[] = [];
  const request = jest.spyOn(providerManager, 'getEpisodes')
    .mockImplementation(async ({url}) => {
      fetched.push(url);
      if (url === 'season-1') {
        await firstRequest;
      }
      return [{title: 'Episode 1', link: `${url}-episode`, episodeNumber: 1}];
    });

  const first = syncSeriesCatalog({
    contentLink: 'show', providerValue: 'fixture', groups,
  });
  const second = syncSeriesCatalog({
    contentLink: 'show', providerValue: 'fixture', groups,
    activeSeasonLink: 'season-2',
    activeEpisodes: [{title: 'Episode 1', link: 'season-2-episode', episodeNumber: 1}],
  });
  releaseFirst();
  await Promise.all([first, second]);

  expect(fetched).toEqual(['season-1']);
  expect(getSeriesCatalog('show')?.episodeLinks).toEqual([
    'season-1-episode', 'season-2-episode',
  ]);
  expect(getSeriesCatalog('show')?.complete).toBe(true);
  expect(records.get(recordKey('episodes', 'fixture', 'season-1'))?.value)
    .toHaveLength(1);

  await syncSeriesCatalog({
    contentLink: 'show', providerValue: 'fixture', groups,
    activeSeasonLink: 'season-2',
    activeEpisodes: [{title: 'Episode 1', link: 'season-2-episode', episodeNumber: 1}],
  });
  expect(request).toHaveBeenCalledTimes(1);
});

it('keeps an unavailable season from marking a series complete', async () => {
  jest.spyOn(providerManager, 'getEpisodes').mockRejectedValue(new Error('offline'));
  await syncSeriesCatalog({
    contentLink: 'show', providerValue: 'fixture', groups,
    activeSeasonLink: 'season-1',
    activeEpisodes: [{title: 'Episode 1', link: 'season-1-episode'}],
  });
  expect(getSeriesCatalog('show')?.episodeLinks).toEqual(['season-1-episode']);
  expect(getSeriesCatalog('show')?.complete).toBe(false);
});
