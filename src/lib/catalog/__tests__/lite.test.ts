import {describe, expect, test} from '@jest/globals';
import {defaultCatalogPreferences, readCatalogPreferences} from '../preferences';
import {detailRows} from '../liteDetails';
import {normalizeDetailArtwork} from '../liteArtwork';
import {parseManifest, planDownload} from '../manifest';

describe('Cinema SQLite Lite', () => {
  test('uses a 200 MB default and persists a valid custom cache budget', () => {
    expect(readCatalogPreferences('{"version":1}').detailCacheMb).toBe(200);
    expect(readCatalogPreferences('{"version":1,"detailCacheMb":50}').detailCacheMb).toBe(50);
    expect(readCatalogPreferences('{"version":1,"detailCacheMb":-1}').detailCacheMb)
      .toBe(defaultCatalogPreferences().detailCacheMb);
  });

  test('installs a Lite snapshot without a delta from the old catalog', () => {
    const manifest = parseManifest({
      catalogId: 'cinema',
      schemaVersion: 1,
      format: 'vega-cinema-lite-v1',
      sourceCommit: 'a'.repeat(40),
      detailPath: 'cinema/data/items/{workId}.json',
      origins: {},
      revision: 'b'.repeat(64),
      counts: {works: 2, artwork: 1, image_rules: 1},
      activeCount: 2,
      snapshot: {
        name: 'cinema.sqlite.gz',
        url: `https://github.com/Nokitomo/database/releases/download/cinema-sqlite-lite-v1-${'c'.repeat(64)}/cinema.sqlite.gz`,
        sha256: 'd'.repeat(64), bytes: 100, uncompressedSha256: 'e'.repeat(64), uncompressedBytes: 200,
      },
    });
    expect(planDownload(manifest, 'f'.repeat(64))).toEqual([manifest.snapshot]);
  });

  test('preserves provider coordinates and blocks a null thumbnail override', () => {
    const work = 'cinema:work-42';
    const reference = {provider: 'streamingunity', titleId: 123, season: 1, episode: 2,
      episodeId: 901, availability: 'present'};
    const episode = {number: 3, playbackSources: [reference],
      thumbnail: 'https://image.tmdb.org/t/p/w300/replaced.jpg',
      metadataSources: {verifiedOverride: {thumbnail: null}}};
    const detail = {
      id: 'work-42',
      seasons: [{number: 24, episodes: [episode]}],
      providers: {streamingunity: [{id: 123, seasons: [{number: 1, episodes: [{number: 2, id: 901}]}]}]},
    };
    expect(detailRows(detail, work, 'episode', work + ':season:24')[0].payload).toEqual(episode);
    expect(detailRows(detail, work, 'source_episode', work + ':source:streamingunity:123:season:1')[0].payload.id)
      .toBe(901);
    expect(normalizeDetailArtwork(detail, {})).toEqual([]);
  });
});
