const RNFS = require('@dr.pogodin/react-native-fs');
const Crypto = require('expo-crypto');
const {
  clearAnimeUnityFileCache,
  clearProviderFileCache,
  createAnimeUnityFileCache,
} = require('../src/lib/providers/providerFileCache');

const files = new Map();
let modifiedAt = Date.now();

beforeEach(() => {
  files.clear();
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
