import {afterEach, beforeEach, expect, it, jest} from '@jest/globals';
import {queryClient} from '../src/lib/client';
import {cacheStorage} from '../src/lib/storage/StorageService';
import type {EpisodeLink, Info} from '../src/lib/providers/types';
import * as metadata from '../src/lib/storage/MetadataDatabase';
import {providerManager} from '../src/lib/services/ProviderManager';
import {
  getCachedProviderPoster,
  resolveProviderPoster,
} from '../src/lib/services/ProviderArtwork';
import {
  readSharedAnimeEpisodes,
  readSharedAnimeInfo,
  writeSharedAnimeEpisodes,
  writeSharedAnimeInfo,
} from '../src/lib/services/animeMetadataSharing';
import {streamCenterEpisodesOrigin} from '../src/lib/services/streamCenterMetadata';
import {getProviderCacheScope} from '../src/lib/utils/providerCacheScope';

const sourceLink = 'https://www.animeunity.to/anime/42-example';
const scLink = 'streamcenter:v1:meta:animeunity:' + encodeURIComponent(
  JSON.stringify({url: sourceLink}),
);
const episodeLink = '42|1|12';
const scEpisodeLink = 'streamcenter:v1:episodes:animeunity:' + encodeURIComponent(
  JSON.stringify({url: episodeLink, title: 'Example', anilistId: 42}),
);
const info = (title: string): Info => ({
  title, synopsis: '', image: '', imdbId: '', type: 'series',
  linkList: [{title: 'Season 1', episodesLink: episodeLink}],
});
const episodes: EpisodeLink[] = [{title: 'Episode 1', link: '42|1', episodeNumber: 1}];

const records = new Map<string, metadata.MetadataRecord<any>>();
const recordKey = (kind: string, provider: string, link: string) =>
  `${kind}:${provider}:${metadata.metadataIdentity(provider, link)}`;
let timestamp = 0;

beforeEach(() => {
  records.clear();
  timestamp = 0;
  queryClient.clear();
  cacheStorage.clearAll();
  jest.spyOn(metadata, 'readMetadata').mockImplementation((kind, provider, link) =>
    records.get(recordKey(kind, provider, link)),
  );
  jest.spyOn(metadata, 'writeMetadata').mockImplementation((kind, provider, link, value, providerVersion = '') => {
    records.set(recordKey(kind, provider, link), {
      value, updatedAt: ++timestamp, checkedAt: timestamp, providerVersion,
    });
  });
});

afterEach(() => {
  queryClient.clear();
  jest.restoreAllMocks();
});

it('shares Info in both directions while preserving StreamCenter playback routes', () => {
  const auQuery = ['contentInfo', sourceLink, 'animeunity', 'scope'];
  const scQuery = ['contentInfo', scLink, 'streamcenter', 'scope'];
  queryClient.setQueryData(auQuery, info('Old'));
  queryClient.setQueryData(scQuery, info('Old'));

  const streamCenterInfo = {
    ...info('From StreamCenter'),
    linkList: [{title: 'Season 1', episodesLink: scEpisodeLink}],
  };
  writeSharedAnimeInfo('streamcenter', scLink, streamCenterInfo);
  expect(readSharedAnimeInfo('animeunity', sourceLink)?.value.title)
    .toBe('From StreamCenter');
  expect(readSharedAnimeInfo('animeunity', sourceLink)?.value.linkList[0].episodesLink)
    .toBe(episodeLink);
  expect(queryClient.getQueryData<Info>(auQuery)?.title).toBe('From StreamCenter');

  writeSharedAnimeInfo('animeunity', sourceLink, info('From AnimeUnity'));
  expect(readSharedAnimeInfo('streamcenter', scLink)?.value.title)
    .toBe('From AnimeUnity');
  expect(streamCenterEpisodesOrigin(
    queryClient.getQueryData<Info>(scQuery)?.linkList[0].episodesLink || '',
  )?.data.url).toBe(episodeLink);
  expect(queryClient.getQueryData<Info>(scQuery)?.title).toBe('From AnimeUnity');
});

it('shares episodes in both directions without losing StreamCenter stream routes', () => {
  const auQuery = ['episodes', episodeLink, 'animeunity', 'scope'];
  const scQuery = ['episodes', scEpisodeLink, 'streamcenter', 'scope'];
  queryClient.setQueryData(auQuery, episodes);
  queryClient.setQueryData(scQuery, episodes);
  const route = streamCenterEpisodesOrigin(scEpisodeLink)!;
  const wrapped = [{...episodes[0], link: 'streamcenter:v1:stream:animeunity:' +
    encodeURIComponent(JSON.stringify({url: episodes[0].link}))}];

  writeSharedAnimeEpisodes('streamcenter', scEpisodeLink, wrapped);
  expect(readSharedAnimeEpisodes('animeunity', episodeLink)?.value[0].link)
    .toBe(episodes[0].link);
  expect(queryClient.getQueryData<EpisodeLink[]>(auQuery)?.[0].link)
    .toBe(episodes[0].link);

  writeSharedAnimeEpisodes('animeunity', episodeLink, [
    ...episodes, {title: 'Episode 2', link: '42|2', episodeNumber: 2},
  ]);
  const scEpisodes = readSharedAnimeEpisodes('streamcenter', scEpisodeLink)?.value;
  expect(scEpisodes).toHaveLength(2);
  expect(scEpisodes?.[1].link).toContain('streamcenter:v1:stream:animeunity:');
  expect(streamCenterEpisodesOrigin(scEpisodeLink)).toEqual(route);
  expect(queryClient.getQueryData<EpisodeLink[]>(scQuery)?.[1].link)
    .toBe(scEpisodes?.[1].link);
});

it('does not copy StreamingUnity metadata into the anime cache', () => {
  const filmLink = 'streamcenter:v1:meta:streamingunity:' + encodeURIComponent(
    JSON.stringify({url: 'https://streamingunity.example/it/titles/42'}),
  );
  writeSharedAnimeInfo('streamcenter', filmLink, info('Film'));
  expect(readSharedAnimeInfo('animeunity', sourceLink)).toBeUndefined();
});

it('reuses resolved posters across AnimeUnity and StreamCenter in both directions', async () => {
  const lookup = jest.spyOn(providerManager, 'getArtwork')
    .mockResolvedValueOnce({resolved: true, poster: 'https://image.example/first.jpg'})
    .mockResolvedValueOnce({resolved: true, poster: 'https://image.example/second.jpg'});

  expect(await resolveProviderPoster({providerValue: 'streamcenter', link: scLink}))
    .toBe('https://image.example/first.jpg');
  expect(getCachedProviderPoster('animeunity', sourceLink)?.value.poster)
    .toBe('https://image.example/first.jpg');
  expect(await resolveProviderPoster({providerValue: 'animeunity', link: sourceLink}))
    .toBe('https://image.example/first.jpg');
  expect(lookup).toHaveBeenCalledTimes(1);

  expect(await resolveProviderPoster({
    providerValue: 'animeunity', link: sourceLink, forceRefresh: true,
  })).toBe('https://image.example/second.jpg');
  expect(getCachedProviderPoster('streamcenter', scLink)?.value.poster)
    .toBe('https://image.example/second.jpg');
  expect(lookup).toHaveBeenCalledTimes(2);
});

it('invalidates old and expired SQLite posters before resolving artwork', async () => {
  const key = recordKey('preferredPosterW300V2', 'animeunity', sourceLink);
  const wrongPoster = 'https://image.example/big-bang.jpg';
  records.set(key, {
    value: {poster: wrongPoster}, updatedAt: Date.now(), checkedAt: Date.now(),
    providerVersion: 'previous-provider-version',
  });
  expect(getCachedProviderPoster('animeunity', sourceLink)).toBeUndefined();

  records.set(key, {
    value: {poster: wrongPoster},
    updatedAt: Date.now() - 25 * 60 * 60 * 1000,
    checkedAt: Date.now(), providerVersion: getProviderCacheScope('animeunity'),
  });
  expect(getCachedProviderPoster('animeunity', sourceLink)).toBeUndefined();

  const lookup = jest.spyOn(providerManager, 'getArtwork').mockResolvedValueOnce({
    resolved: true, poster: 'https://image.example/dark-machine.jpg',
  });
  expect(await resolveProviderPoster({providerValue: 'animeunity', link: sourceLink}))
    .toBe('https://image.example/dark-machine.jpg');
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(metadata.writeMetadata).toHaveBeenCalledWith(
    'preferredPosterW300V2', 'animeunity', sourceLink,
    {poster: 'https://image.example/dark-machine.jpg'},
    getProviderCacheScope('animeunity'),
  );
});
