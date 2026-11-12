import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {AppState} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {openDatabaseAsync} from 'expo-sqlite';
import {installPendingCatalog, pauseCatalogPreparation} from '../installer';
import {defaultCatalogPreferences} from '../preferences';
import {recordKinds} from '../manifest';
import {settingsStorage} from '../../storage/SettingsStorage';

jest.mock('../../storage/SettingsStorage', () => ({
  settingsStorage: {getBool: jest.fn(), setBool: jest.fn()},
}));

jest.mock('../native', () => ({catalogNative: () => mockNative}));
jest.mock('../views', () => ({
  ensureCatalogViews: jest.fn(() => Promise.resolve('views.sqlite')),
}));
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
  prepareFile: resolved(),
  beginPreparation: resolved(),
  cancelPreparation: resolved(),
  preparationStatus: resolved(),
  openLines: resolved(),
  readLines: resolved(),
  closeLines: resolved(),
  beginHash: resolved(),
  appendHash: resolved(),
  finishHash: resolved(),
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
  transfer: {} as any,
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
  withTransactionAsync: resolved(),
  prepareAsync: resolved(),
  runAsync: resolved(),
};
beforeEach(() => {
  jest.clearAllMocks();
  (settingsStorage.getBool as jest.Mock).mockReturnValue(false);
  AppState.currentState = 'active';
  mockState.installed = {...original};
  mockState.transfer = {};
  mockState.setTransfer.mockImplementation((value: any) => {
    mockState.transfer = value;
  });
  mockNative.pending.mockResolvedValue(JSON.stringify(m));
  mockNative.root.mockResolvedValue('/catalog');
  mockNative.gunzip.mockResolvedValue(undefined);
  mockNative.prepareFile.mockImplementation(async (mode, source) =>
    mode === 'hash' && source.endsWith('.gz')
      ? m.snapshot.sha256
      : m.snapshot.uncompressedSha256,
  );
  mockNative.preparationStatus.mockResolvedValue({active: false});
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
    false,
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
  test.each([false, true])(
    'delta verification pages hashes and enforces manifest agreement (mismatch=%s)',
    async mismatch => {
      const delta = {
        ...m.snapshot,
        sha256: 'e'.repeat(64),
        bytes: 500,
        fromRevision: original.revision,
        toRevision: m.revision,
      };
      mockNative.pending.mockResolvedValue(
        JSON.stringify({
          ...m,
          activeCount: mismatch ? 2 : m.activeCount,
          deltas: [delta],
        }),
      );
      (RNFS.stat as jest.Mock).mockImplementation(async (path: any) => ({
        size: path.endsWith('.gz') ? 500 : 5000,
      }));
      mockNative.prepareFile.mockResolvedValue(delta.sha256);
      mockNative.readLines
        .mockResolvedValueOnce([
          JSON.stringify({
            format: 'vega-cinema-delta-v1',
            baseRevision: original.revision,
            target: m,
          }),
        ])
        .mockResolvedValueOnce([]);
      mockNative.finishHash.mockResolvedValue(m.revision);
      mockDb.withTransactionAsync.mockImplementation(async fn => fn());
      const finalize = resolved();
      mockDb.prepareAsync.mockResolvedValue({finalizeAsync: finalize});
      const previous = mockDb.getAllAsync.getMockImplementation()!;
      let metadataReads = 0,
        page = 0;
      mockDb.getAllAsync.mockImplementation(async (sql, ...args) => {
        if (sql.includes('SELECT key,value')) {
          const value =
            metadataReads++ === 0 ? {...m, revision: original.revision} : m;
          return Object.entries(value).map(([key, item]) => ({
            key,
            value: JSON.stringify(item),
          }));
        }
        if (sql.includes('SELECT id,hash')) {
          return page++ === 0
            ? [
                {id: 'A', hash: '1'},
                {id: 'z', hash: '2'},
              ]
            : page === 2
              ? [{id: 'é', hash: '3'}]
              : [];
        }
        return previous(sql, ...args);
      });
      if (mismatch) {
        await expect(installPendingCatalog()).rejects.toThrow(
          'catalog.invalidDatabase',
        );
        expect(mockState.setInstalled).not.toHaveBeenCalled();
        expect(mockNative.start).toHaveBeenCalledWith(true);
        return;
      }
      await installPendingCatalog();
      expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
      expect(finalize).toHaveBeenCalledTimes(1);
      expect(mockNative.appendHash.mock.calls).toEqual([[['1', '2']], [['3']]]);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT INTO revision_hashes.rows SELECT id,hash FROM records NOT INDEXED WHERE rowid>? AND rowid<=?',
        0,
        10000,
      );
      expect(mockDb.execAsync).toHaveBeenCalledWith('DETACH DATABASE revision_hashes');
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id COLLATE BINARY > ?'),
        'z',
      );
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id COLLATE BINARY > ?'),
        'é',
      );
      expect(mockState.setInstalled).toHaveBeenCalled();
    },
  );
  test('a paused preparation does not restart automatically', async () => {
    (settingsStorage.getBool as jest.Mock).mockReturnValue(true);
    await installPendingCatalog();
    expect(mockNative.beginPreparation).not.toHaveBeenCalled();
    expect(mockState.transfer.status).toBe('paused');
  });
  test('cancellation reaches the native file task and preserves the active catalog and download', async () => {
    let began!: () => void;
    let rejectPreparation!: (error: Error) => void;
    const started = new Promise<void>(resolve => {
      began = resolve;
    });
    mockNative.prepareFile.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectPreparation = reject;
          began();
        }),
    );
    mockNative.cancelPreparation.mockImplementation(async () => {
      rejectPreparation(new Error('catalog.preparationPaused'));
    });
    const installation = installPendingCatalog();
    await started;
    await pauseCatalogPreparation();
    await installation;
    expect(mockNative.cancelPreparation).toHaveBeenCalledTimes(1);
    expect(mockNative.cancel).not.toHaveBeenCalled();
    expect(mockNative.acknowledge).not.toHaveBeenCalled();
    expect(mockState.setInstalled).not.toHaveBeenCalled();
    expect(mockState.transfer.status).toBe('paused');
  });
  test('a completed candidate is reused only after its raw checksum matches', async () => {
    (RNFS.exists as jest.MockedFunction<typeof RNFS.exists>).mockResolvedValue(
      true,
    );
    await installPendingCatalog();
    expect(mockNative.prepareFile).toHaveBeenCalledTimes(1);
    expect(mockNative.prepareFile).toHaveBeenCalledWith(
      'hash',
      `/catalog/catalog-${m.revision}.sqlite`,
      '',
      5000,
      'hashPrepared',
    );
    expect(mockState.setInstalled).toHaveBeenCalled();
  });
  test('compressed checksum failure never opens SQLite or replaces the active pointer', async () => {
    mockNative.prepareFile.mockResolvedValue('0'.repeat(64));
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
    mockNative.prepareFile.mockImplementation(async () => {
      AppState.currentState = 'background';
    });
    await installPendingCatalog();
    expect(mockState.setTransfer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'paused',
        error: 'catalog.preparationPaused',
      }),
    );
    expect(mockState.setInstalled).not.toHaveBeenCalled();
    expect(mockNative.acknowledge).not.toHaveBeenCalled();
  });
  test('simultaneous callers share one installer', async () => {
    const first = installPendingCatalog(),
      second = installPendingCatalog();
    expect(first).toBe(second);
    await first;
    expect(mockNative.prepareFile).toHaveBeenCalledTimes(2);
    expect(mockState.setInstalled).toHaveBeenCalledTimes(1);
  });
  test('FTS connections disable unsafe automatic finalization and snapshots avoid full scans', async () => {
    await installPendingCatalog();
    expect(openDatabaseAsync).toHaveBeenCalledWith(
      expect.any(String),
      {useNewConnection: true, finalizeUnusedStatementsBeforeClosing: false},
      '/catalog',
    );
    const queries = [
      ...mockDb.execAsync.mock.calls,
      ...mockDb.getAllAsync.mock.calls,
      ...mockDb.getFirstAsync.mock.calls,
    ].map(call => call[0]);
    expect(queries.join('\n')).not.toMatch(
      /integrity_check|foreign_key_check|GROUP BY kind/,
    );
  });
  test('raw checksum failure never activates the extracted database', async () => {
    mockNative.prepareFile.mockImplementation(async mode =>
      mode === 'hash' ? m.snapshot.sha256 : '0'.repeat(64),
    );
    await expect(installPendingCatalog()).rejects.toThrow('catalog.checksum');
    expect(openDatabaseAsync).not.toHaveBeenCalled();
    expect(mockState.setTransfer).toHaveBeenLastCalledWith(
      expect.objectContaining({status: 'error'}),
    );
  });
});
