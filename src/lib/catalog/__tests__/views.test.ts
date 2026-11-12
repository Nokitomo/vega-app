import {beforeEach, expect, jest, test} from '@jest/globals';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {openCatalogDatabase} from '../connection';
import {catalogViewsFile, ensureCatalogViews} from '../views';

jest.mock('../connection', () => ({openCatalogDatabase: jest.fn()}));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  exists: jest.fn(),
  unlink: jest.fn(),
  moveFile: jest.fn(),
}));
const resolved = () =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(undefined);
const db = {
  execAsync: resolved(),
  runAsync: resolved(),
  getAllAsync: resolved(),
  getFirstAsync: resolved(),
  closeAsync: resolved(),
};
const revision = 'a'.repeat(64);
const source = `catalog-${revision}.sqlite`;
const file = catalogViewsFile(revision);
beforeEach(() => {
  jest.clearAllMocks();
  (RNFS.exists as jest.MockedFunction<typeof RNFS.exists>).mockResolvedValue(
    false,
  );
  (
    openCatalogDatabase as jest.MockedFunction<typeof openCatalogDatabase>
  ).mockResolvedValue(db as any);
  db.execAsync.mockResolvedValue(undefined);
  db.getAllAsync.mockResolvedValue([
    {key: 'revision', value: JSON.stringify(revision)},
    {key: 'activeCount', value: '2'},
  ]);
  db.getFirstAsync.mockResolvedValue({n: 2});
});

test('concurrent readers share one build and publish the cache only after closing it', async () => {
  const first = ensureCatalogViews(source, '/catalog', revision);
  expect(ensureCatalogViews(source, '/catalog', revision)).toBe(first);
  await expect(first).resolves.toBe(file);
  expect(openCatalogDatabase).toHaveBeenCalledTimes(1);
  expect(db.runAsync).toHaveBeenCalledWith(
    'ATTACH DATABASE ? AS published',
    `/catalog/${source}`,
  );
  expect(RNFS.moveFile).toHaveBeenCalledWith(
    `/catalog/${file}.building`,
    `/catalog/${file}`,
  );
  expect(db.closeAsync.mock.invocationCallOrder[0]).toBeLessThan(
    (RNFS.moveFile as jest.Mock).mock.invocationCallOrder[0],
  );
  expect(RNFS.unlink).not.toHaveBeenCalledWith(`/catalog/${source}`);
});

test('a complete cache is reused without scanning the published records again', async () => {
  (RNFS.exists as jest.MockedFunction<typeof RNFS.exists>).mockResolvedValue(
    true,
  );
  db.getFirstAsync.mockImplementation(async sql =>
    sql.includes('ready') ? {revision, count: 2} : {n: 2},
  );
  await ensureCatalogViews(source, '/catalog', revision);
  expect(db.execAsync).not.toHaveBeenCalled();
  expect(db.runAsync).not.toHaveBeenCalled();
  expect(db.closeAsync).toHaveBeenCalledTimes(1);
  expect(RNFS.moveFile).not.toHaveBeenCalled();
});

test('cancellation closes and removes only the unfinished derived cache', async () => {
  (RNFS.exists as jest.MockedFunction<typeof RNFS.exists>).mockImplementation(
    async path => path.endsWith('.building'),
  );
  let checkpoints = 0;
  await expect(
    ensureCatalogViews(source, '/catalog', revision, () => {
      if (++checkpoints === 3) {
        throw new Error('catalog.preparationPaused');
      }
    }),
  ).rejects.toThrow('catalog.preparationPaused');
  expect(db.closeAsync).toHaveBeenCalled();
  expect(RNFS.moveFile).not.toHaveBeenCalled();
  expect(RNFS.unlink).toHaveBeenCalledWith(`/catalog/${file}.building`);
  expect(RNFS.unlink).not.toHaveBeenCalledWith(`/catalog/${source}`);
});

test('a count mismatch cannot publish a cache and a later attempt can retry', async () => {
  db.getFirstAsync.mockResolvedValue({n: 1});
  await expect(
    ensureCatalogViews(source, '/catalog', revision),
  ).rejects.toThrow('catalog.invalidDatabase');
  expect(RNFS.moveFile).not.toHaveBeenCalled();
  db.getFirstAsync.mockResolvedValue({n: 2});
  await expect(ensureCatalogViews(source, '/catalog', revision)).resolves.toBe(
    file,
  );
});
