import {beforeEach, describe, expect, it, jest} from '@jest/globals';
jest.mock('../src/i18n', () => ({
  __esModule: true,
  default: {t: (s: string) => s},
}));
jest.mock('../src/lib/services/stremioAddons', () => ({
  publicHttpsUrl: (s: string) => s,
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));
import * as fs from 'expo-file-system/legacy';
import {downloadAddonSubtitle} from '../src/lib/services/addonSubtitleFile';

const body = '1\n00:00:01,000 --> 00:00:03,000\nTest';
const mockFetch = jest.fn<typeof fetch>();
beforeEach(() => {
  jest.clearAllMocks();
  (
    fs.readDirectoryAsync as jest.MockedFunction<typeof fs.readDirectoryAsync>
  ).mockResolvedValue([]);
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({
    ok: true,
    headers: {get: () => null},
    text: async () => body,
  } as any);
});
describe('Addon subtitle downloads', () => {
  it('writes a private temporary subtitle with its detected native format', async () => {
    const file = await downloadAddonSubtitle('https://example.org/sub');
    expect(file.uri).toMatch(
      /^file:\/\/\/cache\/stremio-subtitles\/\d+-[a-z0-9]+\.srt$/,
    );
    expect(file.type).toBe('application/x-subrip');
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith(file.uri, body);
  });
  it('rejects HTML responses without writing or exposing server errors', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: {get: () => null},
      text: async () => '<html>private-token</html>',
    } as any);
    await expect(
      downloadAddonSubtitle('https://example.org/token'),
    ).rejects.toThrow('addon.downloadFailed');
    expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
  });
  it('discards cancelled downloads before creating files', async () => {
    const controller = new AbortController();
    mockFetch.mockImplementationOnce(async () => {
      controller.abort();
      return {
        ok: true,
        headers: {get: () => null},
        text: async () => body,
      } as any;
    });
    await expect(
      downloadAddonSubtitle('https://example.org/sub', controller.signal),
    ).rejects.toThrow('addon.downloadFailed');
    expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
  });
  it('cleans only old generated files, preserving recent and foreign files', async () => {
    const recent = `${Date.now()}-recent.srt`;
    (
      fs.readDirectoryAsync as jest.MockedFunction<typeof fs.readDirectoryAsync>
    ).mockResolvedValue(['1-old.srt', recent, 'my-subtitle.srt']);
    await downloadAddonSubtitle('https://example.org/sub');
    expect(fs.deleteAsync).toHaveBeenCalledTimes(1);
    expect(fs.deleteAsync).toHaveBeenCalledWith(
      'file:///cache/stremio-subtitles/1-old.srt',
      {idempotent: true},
    );
  });
});
