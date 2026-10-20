import {mainStorage, secureStorage} from './StorageService';

const KEY = 'tmdbApiKey';
const CACHE_VERSION_KEY = 'tmdbApiKeyCacheVersion';

export const usesAppTmdbApiKey = (providerValue: string): boolean =>
  providerValue === 'animeunity' ||
  providerValue === 'streamingunity' ||
  providerValue === 'streamcenter';

export const getAppTmdbApiKey = (): string | undefined =>
  secureStorage.getString(KEY)?.trim() || undefined;

export const getTmdbCacheVersion = (): number =>
  mainStorage.getNumber(CACHE_VERSION_KEY) || 0;

/** Returns true only when the saved key changed. */
export const setAppTmdbApiKey = (value: string): boolean => {
  const next = value.trim();
  if (next === (getAppTmdbApiKey() || '')) {
    return false;
  }
  if (next) {
    secureStorage.setString(KEY, next);
  } else {
    secureStorage.delete(KEY);
  }
  mainStorage.setNumber(CACHE_VERSION_KEY, getTmdbCacheVersion() + 1);
  return true;
};
