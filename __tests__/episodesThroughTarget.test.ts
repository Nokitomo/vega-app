import {afterEach, beforeEach, expect, it, jest} from '@jest/globals';
import {resolveEpisodesThroughTarget} from '../src/lib/services/episodesThroughTarget';
import {providerManager} from '../src/lib/services/ProviderManager';
import * as metadata from '../src/lib/storage/MetadataDatabase';
import {getEpisodeProgressPercent, getEpisodeProgressSnapshot, markEpisodesManuallyWatched} from '../src/lib/storage/ManualEpisodeCompletionStorage';
import {getSeriesCatalog, setSeriesCatalog} from '../src/lib/storage/SeriesCompletionStorage';
import {cacheStorage, mainStorage} from '../src/lib/storage/StorageService';

beforeEach(() => {
  mainStorage.clearAll();
  cacheStorage.clearAll();
});
afterEach(() => {
  jest.restoreAllMocks();
});

const groups = [
  {title: 'Season 1', seasonNumber: 1, episodesLink: 'season-1'},
  {title: 'Season 2', seasonNumber: 2, episodesLink: 'season-2'},
  {title: 'Season 3', seasonNumber: 3, episodesLink: 'season-3'},
];

it('uses the complete catalog without requesting every season again', async () => {
  setSeriesCatalog('show', [
    {link: 's1e1', seasonNumber: 1, seasonEpisodesLink: 'season-1'},
    {link: 's2e1', seasonNumber: 2, seasonEpisodesLink: 'season-2'},
    {link: 's3e1', seasonNumber: 3, seasonEpisodesLink: 'season-3'},
  ], true);
  const request = jest.spyOn(providerManager, 'getEpisodes');
  const selected = await resolveEpisodesThroughTarget({
    contentLink: 'show', providerValue: 'fixture', groups,
    activeSeasonLink: 'season-2',
    activeEpisodes: [{title: 'Episode 1', link: 's2e1', episodeNumber: 1}],
    targetLink: 's2e1',
  });
  expect(selected?.map(episode => episode.link)).toEqual(['s1e1', 's2e1']);
  expect(request).not.toHaveBeenCalled();
});

it('loads only preceding seasons and keeps the persisted catalog untouched', async () => {
  jest.spyOn(metadata, 'readMetadata').mockReturnValue(undefined);
  jest.spyOn(metadata, 'writeMetadata').mockImplementation(() => {});
  const request = jest.spyOn(providerManager, 'getEpisodes').mockImplementation(async ({url}) => [
    {title: 'Episode 1', link: url === 'season-1' ? 's1e1' : 's3e1', episodeNumber: 1},
  ]);
  const selected = await resolveEpisodesThroughTarget({
    contentLink: 'show', providerValue: 'fixture', groups,
    activeSeasonLink: 'season-2',
    activeEpisodes: [{title: 'Episode 1', link: 's2e1', episodeNumber: 1}],
    targetLink: 's2e1',
  });
  expect(selected?.map(episode => episode.link)).toEqual(['s1e1', 's2e1']);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(expect.objectContaining({url: 'season-1', silent: true}));
  expect(getSeriesCatalog('show')).toBeUndefined();
});

it('does not load specials when marking episodes in a later season', async () => {
  jest.spyOn(metadata, 'readMetadata').mockReturnValue(undefined);
  jest.spyOn(metadata, 'writeMetadata').mockImplementation(() => {});
  const request = jest.spyOn(providerManager, 'getEpisodes').mockResolvedValue([
    {title: 'Episode 1', link: 's1e1', episodeNumber: 1},
  ]);
  const selected = await resolveEpisodesThroughTarget({
    contentLink: 'show', providerValue: 'fixture',
    groups: [{title: 'Specials', seasonNumber: 0, episodesLink: 'specials'}, ...groups],
    activeSeasonLink: 'season-2',
    activeEpisodes: [{title: 'Episode 1', link: 's2e1', episodeNumber: 1}],
    targetLink: 's2e1',
  });
  expect(selected?.map(episode => episode.link)).toEqual(['s1e1', 's2e1']);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).not.toHaveBeenCalledWith(expect.objectContaining({url: 'specials'}));
});

it('leaves all episodes unchanged if a necessary season fails to load', async () => {
  jest.spyOn(metadata, 'readMetadata').mockReturnValue(undefined);
  jest.spyOn(providerManager, 'getEpisodes').mockRejectedValue(new Error('network'));
  await expect(resolveEpisodesThroughTarget({
    contentLink: 'show', providerValue: 'fixture', groups,
    activeSeasonLink: 'season-2',
    activeEpisodes: [{title: 'Episode 1', link: 's2e1'}],
    targetLink: 's2e1',
  })).rejects.toThrow('network');
  expect(getEpisodeProgressPercent('show', 's2e1')).toBe(0);
  expect(getSeriesCatalog('show')).toBeUndefined();
});

it('reads bulk progress with the same values as individual progress reads', () => {
  markEpisodesManuallyWatched('show', ['manual']);
  mainStorage.setObject('seriesEpisodeProgress_show', {recorded: 96});
  const links = ['manual', 'recorded', 'unseen'];
  const snapshot = getEpisodeProgressSnapshot('show', links);
  expect(links.map(link => snapshot.get(link))).toEqual(
    links.map(link => getEpisodeProgressPercent('show', link)),
  );
});
