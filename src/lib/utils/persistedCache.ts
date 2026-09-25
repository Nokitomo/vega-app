import type {IStorageService} from '../storage/StorageService';

type PersistedCacheEnvelope<T> = {
  schema: 1;
  updatedAt: number;
  value: T;
};

export type PersistedCacheValue<T> = {
  ageMs: number;
  updatedAt: number;
  value: T;
};

export const PERSISTED_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const readPersistedCache = <T>(
  storage: IStorageService,
  key: string,
  maxAgeMs = PERSISTED_CACHE_MAX_AGE_MS,
): PersistedCacheValue<T> | undefined => {
  const raw = storage.getString(key);
  if (!raw) {
    return undefined;
  }
  try {
    const envelope = JSON.parse(raw) as PersistedCacheEnvelope<T>;
    if (
      envelope?.schema !== 1 ||
      !Number.isFinite(envelope.updatedAt) ||
      envelope.updatedAt <= 0
    ) {
      return undefined;
    }
    const ageMs = Math.max(0, Date.now() - envelope.updatedAt);
    if (ageMs > maxAgeMs) {
      storage.delete(key);
      return undefined;
    }
    return {ageMs, updatedAt: envelope.updatedAt, value: envelope.value};
  } catch {
    return undefined;
  }
};

export const writePersistedCache = <T>(
  storage: IStorageService,
  key: string,
  value: T,
): void => {
  storage.setString(
    key,
    JSON.stringify({schema: 1, updatedAt: Date.now(), value}),
  );
};
