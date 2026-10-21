import {beforeEach, afterEach, describe, expect, it, jest} from '@jest/globals';
import {cacheStorageService} from '../src/lib/storage';
import {getBaseUrl} from '../src/lib/providers/getBaseUrl';

jest.mock('../src/lib/storage', () => ({
  cacheStorageService: {
    getString: jest.fn(),
    getObject: jest.fn(),
    setString: jest.fn(),
    setObject: jest.fn(),
  },
}));

const originalFetch = global.fetch;

describe('AnimeUnity base URL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(cacheStorageService.getString).mockReturnValue(undefined);
    jest.mocked(cacheStorageService.getObject).mockReturnValue(undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses the final host of a redirect from the Pastebin home URL', async () => {
    const fetchMock = jest.fn(async (url: string) =>
      ({
        text: async () => 'https://www.animeunity.so',
        ok: true,
        url: url.includes('pastebin')
          ? url
          : 'https://www.animeunity.co/',
      }) as Response,
    );
    global.fetch = fetchMock as typeof fetch;

    expect(await getBaseUrl('animeunity')).toBe('https://www.animeunity.co');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.animeunity.so/',
      expect.objectContaining({signal: expect.anything()}),
    );
    expect(cacheStorageService.setString).toHaveBeenCalledWith(
      'CacheBaseUrlanimeunity:v3',
      'https://www.animeunity.co',
    );
  });

  it('does not cache a redirect to an unrelated host', async () => {
    global.fetch = jest.fn(async (url: string) =>
      ({
        text: async () => 'https://www.animeunity.so',
        ok: true,
        url: url.includes('pastebin') ? url : 'https://unrelated.example/',
      }) as Response,
    ) as typeof fetch;

    expect(await getBaseUrl('animeunity')).toBe('');
    expect(cacheStorageService.setString).not.toHaveBeenCalled();
  });

  it('resolves the fallback through its redirect if Pastebin fails', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('pastebin')) {
        throw new Error('offline');
      }
      return {ok: true, url: 'https://www.animeunity.co/'} as Response;
    }) as typeof fetch;

    expect(await getBaseUrl('animeunity')).toBe('https://www.animeunity.co');
  });

  it('uses the current fallback when the old Pastebin host has no DNS', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('pastebin')) {
        return {text: async () => 'https://www.animeunity.so'} as Response;
      }
      if (url.includes('animeunity.so')) {
        throw new Error('DNS unavailable');
      }
      return {ok: true, url: 'https://www.animeunity.co/'} as Response;
    }) as typeof fetch;

    expect(await getBaseUrl('animeunity')).toBe('https://www.animeunity.co');
  });

  it('shares an unresolved host lookup between simultaneous callers', async () => {
    const fetchMock = jest.fn(async (url: string) =>
      ({
        text: async () => 'https://www.animeunity.so',
        ok: true,
        url: url.includes('pastebin') ? url : 'https://www.animeunity.co/',
      }) as Response,
    );
    global.fetch = fetchMock as typeof fetch;

    expect(await Promise.all([
      getBaseUrl('animeunity'),
      getBaseUrl('animeunity'),
    ])).toEqual(['https://www.animeunity.co', 'https://www.animeunity.co']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
