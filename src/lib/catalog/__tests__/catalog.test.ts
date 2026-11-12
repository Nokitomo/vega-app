import {
  defaultCatalogPreferences,
  readCatalogPreferences,
} from '../preferences';
import {describe, test, expect} from '@jest/globals';
import {selectImages, imageUrl} from '../artwork';
import {parseManifest, planDownload, recordKinds} from '../manifest';
import type {Artwork, CatalogManifest, DeltaAsset} from '../types';

const sha = (n: string) => n.repeat(64);
const asset = (n: string, bytes = 10) => ({
  name: `${n}.gz`,
  bytes,
  sha256: sha(n),
  url: `https://github.com/Nokitomo/database/releases/download/cinema-sqlite-v1-${sha('a')}/${n}.gz`,
});
function manifest(): CatalogManifest {
  return {
    catalogId: 'cinema',
    schemaVersion: 1,
    minimumReaderVersion: 1,
    validationOnly: false,
    revision: sha('c'),
    activeCount: 1,
    counts: Object.fromEntries([...recordKinds].map(k => [k, 1])),
    deltas: [],
    snapshot: {
      ...asset('a', 1000),
      uncompressedBytes: 5000,
      uncompressedSha256: sha('b'),
    },
  };
}
const delta = (from: string, to: string, bytes = 10): DeltaAsset => ({
  ...asset(to, bytes),
  fromRevision: sha(from),
  toRevision: sha(to),
});
const art = (
  source: string,
  language: string | null,
  extra: Partial<Artwork> = {},
): Artwork => ({
  id: `${source}:${language}`,
  url: `https://image.tmdb.org/t/p/original/${source}-${language}.jpg`,
  source,
  language,
  field: 'poster',
  scope: 'work',
  season: null,
  episode: null,
  eligible: true,
  forced: false,
  rank: 0,
  ...extra,
});

describe('catalog artwork contract', () => {
  test('uses configured languages, original language and deterministic fallback', () => {
    const p = defaultCatalogPreferences();
    const rows = [
      art('streamingunity', 'it'),
      art('tvdb', null),
      art('tmdb', 'xx'),
      art('tmdb', 'ja'),
      art('tmdb', 'en'),
      art('tmdb', 'it'),
    ];
    expect(selectImages(rows, 'poster', p, {originalLanguage: 'ja'})).toEqual(
      [...rows].reverse().map(r => r.url),
    );
  });
  test('verified forced images override preferences but ineligible images never do', () => {
    const good = art('tmdb', 'en', {forced: true});
    expect(
      selectImages(
        [
          art('streamingunity', 'it'),
          good,
          art('tmdb', 'it', {forced: true, eligible: false}),
        ],
        'episodeThumbnail',
        defaultCatalogPreferences(),
      ),
    ).toEqual([good.url]);
  });
  test('explicit null override disables every fallback', () => {
    expect(
      selectImages(
        [art('tmdb', 'it', {forced: true})],
        'episodeThumbnail',
        defaultCatalogPreferences(),
        {blocked: true},
      ),
    ).toEqual([]);
  });
  test('does not silently treat unknown language as no language', () => {
    expect(
      selectImages(
        [art('tmdb', null), art('streamingunity', null)],
        'poster',
        defaultCatalogPreferences(),
      ),
    ).toEqual([]);
  });
  test('changes only supported TMDB sizes, keeps provider URLs and SVG intact', () => {
    const tmdb = art('tmdb', 'it');
    expect(imageUrl(tmdb, 'poster', 'w342')).toContain('/t/p/w342/');
    expect(imageUrl(tmdb, 'episodeThumbnail', 'w342')).toBe(tmdb.url);
    const provider = {...tmdb, source: 'streamingunity'};
    expect(imageUrl(provider, 'poster', 'w342')).toBe(provider.url);
    const svg = {...tmdb, url: tmdb.url.replace('.jpg', '.svg')};
    expect(imageUrl(svg, 'logo', 'w45')).toBe(svg.url);
  });
  test('empty preference order is preserved instead of resurrecting defaults', () => {
    const p = defaultCatalogPreferences();
    p.order.poster = [];
    expect(readCatalogPreferences(JSON.stringify(p)).order.poster).toEqual([]);
  });
  test('recovers invalid settings and invalid image sizes', () => {
    expect(readCatalogPreferences('{')).toEqual(defaultCatalogPreferences());
    const p = defaultCatalogPreferences();
    p.quality.poster = 'w999';
    expect(readCatalogPreferences(JSON.stringify(p)).quality.poster).toBe(
      'original',
    );
  });
  test('repairs a Home emptied by older settings without changing image choices', () => {
    const p = defaultCatalogPreferences();
    p.order.poster = [];
    p.sections = [];
    expect(readCatalogPreferences(JSON.stringify(p))).toMatchObject({
      order: {poster: []},
      heroSection: 'popular',
      sections: defaultCatalogPreferences().sections,
    });
    p.sections = [{...defaultCatalogPreferences().sections[0], enabled: false}];
    p.heroSection = 'missing';
    const repaired = readCatalogPreferences(JSON.stringify(p));
    expect(repaired.sections[0].enabled).toBe(true);
    expect(repaired.heroSection).toBe('movies');
  });
});
describe('catalog publication and incremental planning', () => {
  test('accepts the published interface', () => {
    expect(parseManifest(manifest()).catalogId).toBe('cinema');
  });
  test.each([
    {validationOnly: true},
    {minimumReaderVersion: 2},
    {schemaVersion: 2},
    {catalogId: 'other'},
    {revision: 'bad'},
  ])('rejects incomplete or incompatible publications: %p', override => {
    expect(() => parseManifest({...manifest(), ...override})).toThrow(
      'catalog.invalidManifest',
    );
  });
  test.each([
    'http://github.com/Nokitomo/database/x.gz',
    'https://evil.test/a.gz',
    'https://github.com/other/database/releases/download/a/b.gz',
  ])('rejects untrusted asset URL %s', url => {
    const m = manifest();
    m.snapshot.url = url;
    expect(() => parseManifest(m)).toThrow();
  });
  test('initial installation gets a snapshot, same revision gets nothing', () => {
    const m = manifest();
    expect(planDownload(m)).toEqual([m.snapshot]);
    expect(planDownload(m, m.revision)).toEqual([]);
  });
  test('uses a complete cheaper incremental chain', () => {
    const m = manifest();
    m.deltas = [delta('a', 'b'), delta('b', 'c')];
    expect(planDownload(m, sha('a'))).toEqual(m.deltas);
  });
  test('missing or costly chain falls back to a snapshot', () => {
    const m = manifest();
    m.deltas = [delta('a', 'b'), delta('d', 'c')];
    expect(planDownload(m, sha('a'))).toEqual([m.snapshot]);
    m.deltas = [delta('a', 'c', 1100)];
    expect(planDownload(m, sha('a'))).toEqual([m.snapshot]);
  });
  test('reverted revisions start from their most recent occurrence', () => {
    const m = manifest();
    m.deltas = [delta('a', 'b'), delta('b', 'a'), delta('a', 'c')];
    expect(planDownload(m, sha('a'))).toEqual([m.deltas[2]]);
  });
});
