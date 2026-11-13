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
  return [
    ...new Set(
      pool
        .sort(
          ({art: a, priority: priorityA}, {art: b, priority: priorityB}) =>
            priorityA - priorityB ||
            a.rank - b.rank ||
            (b.width || 0) * (b.height || 0) -
              (a.width || 0) * (a.height || 0) ||
            a.id.localeCompare(b.id),
        )
        .map(({art}) => imageUrl(art, field, prefs.quality[field])),
    ),
  ];
}
