import {mainStorage} from './StorageService';
import {sharedWatchContentKey} from './SharedAnimeWatchIdentity';

const HIDDEN_KEY = 'continueWatchingHiddenLinks';

export const getHiddenContinueWatchingLinks = (): string[] =>
  [...new Set((mainStorage.getArray<string>(HIDDEN_KEY) || []).map(sharedWatchContentKey))];

export const hideFromContinueWatching = (link: string): string[] => {
  const links = getHiddenContinueWatchingLinks();
  const key = sharedWatchContentKey(link);
  if (!link || links.includes(key)) {
    return links;
  }
  const next = [...links, key];
  mainStorage.setArray(HIDDEN_KEY, next);
  return next;
};

export const showInContinueWatching = (link: string): string[] => {
  const links = getHiddenContinueWatchingLinks();
  const key = sharedWatchContentKey(link);
  if (!links.includes(key)) {
    return links;
  }
  const next = links.filter(item => item !== key);
  mainStorage.setArray(HIDDEN_KEY, next);
  return next;
};

export const clearHiddenContinueWatchingLinks = (): void => {
  mainStorage.delete(HIDDEN_KEY);
};
