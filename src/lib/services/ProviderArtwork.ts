import {cacheStorage} from '../storage';
import {buildProviderCacheKey} from '../utils/providerCacheScope';
import {
  readPersistedCache,
  writePersistedCache,
} from '../utils/persistedCache';
import {providerManager} from './ProviderManager';
import type {Post} from '../providers/types';

const ARTWORK_STALE_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_LOOKUPS = 2;

type QueueTask = {
  key: string;
  run: () => Promise<void>;
};

type ProviderPosterCacheValue = {
  poster?: string;
};

type PendingLookup = {
  consumers: Set<symbol>;
  promise: Promise<string | undefined>;
  resolve: (value: string | undefined) => void;
  reject: (error: unknown) => void;
  started: boolean;
};

const pendingByKey = new Map<string, PendingLookup>();
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

const enqueue = (key: string, task: () => Promise<void>) => {
  queue.push({key, run: task});
  drainQueue();
};

const posterCacheKey = (providerValue: string, link: string) =>
  buildProviderCacheKey('preferredPosterW300V2', providerValue, link);

export const getCachedProviderPoster = (
  providerValue: string,
  link: string,
) =>
  readPersistedCache<ProviderPosterCacheValue>(
    cacheStorage,
    posterCacheKey(providerValue, link),
  );

const attachConsumer = (
  key: string,
  pending: PendingLookup,
  signal?: AbortSignal,
) => {
  const token = Symbol(key);
  pending.consumers.add(token);
  if (!signal) {
    return;
  }
  const release = () => {
    pending.consumers.delete(token);
    if (!pending.started && pending.consumers.size === 0) {
      const queueIndex = queue.findIndex(task => task.key === key);
      if (queueIndex >= 0) {
        queue.splice(queueIndex, 1);
      }
      pendingByKey.delete(key);
      pending.resolve(undefined);
    }
  };
  if (signal.aborted) {
    release();
    return;
  }
  signal.addEventListener('abort', release, {once: true});
};

export const resolveProviderPoster = ({
  providerValue,
  link,
  hints,
  forceRefresh = false,
  signal,
}: {
  providerValue: string;
  link: string;
  hints?: Post['artworkHints'];
  forceRefresh?: boolean;
  signal?: AbortSignal;
}): Promise<string | undefined> => {
  const key = posterCacheKey(providerValue, link);
  const cached = readPersistedCache<ProviderPosterCacheValue>(cacheStorage, key);
  if (signal?.aborted) {
    return Promise.resolve(cached?.value.poster);
  }
  if (!forceRefresh && cached && cached.ageMs <= ARTWORK_STALE_MS) {
    return Promise.resolve(cached.value.poster);
  }
  const pending = pendingByKey.get(key);
  if (pending) {
    attachConsumer(key, pending, signal);
    return pending.promise;
  }
  let resolveRequest!: (value: string | undefined) => void;
  let rejectRequest!: (error: unknown) => void;
  const promise = new Promise<string | undefined>((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
  });
  const entry: PendingLookup = {
    consumers: new Set(),
    promise,
    resolve: resolveRequest,
    reject: rejectRequest,
    started: false,
  };
  pendingByKey.set(key, entry);
  attachConsumer(key, entry, signal);
  enqueue(key, async () => {
    if (entry.consumers.size === 0) {
      pendingByKey.delete(key);
      entry.resolve(cached?.value.poster);
      return;
    }
    entry.started = true;
    try {
      const artwork = await providerManager.getArtwork({
        link,
        provider: providerValue,
        fields: ['poster'],
        hints,
        imageSize: 'w300',
      });
      const poster = artwork?.poster?.trim();
      if (artwork?.resolved === true) {
        writePersistedCache(cacheStorage, key, {poster});
      }
      entry.resolve(poster || cached?.value.poster);
    } catch (error) {
      if (cached) {
        entry.resolve(cached.value.poster);
      } else {
        entry.reject(error);
      }
    } finally {
      pendingByKey.delete(key);
    }
  });
  return promise;
};
