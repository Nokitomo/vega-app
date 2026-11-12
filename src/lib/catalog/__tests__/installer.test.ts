import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {AppState} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {openDatabaseAsync} from 'expo-sqlite';
import {installPendingCatalog} from '../installer';
import {defaultCatalogPreferences} from '../preferences';
import {recordKinds} from '../manifest';

jest.mock('../native', () => ({catalogNative: () => mockNative}));
jest.mock('../store', () => ({useCatalogStore: {getState: () => mockState}}));
jest.mock('../reader', () => ({
  readCatalog: jest.fn(() => Promise.resolve()),
  closeCatalog: jest.fn(),
}));
jest.mock('expo-sqlite', () => ({openDatabaseAsync: jest.fn()}));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  getFSInfo: jest.fn(),
  hash: jest.fn(),
  stat: jest.fn(),
  exists: jest.fn(),
  unlink: jest.fn(),
  copyFile: jest.fn(),
}));
jest.mock('../../../i18n', () => ({
  __esModule: true,
  default: {t: (s: string) => s},
}));

const resolved = () =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(undefined);
const mockNative = {
  pending: resolved(),
  root: resolved(),
  gunzip: resolved(),
  acknowledge: resolved(),
  configure: resolved(),
  cancel: resolved(),
  start: resolved(),
};
const original = {
  revision: 'b'.repeat(64),
  file: `catalog-${'b'.repeat(64)}-123.sqlite`,
  bytes: 4000,
  installedAt: 1,
};
const mockState = {
  installed: {...original},
  preferences: defaultCatalogPreferences(),
  setInstalled: jest.fn(),
  setTransfer: jest.fn(),
};
const m = {
  catalogId: 'cinema',
  schemaVersion: 1,
  minimumReaderVersion: 1,
  validationOnly: false,
  revision: 'c'.repeat(64),
  counts: Object.fromEntries([...recordKinds].map(k => [k, 1])),
  activeCount: 1,
  deltas: [],
  snapshot: {
    name: 'cinema.sqlite.gz',
    bytes: 1000,
    uncompressedBytes: 5000,
    url: `https://github.com/Nokitomo/database/releases/download/cinema-sqlite-v1-${'a'.repeat(64)}/cinema.sqlite.gz`,
    sha256: 'a'.repeat(64),
    uncompressedSha256: 'd'.repeat(64),
  },
};
const mockDb = {
  execAsync: resolved(),
  closeAsync: resolved(),
  getAllAsync: resolved(),
  getFirstAsync: resolved(),
};
beforeEach(() => {
  jest.clearAllMocks();
  AppState.currentState = 'active';
  mockState.installed = {...original};
  mockNative.pending.mockResolvedValue(JSON.stringify(m));
  mockNative.root.mockResolvedValue('/catalog');
  mockNative.gunzip.mockResolvedValue(undefined);
  (
    RNFS.getFSInfo as jest.MockedFunction<typeof RNFS.getFSInfo>
  ).mockResolvedValue({
    freeSpace: 10 ** 10,
    totalSpace: 10 ** 11,
    freeSpaceEx: 0,
    totalSpaceEx: 0,
  });
  (RNFS.stat as jest.Mock).mockImplementation(async (path: any) => ({
    size: path.endsWith('.gz') ? 1000 : 5000,
  }));
  (RNFS.hash as jest.Mock).mockImplementation(async (path: any) =>
    path.endsWith('.gz') ? m.snapshot.sha256 : m.snapshot.uncompressedSha256,
  );
  (RNFS.exists as jest.MockedFunction<typeof RNFS.exists>).mockResolvedValue(
    true,
  );
  (
    openDatabaseAsync as jest.MockedFunction<typeof openDatabaseAsync>
  ).mockResolvedValue(mockDb as any);
  mockDb.getAllAsync.mockImplementation(async sql => {
    if (sql.includes('table_info')) {
      return 'id,kind,work_id,parent_id,artwork_id,payload,hash'
        .split(',')
        .map(name => ({name}));
    }
    if (sql.includes('foreign_key_list')) {
      return ['work_id', 'parent_id', 'artwork_id'].map(from => ({
        from,
        table: 'records',
        to: 'id',
      }));
    }
    return sql.includes('GROUP BY kind')
      ? Object.entries(m.counts).map(([kind, count]) => ({kind, count}))
      : Object.entries(m).map(([key, value]) => ({
          key,
          value: JSON.stringify(value),
        }));
  });
  mockDb.getFirstAsync.mockImplementation(async sql => {
    if (sql.includes('user_version')) {
      return {user_version: 1};
    }
    if (sql.includes("type='trigger'")) {
      return null;
    }
    if (sql.includes('sqlite_master')) {
      return {
        sql: 'CREATE VIRTUAL TABLE search USING fts5(id,title,original_title,synopsis)',
      };
    }
    return sql.includes('integrity_check')
      ? {integrity_check: 'ok'}
      : sql.includes('foreign_key_check')
        ? null
        : {n: 1};
  });
});
describe('catalog installation safety', () => {
  test('compressed checksum failure never opens SQLite or replaces the active pointer', async () => {
    (RNFS.hash as jest.MockedFunction<typeof RNFS.hash>).mockResolvedValue(
      '0'.repeat(64),
    );
    await expect(installPendingCatalog()).rejects.toThrow('catalog.checksum');
    expect(openDatabaseAsync).not.toHaveBeenCalled();
    expect(mockState.setInstalled).not.toHaveBeenCalled();
    expect(RNFS.unlink).not.toHaveBeenCalledWith(`/catalog/${original.file}`);
  });
  test('insufficient disk space fails before decompression', async () => {
    (
      RNFS.getFSInfo as jest.MockedFunction<typeof RNFS.getFSInfo>
    ).mockResolvedValue({
      freeSpace: 100,
      totalSpace: 10000,
      freeSpaceEx: 0,
      totalSpaceEx: 0,
    });
    await expect(installPendingCatalog()).rejects.toThrow('catalog.noSpace');
    expect(mockNative.gunzip).not.toHaveBeenCalled();
    expect(mockState.setInstalled).not.toHaveBeenCalled();
  });
  test('activation happens only after checks and closing the staging connection', async () => {
    await installPendingCatalog();
    expect(mockState.setInstalled).toHaveBeenCalledWith(
      expect.objectContaining({revision: m.revision, bytes: 5000}),
    );
    expect(mockDb.closeAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mockState.setInstalled.mock.invocationCallOrder[0],
    );
    expect(mockNative.acknowledge).toHaveBeenCalledTimes(1);
  });
  test('an invalid database leaves the old catalog untouched', async () => {
    mockDb.getFirstAsync.mockResolvedValue({integrity_check: 'corrupt'});
    await expect(installPendingCatalog()).rejects.toThrow(
      'catalog.invalidDatabase',
    );
    expect(mockState.setInstalled).not.toHaveBeenCalled();
    expect(mockDb.closeAsync).toHaveBeenCalled();
    expect(RNFS.unlink).not.toHaveBeenCalledWith(`/catalog/${original.file}`);
  });
  test('backgrounding during preparation cannot activate a partial generation', async () => {
    mockNative.gunzip.mockImplementation(async () => {
      AppState.currentState = 'background';
    });
    await expect(installPendingCatalog()).rejects.toThrow(
      'catalog.foregroundRequired',
    );
    expect(mockState.setInstalled).not.toHaveBeenCalled();
    expect(mockNative.acknowledge).not.toHaveBeenCalled();
  });
  test('simultaneous callers share one installer', async () => {
    const first = installPendingCatalog(),
      second = installPendingCatalog();
    expect(first).toBe(second);
    await first;
    expect(mockNative.gunzip).toHaveBeenCalledTimes(1);
    expect(mockState.setInstalled).toHaveBeenCalledTimes(1);
  });
});
