import {streamCenterMetaOrigin, episodeIdentity} from '../services/streamCenterMetadata';
import {mainStorage} from './StorageService';

const animeId = (link: string): string | undefined => {
  const source = streamCenterMetaOrigin(link);
  const url = source?.source === 'animeunity' ? source.data.url : link;
  return /(?:^|\.)animeunity\./i.test((() => {
    try {return new URL(url).hostname;} catch {return '';}
  })()) ? url.match(/\/(?:anime|info_api)\/(\d+)(?:\D|$)/i)?.[1] : undefined;
};

/** Stable watch identity; provider-specific links stay in navigation and playback. */
export const sharedWatchContentKey = (link: string): string => {
  const id = animeId(link);
  return id ? `shared-anime:${id}` : link;
};

export const sameWatchContent = (left: string, right: string): boolean =>
  sharedWatchContentKey(left) === sharedWatchContentKey(right);

export const sharedWatchEpisodeKey = (contentLink: string, episodeLink: string): string =>
  animeId(contentLink) ? episodeIdentity(episodeLink) : episodeLink;

/** Resolve the content identity once when processing a whole season or series. */
export const createSharedWatchEpisodeKeyResolver = (
  contentLink: string,
): ((episodeLink: string) => string) =>
  animeId(contentLink) ? episodeIdentity : (episodeLink: string) => episodeLink;

export const sameWatchEpisode = (
  contentLink: string, left: string, right: string,
): boolean => sharedWatchEpisodeKey(contentLink, left) ===
  sharedWatchEpisodeKey(contentLink, right);

export const watchProgressKey = (link: string): string =>
  `watch_history_progress_${sharedWatchContentKey(link)}`;

export const getWatchProgressString = (link: string): string | undefined => {
  const key = watchProgressKey(link);
  let selected = mainStorage.getString(key);
  if (sharedWatchContentKey(link) === link) {return selected;}
  let selectedAt = 0;
  try {selectedAt = Number(JSON.parse(selected || '{}').updatedAt) || 0;} catch { /* ignore */ }
  for (const alias of relatedWatchContentLinks(link)) {
    const legacyKey = `watch_history_progress_${alias}`;
    if (legacyKey === key) {continue;}
    const raw = mainStorage.getString(legacyKey);
    if (!raw) {continue;}
    let updatedAt = 0;
    try {updatedAt = Number(JSON.parse(raw).updatedAt) || 0;} catch { /* ignore */ }
    if (!selected || updatedAt > selectedAt) {
      selected = raw;
      selectedAt = updatedAt;
    }
    mainStorage.delete(legacyKey);
  }
  if (selected && selected !== mainStorage.getString(key)) {
    mainStorage.setString(key, selected);
  }
  return selected;
};

/** Discover old provider-specific keys only when an anime needs migration. */
export const relatedWatchContentLinks = (link: string): string[] => {
  const key = sharedWatchContentKey(link);
  if (key === link) {return [link];}
  const history = mainStorage.getArray<{link?: string}>('watchHistory') || [];
  const episodeKeys = mainStorage.getObject<Record<string, string[]>>(
    'watchHistoryEpisodeKeys',
  ) || {};
  const candidates = [
    link,
    key,
    ...history.map(item => item.link || ''),
    ...(mainStorage.getArray<string>('manualWatchedEpisodeContents') || []),
    ...(mainStorage.getArray<string>('seriesCatalogContentLinks') || []),
    ...Object.keys(episodeKeys),
  ];
  return [...new Set(candidates.filter(value =>
    value && sharedWatchContentKey(value) === key))];
};
