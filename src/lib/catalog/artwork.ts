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

export function selectImages(
  rows: Artwork[],
  field: ImageField,
  prefs: CatalogPreferences,
  options: {originalLanguage?: string; blocked?: boolean} = {},
): string[] {
  if (options.blocked) {
    return [];
  }
  const eligible = rows.filter(a => a.eligible);
  const forced = eligible.filter(a => a.forced);
  const priority = (a: Artwork) =>
    prefs.order[field].findIndex(rule => {
      const [source, language] = rule.split(':');
      const resolved =
        language === 'original' ? options.originalLanguage : language;
      return (
        source === a.source &&
        (resolved === '*' || resolved === (a.language ?? 'unknown'))
      );
    });
  const pool = forced.length ? forced : eligible.filter(a => priority(a) >= 0);
  return [
    ...new Set(
      pool
        .sort(
          (a, b) =>
            (forced.length ? 0 : priority(a) - priority(b)) ||
            a.rank - b.rank ||
            (b.width || 0) * (b.height || 0) -
              (a.width || 0) * (a.height || 0) ||
            a.id.localeCompare(b.id),
        )
        .map(a => imageUrl(a, field, prefs.quality[field])),
    ),
  ];
}
