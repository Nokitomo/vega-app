import {describe, expect, it} from '@jest/globals';
import {
  resolveLegacyAnimeUnityImageUrl,
  resolveWebViewLink,
} from '../src/lib/utils/providerLinks';

describe('AnimeUnity legacy links', () => {
  it('opens a saved .so page on the current host without changing its path', () => {
    expect(resolveWebViewLink('https://www.animeunity.so/anime/42-example?x=1'))
      .toBe('https://www.animeunity.co/anime/42-example?x=1');
  });

  it('updates only the old AnimeUnity image host', () => {
    expect(resolveLegacyAnimeUnityImageUrl('https://img.animeunity.so/anime/42.jpg'))
      .toBe('https://img.animeunity.co/anime/42.jpg');
    expect(resolveLegacyAnimeUnityImageUrl('https://cdn.example/42.jpg'))
      .toBe('https://cdn.example/42.jpg');
  });
});
