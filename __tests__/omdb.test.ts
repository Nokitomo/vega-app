import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {searchOMDB} from '../src/lib/services/omdb';

const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

describe('searchOMDB', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not make a request without a configured API key', async () => {
    await expect(searchOMDB('game of', {apiKey: ''})).resolves.toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses the configured key and returns search results', async () => {
    const search = [
      {
        Title: 'Game of Thrones',
        Year: '2011–2019',
        imdbID: 'tt0944947',
        Type: 'series' as const,
        Poster: 'N/A',
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({Response: 'True', Search: search}),
    } as Response);

    await expect(
      searchOMDB(' game of ', {apiKey: 'configured-key'}),
    ).resolves.toEqual(search);
    const requestedUrl = String(mockFetch.mock.calls[0][0]);
    expect(requestedUrl).toContain('apikey=configured-key');
    expect(requestedUrl).toContain('s=game+of');
    expect(requestedUrl).toContain('r=json');
  });

  it('returns an empty list for API errors and unsuccessful responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({Response: 'False', Error: 'Invalid API key!'}),
    } as Response);
    await expect(searchOMDB('game', {apiKey: 'invalid-key'})).resolves.toEqual(
      [],
    );
  });
});
