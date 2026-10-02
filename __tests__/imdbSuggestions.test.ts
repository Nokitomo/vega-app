import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {fetchIMDbSuggestions} from '../src/lib/services/imdbSuggestions';

const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

describe('fetchIMDbSuggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not request suggestions for queries shorter than two characters', async () => {
    await expect(fetchIMDbSuggestions(' g ')).resolves.toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('maps, classifies, deduplicates and limits IMDb title suggestions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        d: [
          {id: 'tt0944947', l: 'Game of Thrones', qid: 'tvSeries', y: 2011},
          {id: 'tt0000001', l: 'game of thrones', q: 'TV series'},
          {id: 'tt1515091', l: 'Sherlock Holmes', qid: 'movie', y: 2011},
        ],
      }),
    } as Response);

    await expect(fetchIMDbSuggestions(' Game of ')).resolves.toEqual([
      {
        id: 'tt0944947',
        title: 'Game of Thrones',
        type: 'tv',
        year: 2011,
        source: 'imdb',
      },
      {
        id: 'tt1515091',
        title: 'Sherlock Holmes',
        type: 'movie',
        year: 2011,
        source: 'imdb',
      },
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://v3.sg.media-imdb.com/suggestion/titles/g/game%20of.json',
      expect.objectContaining({
        headers: {Accept: 'application/json'},
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('uses the x bucket for a non-alphanumeric first character', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({d: []}),
    } as Response);
    await fetchIMDbSuggestions('.hack');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://v3.sg.media-imdb.com/suggestion/titles/x/.hack.json',
      expect.objectContaining({signal: expect.any(AbortSignal)}),
    );
  });

  it('returns an empty list on request errors', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    await expect(fetchIMDbSuggestions('game')).resolves.toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
