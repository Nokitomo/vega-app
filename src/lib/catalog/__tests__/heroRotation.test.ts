import {afterEach, expect, jest, test} from '@jest/globals';
import {settingsStorage} from '../../storage/SettingsStorage';
import {loadCinemaHeroRotation} from '../heroRotation';
import {catalogHeroSummaries, catalogLiteArtwork, catalogRandomActiveIds} from '../reader';
import type {Artwork} from '../types';

jest.mock('../reader', () => ({
  catalogHeroSummaries: jest.fn(), catalogLiteArtwork: jest.fn(), catalogRandomActiveIds: jest.fn(),
}));

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test('keeps the daily selection and excludes two previous days when possible', async () => {
  jest.useFakeTimers();
  let saved: string | undefined;
  jest.spyOn(settingsStorage, 'getCinemaHeroRotation').mockImplementation(() => saved);
  jest.spyOn(settingsStorage, 'setCinemaHeroRotation').mockImplementation(value => {saved = value;});
  const allIds = Array.from({length: 42}, (_, i) => `cinema:work-${i}`);
  jest.mocked(catalogRandomActiveIds).mockImplementation(async (excluded, limit) => {
    const ignored = new Set(excluded);
    return allIds.filter(id => !ignored.has(id)).slice(0, limit);
  });
  jest.mocked(catalogHeroSummaries).mockImplementation(async ids => ids.map(id => ({id, title: id, language: 'it'})));
  jest.mocked(catalogLiteArtwork).mockImplementation(async ids => new Map(ids.map(id => [id,
    (['logo', 'poster'] as const).filter(field => id !== 'cinema:work-0' || field !== 'logo').map((field): Artwork => ({
      id: `${id}:${field}`, url: 'https://example.test/art.jpg', field, source: 'tmdb',
      language: 'it', eligible: true, forced: true, rank: 0, scope: 'work', season: null, episode: null,
    })),
  ])));
  const onDay = (day: number) => {
    const date = new Date(2026, 10, day, 12);
    jest.setSystemTime(date);
    return loadCinemaHeroRotation(date, 'revision', 0);
  };
  const first = await onDay(10);
  expect(await onDay(10)).toEqual(first);
  expect(catalogRandomActiveIds).toHaveBeenCalledTimes(1);
  const second = await onDay(11);
  const third = await onDay(12);
  const links = [...first, ...second, ...third].map(post => post.link);
  expect(links).toHaveLength(30);
  expect(new Set(links).size).toBe(30);
  expect(links).not.toContain('cinema:work-0');
});
