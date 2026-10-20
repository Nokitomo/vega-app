import * as Crypto from 'expo-crypto';
import * as RNFS from '@dr.pogodin/react-native-fs';

const CACHE_ROOT = `${RNFS.CachesDirectoryPath}/vega-provider-data`;
const ANIBRIDGE_KEY = 'anibridge-v3';
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;

export type ProviderFileCacheEntry = {
  value: string;
  updatedAt: number;
};

let cacheGeneration = 0;
const sourceGenerations = new Map<string, number>();
const pendingWrites = new Map<string, Promise<void>>();

const sourceKey = (sourceAuthor?: string) => sourceAuthor || 'legacy';

const cachePaths = async (sourceAuthor?: string): Promise<[string, string]> => {
  const scope = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${sourceKey(sourceAuthor)}:animeunity`,
  );
  const directory = `${CACHE_ROOT}/${scope}`;
  return [
    `${directory}/${ANIBRIDGE_KEY}-a.json`,
    `${directory}/${ANIBRIDGE_KEY}-b.json`,
  ];
};

const existingEntries = async (paths: string[]) => {
  const entries = await Promise.all(
    paths.map(async path => {
      try {
        const stat = await RNFS.stat(path);
        return stat.isFile() && stat.size > 0 && stat.size <= MAX_ENTRY_BYTES
          ? {path, updatedAt: stat.mtime.getTime()}
          : undefined;
      } catch {
        return undefined;
      }
    }),
  );
  return entries
    .filter((entry): entry is {path: string; updatedAt: number} =>
      Boolean(entry && Number.isFinite(entry.updatedAt) && entry.updatedAt > 0),
    )
    .sort((left, right) => right.updatedAt - left.updatedAt);
};

const assertKey = (key: string): void => {
  if (key !== ANIBRIDGE_KEY) {
    throw new Error('Unsupported provider file cache key');
  }
};

export const createAnimeUnityFileCache = (sourceAuthor?: string) => {
  const generation = cacheGeneration;
  const author = sourceKey(sourceAuthor);
  const sourceGeneration = sourceGenerations.get(author) || 0;
  const isCurrent = () =>
    generation === cacheGeneration &&
    sourceGeneration === (sourceGenerations.get(author) || 0);
  return {
    read: async (key: string): Promise<ProviderFileCacheEntry | undefined> => {
      assertKey(key);
      if (!isCurrent()) {
        return undefined;
      }
      const paths = await cachePaths(sourceAuthor);
      for (const entry of await existingEntries(paths)) {
        try {
          const value = await RNFS.readFile(entry.path, 'utf8');
          if (!isCurrent()) {
            return undefined;
          }
          return {value, updatedAt: entry.updatedAt};
        } catch {
          // Try the other copy if this file disappeared during the read.
        }
      }
      return undefined;
    },
    write: async (key: string, value: string): Promise<void> => {
      assertKey(key);
      if (typeof value !== 'string' || value.length > MAX_ENTRY_BYTES) {
        throw new Error('Provider file cache entry is too large');
      }
      if (!isCurrent()) {
        return;
      }
      // Both providers may download the same index at once. Serialize writes
      // within the shared source directory so neither replaces the other's file.
      const previous = pendingWrites.get(author) || Promise.resolve();
      const writeTask = previous.catch(() => undefined).then(async () => {
        if (!isCurrent()) {
          return;
        }
        const paths = await cachePaths(sourceAuthor);
        const latest = (await existingEntries(paths))[0]?.path;
        const path = paths.find(candidate => candidate !== latest) || paths[0];
        const directory = path.slice(0, path.lastIndexOf('/'));
        await RNFS.mkdir(directory);
        const temporary = `${path}.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
        try {
          await RNFS.writeFile(temporary, value, 'utf8');
          const written = await RNFS.stat(temporary);
          if (!written.isFile() || written.size > MAX_ENTRY_BYTES) {
            throw new Error('Provider file cache entry is too large');
          }
          if (!isCurrent()) {
            return;
          }
          // Replace the older copy; the most recent valid copy remains intact.
          if (await RNFS.exists(path)) {
            await RNFS.unlink(path);
          }
          await RNFS.moveFile(temporary, path);
        } finally {
          if (await RNFS.exists(temporary)) {
            await RNFS.unlink(temporary);
          }
        }
      });
      pendingWrites.set(author, writeTask);
      try {
        await writeTask;
      } finally {
        if (pendingWrites.get(author) === writeTask) {
          pendingWrites.delete(author);
        }
      }
    },
  };
};

export const clearProviderFileCache = async (): Promise<void> => {
  cacheGeneration += 1;
  await Promise.all([...pendingWrites.values()].map(write => write.catch(() => undefined)));
  if (await RNFS.exists(CACHE_ROOT)) {
    await RNFS.unlink(CACHE_ROOT);
  }
};

export const clearAnimeUnityFileCache = async (
  sourceAuthor?: string,
): Promise<void> => {
  if (!sourceAuthor) {
    await clearProviderFileCache();
    return;
  }
  const author = sourceKey(sourceAuthor);
  sourceGenerations.set(author, (sourceGenerations.get(author) || 0) + 1);
  await pendingWrites.get(author)?.catch(() => undefined);
  const [path] = await cachePaths(sourceAuthor);
  const directory = path.slice(0, path.lastIndexOf('/'));
  if (await RNFS.exists(directory)) {
    await RNFS.unlink(directory);
  }
};
