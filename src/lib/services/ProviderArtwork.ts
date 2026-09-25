import {cacheStorage} from '../storage';
import {buildProviderCacheKey} from '../utils/providerCacheScope';
import {
  readPersistedCache,
  writePersistedCache,
} from '../utils/persistedCache';
import {providerManager} from './ProviderManager';

const ARTWORK_STALE_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_LOOKUPS = 2;

type QueueTask = {
  run: () => Promise<void>;
};

const pendingByKey = new Map<string, Promise<string | undefined>>();
const queue: QueueTask[] = [];
let activeLookups = 0;

const drainQueue = () => {
  while (activeLookups < MAX_CONCURRENT_LOOKUPS && queue.length > 0) {
    const task = queue.shift();
    if (!task) {
      return;
    }
    activeLookups += 1;
    task.run().finally(() => {
      activeLookups -= 1;
      drainQueue();
    });
  }
};

const enqueue = <T>(task: () => Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    queue.push({
      run: async () => {
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      },
    });
    drainQueue();
  });

const posterCacheKey = (providerValue: string, link: string) =>
  buildProviderCacheKey('preferredPoster', providerValue, link);

export const getCachedProviderPoster = (
  providerValue: string,
  link: string,
) =>
  readPersistedCache<string>(
    cacheStorage,
    posterCacheKey(providerValue, link),
  );

export const resolveProviderPoster = ({
  providerValue,
  link,
  forceRefresh = false,
}: {
  providerValue: string;
  link: string;
  forceRefresh?: boolean;
}): Promise<string | undefined> => {
  const key = posterCacheKey(providerValue, link);
  const cached = readPersistedCache<string>(cacheStorage, key);
  if (!forceRefresh && cached && cached.ageMs <= ARTWORK_STALE_MS) {
    return Promise.resolve(cached.value);
  }
  const pending = pendingByKey.get(key);
  if (pending) {
    return pending;
  }
  const request = enqueue(async () => {
    const artwork = await providerManager.getArtwork({
      link,
      provider: providerValue,
      fields: ['poster'],
    });
    const poster = artwork?.poster?.trim();
    if (poster) {
      writePersistedCache(cacheStorage, key, poster);
      return poster;
    }
    return cached?.value;
  }).finally(() => pendingByKey.delete(key));
  pendingByKey.set(key, request);
  return request;
};
