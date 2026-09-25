import {describe, expect, it} from '@jest/globals';
import {
  selectAnimeUnityBackground,
  shouldFetchAniListBanner,
} from '../src/lib/services/animeArtwork';

describe('AnimeUnity artwork priority', () => {
  it('keeps the provider seasonal background ahead of AniList', () => {
    expect(
      selectAnimeUnityBackground({
        backgroundSource: 'provider',
        providerBackground: 'https://provider.test/season.jpg',
        aniListBanner: 'https://anilist.test/banner.jpg',
      }),
    ).toBe('https://provider.test/season.jpg');
  });

  it('inserts the AniList banner before non-provider fallbacks', () => {
    for (const backgroundSource of ['tmdb', 'cinemeta', 'anizip'] as const) {
      expect(
        selectAnimeUnityBackground({
          backgroundSource,
          providerBackground: `https://${backgroundSource}.test/background.jpg`,
          aniListBanner: 'https://anilist.test/banner.jpg',
        }),
      ).toBe('https://anilist.test/banner.jpg');
    }
  });

  it('falls back to the provider-selected background without an AniList banner', () => {
    expect(
      selectAnimeUnityBackground({
        backgroundSource: 'tmdb',
        providerBackground: 'https://tmdb.test/background.jpg',
      }),
    ).toBe('https://tmdb.test/background.jpg');
  });

  it('requests AniList only when it can outrank the current background', () => {
    expect(
      shouldFetchAniListBanner({
        anilistId: 123,
        backgroundSource: 'provider',
      }),
    ).toBe(false);
    expect(
      shouldFetchAniListBanner({
        anilistId: 123,
        backgroundSource: 'tmdb',
      }),
    ).toBe(true);
    expect(shouldFetchAniListBanner({backgroundSource: 'tmdb'})).toBe(false);
  });
});
