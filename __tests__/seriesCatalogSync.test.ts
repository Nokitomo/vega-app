import {afterEach, beforeEach, expect, it, jest} from '@jest/globals';
import {
  getSeriesCatalogSyncSignature,
  syncSeriesCatalog,
} from '../src/lib/services/seriesCatalogSync';
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

  const reopened = await syncSeriesCatalog({
    contentLink: 'show', providerValue: 'fixture', groups,
    activeSeasonLink: 'season-2',
    activeEpisodes: [{title: 'Episode 1', link: 'season-2-episode', episodeNumber: 1}],
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(reopened.complete).toBe(true);
  expect(reopened.revalidateAt).toBeGreaterThan(Date.now());
});

it('keeps an unavailable season from marking a series complete', async () => {
  jest.spyOn(providerManager, 'getEpisodes').mockRejectedValue(new Error('offline'));
  const result = await syncSeriesCatalog({
    contentLink: 'show', providerValue: 'fixture', groups,
    activeSeasonLink: 'season-1',
    activeEpisodes: [{title: 'Episode 1', link: 'season-1-episode'}],
  });
  expect(getSeriesCatalog('show')?.episodeLinks).toEqual(['season-1-episode']);
  expect(getSeriesCatalog('show')?.complete).toBe(false);
  expect(result).toEqual({complete: false, revalidateAt: 0});
});

it('revalidates when the oldest cached season reaches four hours', async () => {
  const now = Date.now();
  jest.spyOn(Date, 'now').mockReturnValue(now);
  for (const [index, group] of groups.entries()) {
    records.set(recordKey('episodes', 'fixture', group.episodesLink), {
      value: [{title: 'Episode 1', link: `${group.episodesLink}-episode`}],
      updatedAt: now,
      checkedAt: index === 0 ? now - 3 * 60 * 60 * 1000 : now,
      providerVersion: '',
    });
  }
  const request = jest.spyOn(providerManager, 'getEpisodes');
  const result = await syncSeriesCatalog({
    contentLink: 'show', providerValue: 'fixture', groups,
  });
  expect(result).toEqual({complete: true, revalidateAt: now + 60 * 60 * 1000});
  expect(request).not.toHaveBeenCalled();
});

it('does not treat direct-link fallback after an empty fetch as fresh', async () => {
  jest.spyOn(providerManager, 'getEpisodes').mockResolvedValue([]);
  const result = await syncSeriesCatalog({
    contentLink: 'show', providerValue: 'fixture',
    groups: [{
      title: 'Season 1', episodesLink: 'season-1',
      directLinks: [{title: 'Episode 1', link: 'direct-episode'}],
    }],
  });
  expect(getSeriesCatalog('show')?.episodeLinks).toEqual(['direct-episode']);
  expect(result).toEqual({complete: true, revalidateAt: 0});
});

it('uses catalog fields to distinguish duplicate scans from changed episodes', () => {
  const base = {
    contentLink: 'show', providerValue: 'fixture', groups,
    activeSeasonLink: 'season-1',
    activeEpisodes: [{title: 'Episode 1', link: 'episode-1', episodeNumber: 1}],
  };
  const signature = getSeriesCatalogSyncSignature(base, 0, true);
  expect(getSeriesCatalogSyncSignature({
    ...base,
    groups: groups.map(group => ({...group, title: 'New display title'})),
    activeEpisodes: base.activeEpisodes.map(episode => ({...episode})),
  }, 0, true)).toBe(signature);
  expect(getSeriesCatalogSyncSignature({
    ...base,
    activeEpisodes: [{...base.activeEpisodes[0], title: 'Updated episode'}],
  }, 0, true)).not.toBe(signature);
  expect(getSeriesCatalogSyncSignature(base, 1, true)).not.toBe(signature);
  expect(getSeriesCatalogSyncSignature(base, 0, false)).not.toBe(signature);
});
