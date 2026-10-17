import {mainStorage} from './StorageService';

const HIDDEN_KEY = 'continueWatchingHiddenLinks';

export const getHiddenContinueWatchingLinks = (): string[] =>
  mainStorage.getArray<string>(HIDDEN_KEY) || [];

export const hideFromContinueWatching = (link: string): string[] => {
  const links = getHiddenContinueWatchingLinks();
  if (!link || links.includes(link)) {
    return links;
  }
  const next = [...links, link];
  mainStorage.setArray(HIDDEN_KEY, next);
  return next;
};

export const showInContinueWatching = (link: string): string[] => {
  const links = getHiddenContinueWatchingLinks();
  if (!links.includes(link)) {
    return links;
  }
  const next = links.filter(item => item !== link);
  mainStorage.setArray(HIDDEN_KEY, next);
  return next;
};

export const clearHiddenContinueWatchingLinks = (): void => {
  mainStorage.delete(HIDDEN_KEY);
};
