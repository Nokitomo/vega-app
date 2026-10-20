import {cacheStorage} from '../storage';
import {buildProviderCacheKey} from '../utils/providerCacheScope';
import {
  readPersistedCache,
  writePersistedCache,
} from '../utils/persistedCache';
import {providerManager} from './ProviderManager';
import type {Post} from '../providers/types';
import {
  isPerfTraceEnabled,
  measurePerfSync,
  perfNow,
  perfTrace,
} from '../utils/perfTrace';
import {
  readMetadata,
  removeMetadata,
  writeMetadata,
} from '../storage/MetadataDatabase';
import {animeMetaSourceLink} from './animeMetadataSharing';

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
const posterCacheHitsByProvider = new Map<string, number>();
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

const posterDurable = (providerValue: string, link: string) => {
  const own = readMetadata<ProviderPosterCacheValue>(
    'preferredPosterW300V2', providerValue, link,
  );
  const sourceLink = animeMetaSourceLink(providerValue, link);
  const shared = providerValue === 'streamcenter' && sourceLink
    ? readMetadata<ProviderPosterCacheValue>(
        'preferredPosterW300V2', 'animeunity', sourceLink,
      )
    : undefined;
  return shared?.value.poster && (!own?.value.poster || shared.updatedAt >= own.updatedAt)
    ? shared
    : own;
};

export const getCachedProviderPoster = (
  providerValue: string,
  link: string,
) => {
  return measurePerfSync('poster_cache_read', {provider: providerValue}, () => {
    const durable = posterDurable(providerValue, link);
    if (durable?.value.poster) {
      return {
        value: durable.value,
        updatedAt: durable.updatedAt,
        ageMs: Math.max(0, Date.now() - durable.updatedAt),
      };
    }
    const ownCache = readPersistedCache<ProviderPosterCacheValue>(
      cacheStorage,
      posterCacheKey(providerValue, link),
    );
    const sourceLink = animeMetaSourceLink(providerValue, link);
    const sourceCache = providerValue === 'streamcenter' && sourceLink
      ? readPersistedCache<ProviderPosterCacheValue>(
          cacheStorage, posterCacheKey('animeunity', sourceLink),
        )
      : undefined;
    return sourceCache && (!ownCache || sourceCache.updatedAt >= ownCache.updatedAt)
      ? sourceCache
      : ownCache;
  });
};

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
  const cached = getCachedProviderPoster(providerValue, link);
  if (signal?.aborted) {
    return Promise.resolve(cached?.value.poster);
  }
  const durable = posterDurable(providerValue, link);
  if (
    !forceRefresh &&
    cached &&
    (durable?.value.poster || cached.ageMs <= ARTWORK_STALE_MS)
  ) {
    const sourceLink = animeMetaSourceLink(providerValue, link);
    if (providerValue === 'streamcenter' && sourceLink && cached.value.poster &&
      !readMetadata<ProviderPosterCacheValue>(
        'preferredPosterW300V2', 'animeunity', sourceLink,
      )) {
      writeMetadata(
        'preferredPosterW300V2', 'animeunity', sourceLink,
        {poster: cached.value.poster},
      );
    }
    // Count cache hits without flooding the JS bridge during Home rendering.
    if (isPerfTraceEnabled) {
      const cacheHits = (posterCacheHitsByProvider.get(providerValue) ?? 0) + 1;
      posterCacheHitsByProvider.set(providerValue, cacheHits);
      if (cacheHits === 1 || cacheHits % 25 === 0) {
        perfTrace('poster_cache_hits', {provider: providerValue, count: cacheHits});
      }
    }
    return Promise.resolve(cached.value.poster);
  }
  const pending = pendingByKey.get(key);
  if (pending) {
    perfTrace('poster_deduplicated', {provider: providerValue});
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
  const queuedAt = isPerfTraceEnabled ? perfNow() : 0;
  perfTrace('poster_queued', {
    provider: providerValue,
    queueDepth: queue.length,
    activeLookups,
  });
  enqueue(key, async () => {
    if (isPerfTraceEnabled) {
      perfTrace('poster_dequeued', {
        provider: providerValue,
        waitMs: Math.round(perfNow() - queuedAt),
      });
    }
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
        if (poster) {
          writeMetadata('preferredPosterW300V2', providerValue, link, {poster});
        } else if (forceRefresh) {
          removeMetadata('preferredPosterW300V2', providerValue, link);
        }
        const sourceLink = animeMetaSourceLink(providerValue, link);
        if (providerValue === 'streamcenter' && sourceLink) {
          writePersistedCache(
            cacheStorage, posterCacheKey('animeunity', sourceLink), {poster},
          );
          if (poster) {
            writeMetadata('preferredPosterW300V2', 'animeunity', sourceLink, {poster});
          } else if (forceRefresh) {
            removeMetadata('preferredPosterW300V2', 'animeunity', sourceLink);
          }
        }
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
