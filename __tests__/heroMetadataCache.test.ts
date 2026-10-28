import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {useHeroMetadata} from '../src/lib/hooks/useHomePageData';

let mockDurable: any;
let mockLegacy: any;
let mockPrevious: any;
let mockInfo: any;
let mockEnhancedError = false;
const mockWrite = jest.fn();
const mockWriteLegacy = jest.fn();
jest.mock('@tanstack/react-query', () => ({useQuery: (options: any) => options}));
jest.mock('../src/lib/services/ProviderManager', () => ({providerManager: {
  getMetaData: async () => mockInfo,
}}));
jest.mock('../src/lib/storage', () => ({cacheStorage: {}}));
jest.mock('../src/lib/client', () => ({queryClient: {getQueryData: () => mockPrevious}}));
jest.mock('../src/lib/storage/MetadataDatabase', () => ({
  readMetadata: () => mockDurable, writeMetadata: (...args: any[]) => mockWrite(...args),
}));
jest.mock('../src/lib/utils/persistedCache', () => ({
  readPersistedCache: () => mockLegacy,
  writePersistedCache: (...args: any[]) => mockWriteLegacy(...args),
}));
jest.mock('../src/lib/utils/providerCacheScope', () => ({
  getProviderCacheScope: (value: string) => value,
  buildProviderCacheKey: (...args: string[]) => args.join(':'),
}));
jest.mock('../src/lib/services/enhancedMeta', () => ({
  buildEnhancedMetaKey: (info: any) => info.imdbId || '',
  fetchEnhancedMetadata: async () => {
    if (mockEnhancedError) {throw new Error('network');}
    return {name: 'Enhanced name', genres: ['Enhanced genre'], logo: 'enhanced-logo'};
  },
}));
jest.mock('../src/lib/services/animeMeta', () => ({fetchAniListBanner: jest.fn()}));
jest.mock('../src/i18n', () => ({__esModule: true, default: {t: (key: string) => key}}));

const options = () => useHeroMetadata('/titles/1', 'streamingunity') as unknown as {
  initialData: () => any;
  initialDataUpdatedAt: () => number;
  queryFn: () => Promise<any>;
  staleTime: (query: any) => number;
};
const complete = {title: 'Title', synopsis: 'Synopsis', background: 'background',
  logo: 'logo', tags: ['Provider genre']};

beforeEach(() => {
  mockDurable = undefined;
  mockLegacy = undefined;
  mockPrevious = undefined;
  mockInfo = {...complete};
  mockEnhancedError = false;
  mockWrite.mockClear();
  mockWriteLegacy.mockClear();
});

describe('hero cache recovery', () => {
  it('ignores old incomplete SQLite and MMKV results', () => {
    mockDurable = {value: {title: '', synopsis: ''}, updatedAt: 20};
    mockLegacy = {value: {title: 'Title'}, updatedAt: 10};
    expect(options().initialData()).toBeUndefined();
  });
  it('can still use a valid legacy cache when SQLite contains a partial fallback', () => {
    mockDurable = {value: {}, updatedAt: 20};
    mockLegacy = {value: complete, updatedAt: 10};
    expect(options().initialData()).toEqual(complete);
    expect(options().initialDataUpdatedAt()).toBe(10);
  });
  it('does not persist an empty successful provider response', async () => {
    mockInfo = {title: '', synopsis: '', image: 'poster'};
    await expect(options().queryFn()).rejects.toThrow('Unable to load details');
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockWriteLegacy).not.toHaveBeenCalled();
  });
  it('preserves a previously complete snapshot if a refresh loses the logo', async () => {
    mockPrevious = complete;
    mockInfo = {...complete, logo: undefined};
    await expect(options().queryFn()).rejects.toThrow();
    expect(mockWrite).not.toHaveBeenCalled();
  });
  it('persists eligible metadata and keeps provider tag and artwork priorities', async () => {
    mockInfo = {...complete, imdbId: 'tt123', type: 'series'};
    const value = await options().queryFn();
    expect(value.tags).toEqual(complete.tags);
    expect(value.background).toBe('background');
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockWriteLegacy).toHaveBeenCalledTimes(1);
  });
  it('keeps the existing provider fallback on enrichment failure, with bounded freshness', async () => {
    mockInfo = {...complete, imdbId: 'tt123', type: 'series'};
    mockEnhancedError = true;
    const value = await options().queryFn();
    expect(value.title).toBe('Title');
    expect(value.heroRefreshNeeded).toBe(true);
    expect(options().staleTime({state: {data: value}})).toBe(300000);
  });
  it('uses finite freshness even for rich data and does not require a logo', async () => {
    mockInfo = {...complete, logo: undefined};
    const value = await options().queryFn();
    expect(options().staleTime({state: {data: value}})).toBe(300000);
    expect(options().staleTime({state: {data: complete}})).toBe(86400000);
  });
});
