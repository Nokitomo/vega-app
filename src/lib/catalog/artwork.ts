import {tmdbSizes} from './preferences';
import type {Artwork, CatalogPreferences, ImageField} from './types';

export function imageUrl(
  art: Artwork,
  field: ImageField,
  quality: string,
): string {
  if (art.source !== 'tmdb' || !tmdbSizes[field].includes(quality)) {
    return art.url;
  }
  try {
    const url = new URL(art.url);
    if (url.hostname !== 'image.tmdb.org' || /\.svg$/i.test(url.pathname)) {
      return art.url;
    }
    url.pathname = url.pathname.replace(/^\/t\/p\/[^/]+\//, `/t/p/${quality}/`);
    return url.href;
  } catch {
    return art.url;
  }
}

function rankedImages(
  rows: Artwork[],
  field: ImageField,
  prefs: CatalogPreferences,
  options: {originalLanguage?: string; blocked?: boolean} = {},
) {
  if (options.blocked) {
    return [];
  }
  const eligible = rows.filter(a => a.eligible);
  const forced = eligible.filter(a => a.forced);
  const rules = prefs.order[field].map(rule => {
    const [source, language] = rule.split(':');
    return {
      source,
      language: language === 'original' ? options.originalLanguage : language,
    };
  });
  const pool = forced.length
    ? forced.map(art => ({art, priority: 0}))
    : eligible.map(art => ({
        art,
        priority: rules.findIndex(rule =>
          rule.source === art.source &&
          (rule.language === '*' || rule.language === (art.language ?? 'unknown')),
        ),
      })).filter(candidate => candidate.priority >= 0);
  return pool;
}

type RankedImage = ReturnType<typeof rankedImages>[number];

function compareImages(a: RankedImage, b: RankedImage) {
  return a.priority - b.priority ||
    a.art.rank - b.art.rank ||
    (b.art.width || 0) * (b.art.height || 0) -
      (a.art.width || 0) * (a.art.height || 0) ||
    a.art.id.localeCompare(b.art.id);
}

export function selectImages(
  ...[rows, field, prefs, options]: Parameters<typeof rankedImages>
): string[] {
  return [...new Set(rankedImages(rows, field, prefs, options)
    .sort(compareImages)
    .map(({art}) => imageUrl(art, field, prefs.quality[field])))];
}

export function selectCardPoster(
  rows: Artwork[],
  prefs: CatalogPreferences,
  originalLanguage: string,
) {
  const pool = rankedImages(rows, 'poster', prefs, {originalLanguage});
  let first: RankedImage | undefined;
  for (const candidate of pool) {
    if (!first || compareImages(candidate, first) < 0) {
      first = candidate;
    }
  }
  const quality = prefs.quality.poster;
  const image = first ? imageUrl(first.art, 'poster', quality) : '';
  let index = 0;
  let last = image;
  let seen: Set<string> | undefined;
  let nextByUrl: Map<string, string> | undefined;
  return {
    image,
    nextImageCandidate: image && pool.length > 1 ? (current: string) => {
      if (current !== last) {
        return nextByUrl?.get(current);
      }
      if (!seen) {
        pool.sort(compareImages);
        seen = new Set([image]);
        index = 1;
      }
      while (index < pool.length) {
        const url = imageUrl(pool[index++].art, 'poster', quality);
        if (!seen.has(url)) {
          seen.add(url);
          (nextByUrl ??= new Map()).set(current, url);
          last = url;
          return url;
        }
      }
      return undefined;
    } : undefined,
  };
}
