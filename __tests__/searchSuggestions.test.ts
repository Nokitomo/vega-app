import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {fetchTitleSuggestions} from '../src/lib/services/searchSuggestions';

const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

describe('fetchTitleSuggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps IMDb as the primary source', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        d: [{id: 'tt0944947', l: 'Game of Thrones', qid: 'tvSeries', y: 2011}],
      }),
    } as Response);

    const results = await fetchTitleSuggestions('game of', undefined, {
      omdbApiKey: 'configured-key',
    });
    expect(results[0]).toMatchObject({
      title: 'Game of Thrones',
      source: 'imdb',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('uses OMDb only when IMDb returns no suggestions', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({d: []}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Response: 'True',
          Search: [
            {
              Title: 'Game of Thrones',
              Year: '2011–2019',
              imdbID: 'tt0944947',
              Type: 'series',
              Poster: 'N/A',
            },
          ],
        }),
      } as Response);

    await expect(
      fetchTitleSuggestions('game of', undefined, {
        omdbApiKey: 'configured-key',
      }),
    ).resolves.toEqual([
      {
        id: 'tt0944947',
        title: 'Game of Thrones',
        type: 'tv',
        year: 2011,
        source: 'omdb',
      },
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
