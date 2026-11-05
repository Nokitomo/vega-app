import {beforeEach, describe, expect, it, jest} from '@jest/globals';
const mockStore = new Map<string, any>();
jest.mock('../src/lib/storage', () => ({
  secureStorage: {
    getObject: (k: string) => mockStore.get(k),
    setObject: (k: string, v: unknown) => mockStore.set(k, v),
    getString: (k: string) => mockStore.get(k),
    setString: (k: string, v: string) => mockStore.set(k, v),
  },
  settingsStorage: {getAppLanguage: () => 'it'},
}));
jest.mock('../src/i18n', () => ({
  __esModule: true,
  default: {t: (s: string) => s},
}));
import {
  getStremioAddons,
  installStremioAddon,
  removeStremioAddon,
  normalizeAddonUrl,
  parseAddonManifest,
  matchesSubtitleRequest,
  refreshStremioAddon,
  searchStremioSubtitles,
  subtitleVideoId,
  toggleStremioAddon,
  getSubtitleLanguage,
} from '../src/lib/services/stremioAddons';
import {identifySubtitleFormat} from '../src/lib/services/addonSubtitleFile';
const manifest = {
  id: 'test',
  version: '1',
  name: 'Test',
  types: ['series'],
  resources: ['subtitles'],
  idPrefixes: ['tt'],
};
const fakeResponse = (body: any, ok = true) =>
  ({
    ok,
    status: ok ? 200 : 500,
    headers: {get: () => null},
    text: async () => JSON.stringify(body),
  }) as any;
const mockFetch = jest.fn<typeof fetch>();

beforeEach(() => {
  getStremioAddons().forEach(a => removeStremioAddon(a.url));
  mockStore.clear();
  mockFetch.mockReset();
  global.fetch = mockFetch;
});

describe('Stremio subtitle addons', () => {
  it('seeds the official addon once and respects removal and language defaults', () => {
    const addon = getStremioAddons()[0];
    expect(addon.id).toBe('org.stremio.opensubtitlesv3');
    expect(addon.enabled).toBe(true);
    removeStremioAddon(addon.url);
    expect(getStremioAddons()).toEqual([]);
    expect(getSubtitleLanguage()).toBe('it');
  });
  it('normalizes install links and blocks local or credential-bearing URLs', () => {
    expect(
      normalizeAddonUrl(' stremio://example.org/config/manifest.json '),
    ).toBe('https://example.org/config/manifest.json');
    for (const url of [
      'http://example.org/manifest.json',
      'https://127.0.0.1/manifest.json',
      'https://user:pass@example.org/manifest.json',
      'https://localhost/manifest.json',
      'https://example.org/configure',
    ]) {
      expect(() => normalizeAddonUrl(url)).toThrow();
    }
  });
  it('rejects malformed manifests and preserves unsupported addons as inactive', () => {
    expect(() =>
      parseAddonManifest({}, 'https://example.org/manifest.json'),
    ).toThrow('addon.invalidManifest');
    const addon = parseAddonManifest(
      {...manifest, resources: ['stream']},
      'https://example.org/manifest.json',
    );
    installStremioAddon(addon);
    toggleStremioAddon(addon.url);
    expect(getStremioAddons().find(a => a.id === 'test')?.enabled).toBe(false);
  });
  it('honors resource-specific restrictions and required configuration', () => {
    const addon = parseAddonManifest(
      {
        ...manifest,
        resources: [
          {name: 'subtitles', types: ['movie'], idPrefixes: ['custom:']},
        ],
      },
      'https://example.org/manifest.json',
    );
    expect(matchesSubtitleRequest(addon, 'series', 'tt1')).toBe(false);
    expect(matchesSubtitleRequest(addon, 'movie', 'custom:1')).toBe(true);
    expect(
      parseAddonManifest(
        {...manifest, behaviorHints: {configurationRequired: true}},
        addon.url,
      ).enabled,
    ).toBe(false);
  });
  it('rejects duplicates but permits different configurations of one addon', () => {
    const addon = parseAddonManifest(
      manifest,
      'https://example.org/one/manifest.json',
    );
    installStremioAddon(addon);
    expect(() => installStremioAddon(addon)).toThrow('addon.duplicate');
    installStremioAddon({
      ...addon,
      url: 'https://example.org/two/manifest.json',
    });
    expect(getStremioAddons()).toHaveLength(3);
  });
  it('does not resurrect an addon removed while its manifest refreshes', async () => {
    const addon = getStremioAddons()[0];
    mockFetch.mockImplementationOnce(async () => {
      removeStremioAddon(addon.url);
      return fakeResponse(manifest);
    });
    await refreshStremioAddon(addon.url);
    expect(getStremioAddons()).toEqual([]);
  });
  it('requires exact series metadata, including season zero specials', () => {
    expect(subtitleVideoId('tt1475582', 'series', '0', '1')).toBe(
      'tt1475582:0:1',
    );
    expect(subtitleVideoId('tt1475582', 'movie')).toBe('tt1475582');
    expect(() => subtitleVideoId('Sherlock', 'movie')).toThrow(
      'addon.imdbRequired',
    );
    expect(() => subtitleVideoId('tt1', 'series', '', '1')).toThrow(
      'addon.episodeRequired',
    );
  });
  it('maps Italian, filters invalid URLs, deduplicates and caches results', async () => {
    const sub = {
      id: '1',
      lang: 'ita',
      url: 'https://example.org/sub.srt',
      subtitleFileName: 'release',
    };
    mockFetch.mockResolvedValue(
      fakeResponse({
        subtitles: [
          sub,
          sub,
          {...sub, url: 'file:///private'},
          {...sub, lang: 'eng', url: 'https://example.org/english.srt'},
        ],
      }),
    );
    const args = {
      imdb: 'tt1475582',
      type: 'series' as const,
      season: '1',
      episode: '1',
      language: 'it',
    };
    const first = await searchStremioSubtitles(args);
    expect(first.results).toHaveLength(1);
    expect(first.results[0].label).toBe('release');
    await searchStremioSubtitles(args);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    toggleStremioAddon(getStremioAddons()[0].url);
    await expect(searchStremioSubtitles(args)).rejects.toThrow(
      'addon.noCompatible',
    );
  });
  it('keeps successful sources when another addon fails without exposing tokens', async () => {
    installStremioAddon(
      parseAddonManifest(
        manifest,
        'https://example.org/private-token/manifest.json',
      ),
    );
    mockFetch.mockResolvedValueOnce(
      fakeResponse({
        subtitles: [{id: '1', lang: 'ita', url: 'https://example.org/s.srt'}],
      }),
    );
    mockFetch.mockRejectedValueOnce(new Error('private-token'));
    const result = await searchStremioSubtitles({
      imdb: 'tt1',
      type: 'series',
      season: '1',
      episode: '1',
      language: 'it',
    });
    expect(result.results).toHaveLength(1);
    expect(result.failed).toEqual(['Test']);
  });
  it('discards results after cancellation', async () => {
    const controller = new AbortController();
    mockFetch.mockImplementationOnce(async () => {
      controller.abort();
      return fakeResponse({
        subtitles: [{id: '1', lang: 'ita', url: 'https://example.org/s.srt'}],
      });
    });
    expect(
      await searchStremioSubtitles({
        imdb: 'tt1',
        type: 'movie',
        language: 'it',
        signal: controller.signal,
      }),
    ).toEqual({results: [], failed: []});
  });
  it('identifies subtitle files and rejects HTML error pages', () => {
    expect(
      identifySubtitleFormat('1\n00:00:01,000 --> 00:00:03,000\nCiao')
        .extension,
    ).toBe('srt');
    expect(identifySubtitleFormat('WEBVTT\n').extension).toBe('vtt');
    expect(() => identifySubtitleFormat('<html>Error</html>')).toThrow(
      'addon.invalidSubtitle',
    );
  });
});
