import type {ArtworkSource, Info} from '../providers/types';
import {getMetadataSourceProvider} from '../services/streamCenterMetadata';

type HeroArtworkOrigin = ArtworkSource | 'anilist';
export type AnimeHeroMetadata = Partial<Info> & {
  heroArtworkOrigins?: Record<string, HeroArtworkOrigin>;
};

const positiveIds = (values?: number[]) => Array.isArray(values) &&
  values.some(value => Number.isInteger(value) && value > 0);
const imdbId = (value?: string) => typeof value === 'string' && /^tt[0-9]+$/.test(value);

export const hasMappedHeroIdentity = (info?: AnimeHeroMetadata): boolean => {
  const ids = info?.extra?.ids;
  return !!ids && (
    positiveIds(ids.tmdbMovieIds) || positiveIds(ids.tmdbShowIds) ||
    positiveIds(ids.tvdbMovieIds) || positiveIds(ids.tvdbShowIds) ||
    (Array.isArray(ids.imdbMovieIds) && ids.imdbMovieIds.some(imdbId)) ||
    (Array.isArray(ids.imdbShowIds) && ids.imdbShowIds.some(imdbId))
  ) || imdbId(info?.imdbId);
};

// Preserve provenance before the hero merge replaces image/background fields.
// This records the existing selection; it never changes its priority or URLs.
export const buildHeroArtworkOrigins = (
  info: Partial<Info>, banner?: string,
): Record<string, HeroArtworkOrigin> => {
  const origins: Record<string, HeroArtworkOrigin> = {};
  const add = (url: string | undefined, source?: HeroArtworkOrigin) => {
    if (url && !Object.prototype.hasOwnProperty.call(origins, url)) {
      origins[url] = source || 'provider';
    }
  };
  const sources = info.extra?.artworkSources;
  add(info.background, sources?.background);
  add(banner, 'anilist');
  add(info.poster, sources?.poster);
  add(info.image, info.image === info.background ? sources?.background
    : info.image === info.poster ? sources?.poster : 'provider');
  return origins;
};

export const isHeroArtworkEligible = (
  provider: string, link: string, info: AnimeHeroMetadata | undefined, uri?: string,
): boolean => {
  if (getMetadataSourceProvider(provider, link) !== 'animeunity') {return true;}
  if (!info || !uri || !hasMappedHeroIdentity(info)) {return false;}
  // Legacy cached metadata can still supply explicit artworkSources.
  const origin = (info.heroArtworkOrigins || buildHeroArtworkOrigins(info))[uri];
  return !!origin && ['tmdb', 'tvdb', 'cinemeta', 'anizip', 'anilist'].includes(origin);
};
