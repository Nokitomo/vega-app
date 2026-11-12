import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {
  playbackEpisodes,
  type CatalogSource,
  type CatalogEpisode,
} from '../content';
import {catalogChildren, catalogImages} from '../reader';
import type {CatalogRecord, Work} from '../types';

jest.mock('../reader', () => ({
  catalogChildren: jest.fn(),
  catalogImages: jest.fn(),
}));
const work: CatalogRecord<Work> = {
  id: 'cinema:work-1',
  payload: {active: true, info: {title: 'Canonical', original_language: 'en'}},
};
const source: CatalogRecord<CatalogSource> = {
  id: 'source-9',
  payload: {
    provider: 'streamingunity',
    id: 9,
    path: '/it/titles/9-example',
    availability: 'present',
    info: {},
  },
};
const season = {id: 'season-4', payload: {number: 4}};
let episode: CatalogEpisode;

beforeEach(() => {
  jest.clearAllMocks();
  episode = {
    number: 3,
    title: 'Correct title',
    synopsis: 'Correct synopsis',
    metadataSources: {'streamingunity:9': {}},
  };
  (
    catalogImages as jest.MockedFunction<typeof catalogImages>
  ).mockResolvedValue([]);
  (
    catalogChildren as jest.MockedFunction<typeof catalogChildren>
  ).mockImplementation(async (kind: string, _work: string, parent?: string) => {
    if (kind === 'episode') {
      return [{id: 'episode', payload: episode}] as any;
    }
    if (kind === 'source_season') {
      return [
        {id: 'raw-season-4', payload: {number: 4}},
        {id: 'raw-season-1', payload: {number: 1}},
      ] as any;
    }
    if (kind === 'source_episode') {
      return [
        {
          id: 'raw-episode',
          payload: {
            number: parent === 'raw-season-1' ? 8 : 3,
            id: parent === 'raw-season-1' ? 800 : 300,
            name: 'Wrong title',
          },
        },
      ] as any;
    }
    return [];
  });
});
describe('catalog playback mapping', () => {
  test('keeps canonical metadata and uses the actual provider episode ID', async () => {
    expect(await playbackEpisodes(work, source, season)).toEqual([
      expect.objectContaining({
        title: 'Correct title',
        synopsis: 'Correct synopsis',
        episodeNumber: 3,
        seasonNumber: 4,
        link: '/it/titles/9-example::300',
      }),
    ]);
  });
  test('composition coordinates come from the explicit source map', async () => {
    episode.playbackSources = [
      {
        provider: 'streamingunity',
        titleId: 9,
        season: 1,
        episode: 8,
        episodeId: 800,
        availability: 'present',
      },
    ];
    expect(await playbackEpisodes(work, source, season)).toEqual([
      expect.objectContaining({
        episodeNumber: 3,
        sourceEpisodeNumber: 8,
        seasonNumber: 4,
        link: '/it/titles/9-example::800',
      }),
    ]);
  });
  test('does not guess a mapping when another source owns a composition episode', async () => {
    episode.playbackSources = [
      {
        provider: 'streamingunity',
        titleId: 77,
        season: 1,
        episode: 8,
        episodeId: 800,
        availability: 'present',
      },
    ];
    expect(await playbackEpisodes(work, source, season)).toEqual([]);
  });
  test('does not invent provider membership for an unmapped canonical episode', async () => {
    episode.metadataSources = {tmdb: {}};
    expect(await playbackEpisodes(work, source, season)).toEqual([]);
  });
  test('a null verified thumbnail never falls back to provider art', async () => {
    episode.metadataSources!.verifiedOverride = {thumbnail: null};
    (
      catalogImages as jest.MockedFunction<typeof catalogImages>
    ).mockResolvedValue([
      {
        id: 'wrong',
        source: 'streamingunity',
        url: 'https://example.test/wrong.jpg',
        eligible: true,
        forced: false,
        rank: 0,
        language: 'it',
        scope: 'episode',
        field: 'thumbnail',
        season: 4,
        episode: 3,
      },
    ]);
    expect(
      (await playbackEpisodes(work, source, season))[0].thumbnail,
    ).toBeUndefined();
  });
  test('unavailable sources cannot produce streams', async () => {
    expect(
      await playbackEpisodes(
        work,
        {...source, payload: {...source.payload, availability: 'unavailable'}},
        season,
      ),
    ).toEqual([]);
  });
});
