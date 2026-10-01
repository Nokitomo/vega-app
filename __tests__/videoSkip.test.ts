import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {cacheStorage, secureStorage} from '../src/lib/storage';
import {
  getVideoSkipStamps,
  resolveAnimeSkip,
} from '../src/lib/services/videoSkip';
import {
  getAnimeSkipSession,
  loginAnimeSkip,
  logoutAnimeSkip,
} from '../src/lib/services/animeSkipAuth';

describe('video skip resolvers', () => {
  beforeEach(() => {
    cacheStorage.clearAll();
    secureStorage.clearAll();
    global.fetch = jest.fn() as typeof fetch;
  });

  it('uses the first non-empty resolver in Cloudstream order', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({found: false, results: []}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          intro: [{start_ms: 3000, end_ms: 93000}],
          credits: [],
          recap: [],
          preview: [],
        }),
      } as Response);

    const stamps = await getVideoSkipStamps({
      title: 'Example Anime',
      type: 'anime',
      malId: 123,
      tmdbId: 456,
      seasonNumber: 1,
      episodeNumber: 1,
      duration: 1440,
    });

    expect(stamps).toEqual([
      {
        type: 'intro',
        startTime: 3,
        endTime: 93,
        source: 'TheIntroDB',
      },
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][0])).toContain(
      'api.aniskip.com',
    );
    expect(String((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[1][0])).toContain(
      'api.theintrodb.org',
    );
  });

  it('skips AnimeSkip when the user is logged out', async () => {
    await expect(
      resolveAnimeSkip({
        title: 'Example',
        type: 'anime',
        malId: 1,
        episodeNumber: 1,
        duration: 1200,
      }),
    ).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('stores AnimeSkip session data in secure storage and logs out', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            login: {
              authToken: 'auth',
              refreshToken: 'refresh',
              account: {
                profileUrl: 'https://example.com/avatar.png',
                username: 'vega',
                email: 'vega@example.com',
              },
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({data: {myApiClients: [{id: 'client'}]}}),
      } as Response);

    await loginAnimeSkip('vega', 'password');
    expect(getAnimeSkipSession()).toEqual(
      expect.objectContaining({username: 'vega', clientId: 'client'}),
    );
    logoutAnimeSkip();
    expect(getAnimeSkipSession()).toBeUndefined();
  });
});
