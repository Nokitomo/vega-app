import {describe, expect, it} from '@jest/globals';
import {resolveAnimeExternalIds} from '../src/lib/providers/externalIds';

describe('resolveAnimeExternalIds', () => {
  it('uses the singular ids when present', () => {
    expect(
      resolveAnimeExternalIds({
        malId: 1735,
        anilistId: 1735,
        malIds: [21],
        anilistIds: [21],
      }),
    ).toEqual({malId: 1735, anilistId: 1735});
  });

  it('falls back to the array ids returned by AnimeUnity', () => {
    expect(
      resolveAnimeExternalIds({malIds: [1735], anilistIds: [1735]}),
    ).toEqual({malId: 1735, anilistId: 1735});
  });
});
