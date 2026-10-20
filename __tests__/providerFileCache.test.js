const RNFS = require('@dr.pogodin/react-native-fs');
const Crypto = require('expo-crypto');
const {mainStorage} = require('../src/lib/storage/StorageService');
const {extensionStorage} = require('../src/lib/storage/extensionStorage');
const {createProviderContext} = require('../src/lib/providers/providerContext');
const {
  clearAnimeUnityFileCache,
  clearProviderFileCache,
  createAnimeUnityFileCache,
} = require('../src/lib/providers/providerFileCache');

const files = new Map();
let modifiedAt = Date.now();

beforeEach(() => {
  files.clear();
  mainStorage.clearAll();
  modifiedAt = Date.now();
  Crypto.digestStringAsync.mockImplementation(async (_algorithm, value) =>
    value.includes('Other') ? 'other-digest' : 'mock-digest',
  );
  RNFS.mkdir.mockResolvedValue(undefined);
  RNFS.stat.mockImplementation(async path => {
    const file = files.get(path);
    if (!file) {
      throw new Error('ENOENT');
    }
    return {
      path,
      size: file.value.length,
      mtime: file.mtime,
      isFile: () => true,
    };
  });
  RNFS.readFile.mockImplementation(async path => {
    const file = files.get(path);
    if (!file) {
      throw new Error('ENOENT');
    }
    return file.value;
  });
  RNFS.writeFile.mockImplementation(async (path, value) => {
    modifiedAt += 1000;
    files.set(path, {value, mtime: new Date(modifiedAt)});
  });
  RNFS.moveFile.mockImplementation(async (source, destination) => {
    if (files.has(destination)) {
      throw new Error('destination exists');
    }
    const file = files.get(source);
    if (!file) {
      throw new Error('ENOENT');
    }
    files.set(destination, file);
    files.delete(source);
  });
  RNFS.exists.mockImplementation(async path =>
    files.has(path) || [...files.keys()].some(key => key.startsWith(`${path}/`)),
  );
  RNFS.unlink.mockImplementation(async path => {
    for (const key of files.keys()) {
      if (key === path || key.startsWith(`${path}/`)) {
        files.delete(key);
      }
    }
  });
});

const installedProvider = (value, author) => ({
  value,
  display_name: value,
  source: {author, url: 'https://example.com/providers'},
  version: '1.0.0',
  icon: '',
  disabled: false,
  type: 'italy',
  installed: true,
});

test('AnimeUnity and StreamCenter reuse one AniBridge file for the same source', async () => {
  const anime = createProviderContext('animeunity', 'Nokitomo').fileCache;
  const streamCenter = createProviderContext('streamcenter', 'Nokitomo').fileCache;
  const streamingUnity = createProviderContext('streamingunity', 'Nokitomo');
  expect(anime).toBeDefined();
  expect(streamCenter).toBeDefined();
  expect(streamingUnity.fileCache).toBeUndefined();

  await anime.write('anibridge-v3', 'from-animeunity');
  expect((await streamCenter.read('anibridge-v3')).value).toBe('from-animeunity');
  await streamCenter.write('anibridge-v3', 'from-streamcenter');
  expect((await anime.read('anibridge-v3')).value).toBe('from-streamcenter');
  await expect(streamCenter.read('other-key')).rejects.toThrow(/Unsupported/);
});

test('serializes simultaneous writes from both providers', async () => {
  const anime = createProviderContext('animeunity', 'Nokitomo').fileCache;
  const streamCenter = createProviderContext('streamcenter', 'Nokitomo').fileCache;
  await Promise.all([
    anime.write('anibridge-v3', 'first'),
    streamCenter.write('anibridge-v3', 'second'),
  ]);
  expect((await anime.read('anibridge-v3')).value).toBe('second');
  expect(files.size).toBe(2);
});

test.each([
  ['animeunity', 'streamcenter'],
  ['streamcenter', 'animeunity'],
])('keeps the shared file when %s is uninstalled before %s', async (first, last) => {
  const anime = createProviderContext('animeunity', 'Nokitomo').fileCache;
  const streamCenter = createProviderContext('streamcenter', 'Nokitomo').fileCache;
  const otherSource = createProviderContext('animeunity', 'Other').fileCache;
  await anime.write('anibridge-v3', 'shared');
  await otherSource.write('anibridge-v3', 'other');
  extensionStorage.setInstalledProviders([
    installedProvider('animeunity', 'Nokitomo'),
    installedProvider('streamcenter', 'Nokitomo'),
    installedProvider('animeunity', 'Other'),
  ]);

  extensionStorage.uninstallProvider(first, 'Nokitomo');
  const surviving = last === 'animeunity' ? anime : streamCenter;
  expect((await surviving.read('anibridge-v3')).value).toBe('shared');

  extensionStorage.uninstallProvider(last, 'Nokitomo');
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(await createProviderContext('streamcenter', 'Nokitomo')
    .fileCache.read('anibridge-v3')).toBeUndefined();
  expect((await otherSource.read('anibridge-v3')).value).toBe('other');
});

test('persists the AniBridge index across contexts and safely replaces old copies', async () => {
  const first = createAnimeUnityFileCache('Nokitomo');
  await first.write('anibridge-v3', '{"version":1}');
  const afterRestart = createAnimeUnityFileCache('Nokitomo');
  expect((await afterRestart.read('anibridge-v3')).value).toBe('{"version":1}');
  await afterRestart.write('anibridge-v3', '{"version":2}');
  await afterRestart.write('anibridge-v3', '{"version":3}');
  expect((await first.read('anibridge-v3')).value).toBe('{"version":3}');
  expect(files.size).toBe(2);
});

test('rejects other keys and clears existing and in-flight cache handles', async () => {
  const oldHandle = createAnimeUnityFileCache('Nokitomo');
  await expect(oldHandle.read('../escape')).rejects.toThrow(/Unsupported/);
  await oldHandle.write('anibridge-v3', '{"version":1}');
  await clearProviderFileCache();
  expect(await oldHandle.read('anibridge-v3')).toBeUndefined();
  await oldHandle.write('anibridge-v3', '{"version":2}');
  expect(files.size).toBe(0);
  const newHandle = createAnimeUnityFileCache('Nokitomo');
  await newHandle.write('anibridge-v3', '{"version":3}');
  expect((await newHandle.read('anibridge-v3')).value).toBe('{"version":3}');
});

test('uninstall clears only the selected source', async () => {
  const first = createAnimeUnityFileCache('Nokitomo');
  const second = createAnimeUnityFileCache('Other');
  await first.write('anibridge-v3', 'first');
  await second.write('anibridge-v3', 'second');
  await clearAnimeUnityFileCache('Nokitomo');
  expect(await first.read('anibridge-v3')).toBeUndefined();
  expect((await second.read('anibridge-v3')).value).toBe('second');
});
