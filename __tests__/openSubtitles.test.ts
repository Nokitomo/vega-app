import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {
  getOpenSubtitlesDownloadUrl,
  searchOpenSubtitles,
  setOpenSubtitlesApiKey,
} from '../src/lib/services/openSubtitles';

describe('OpenSubtitles API client', () => {
  beforeEach(() => {
    setOpenSubtitlesApiKey('test-api-key');
    global.fetch = jest.fn() as typeof fetch;
  });

  it('maps search results and uses the modern API', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'subtitle-1',
            attributes: {
              language: 'it',
              release: 'Example.WEB-DL',
              feature_details: {
                title: 'Example',
                season_number: 1,
                episode_number: 2,
              },
              uploader: {name: 'Uploader'},
              files: [{file_id: 42, file_name: 'example.srt'}],
            },
          },
        ],
      }),
    } as Response);

    await expect(
      searchOpenSubtitles({
        query: 'tt1234567',
        language: 'it',
        season: '1',
        episode: '2',
      }),
    ).resolves.toEqual([
      expect.objectContaining({id: 'subtitle-1', fileId: 42, language: 'it'}),
    ]);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/subtitles?'),
      expect.objectContaining({
        headers: expect.objectContaining({'Api-Key': 'test-api-key'}),
      }),
    );
    expect(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][0],
    ).toContain('imdb_id=1234567');
  });

  it('requests a temporary download link using the selected file id', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => ({link: 'https://download.opensubtitles.com/file.srt'}),
    } as Response);

    await expect(getOpenSubtitlesDownloadUrl(42)).resolves.toBe(
      'https://download.opensubtitles.com/file.srt',
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.opensubtitles.com/api/v1/download',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({file_id: 42, sub_format: 'srt'}),
      }),
    );
  });
});
