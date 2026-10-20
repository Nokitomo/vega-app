import {mainStorage} from './StorageService';
import {
  relatedWatchContentLinks,
  sharedWatchContentKey,
  sharedWatchEpisodeKey,
} from './SharedAnimeWatchIdentity';

export const SERIES_EPISODE_PROGRESS_PREFIX = 'seriesEpisodeProgress_';
const migrationRevisions = new Map<string, string>();
const migrationRevision = (): string => [
  mainStorage.getKeyRevision('watchHistory'),
  mainStorage.getKeyRevision('seriesCatalogContentLinks'),
  mainStorage.getKeyRevision('manualWatchedEpisodeContents'),
  mainStorage.getKeyRevision('watchHistoryEpisodeKeys'),
].join(':');

export const sharedEpisodeProgressKey = (contentLink: string): string =>
  `${SERIES_EPISODE_PROGRESS_PREFIX}${sharedWatchContentKey(contentLink)}`;

/** Merge old provider records, keeping the greatest watched percentage per episode. */
export const readSharedEpisodeProgress = (contentLink: string): Record<string, number> => {
  const key = sharedEpisodeProgressKey(contentLink);
  const progress = mainStorage.getObject<Record<string, number>>(key) || {};
  if (sharedWatchContentKey(contentLink) === contentLink) {return progress;}
  if (migrationRevisions.get(key) === migrationRevision()) {return progress;}
  let migrated = false;
  for (const alias of relatedWatchContentLinks(contentLink)) {
    const legacyKey = `${SERIES_EPISODE_PROGRESS_PREFIX}${alias}`;
    if (legacyKey === key) {continue;}
    const legacy = mainStorage.getObject<Record<string, number>>(legacyKey);
    if (!legacy) {continue;}
    for (const [episodeLink, percent] of Object.entries(legacy)) {
      const episodeKey = sharedWatchEpisodeKey(contentLink, episodeLink);
      if (Number.isFinite(percent)) {
        progress[episodeKey] = Math.max(progress[episodeKey] || 0, percent);
      }
    }
    mainStorage.delete(legacyKey);
    migrated = true;
  }
  if (migrated) {mainStorage.setObject(key, progress);}
  migrationRevisions.set(key, migrationRevision());
  return progress;
};

export const clearSharedEpisodeProgress = (contentLink: string): void => {
  for (const alias of relatedWatchContentLinks(contentLink)) {
    mainStorage.delete(`${SERIES_EPISODE_PROGRESS_PREFIX}${alias}`);
  }
  mainStorage.delete(sharedEpisodeProgressKey(contentLink));
};
