import type {CatalogPreferences, ImageField} from './types';

export const imageFields: ImageField[] = [
  'poster',
  'background',
  'logo',
  'seasonPoster',
  'episodeThumbnail',
];
export const tmdbSizes: Record<ImageField, string[]> = {
  poster: ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'],
  seasonPoster: ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'],
  background: ['w300', 'w780', 'w1280', 'original'],
  logo: ['w45', 'w92', 'w154', 'w185', 'w300', 'w500', 'original'],
  episodeThumbnail: ['w92', 'w185', 'w300', 'original'],
};
export function defaultCatalogPreferences(): CatalogPreferences {
  return {
    version: 1,
    selected: false,
    automatic: true,
    cellular: false,
    order: {
      poster: [
        'tmdb:it',
        'tmdb:en',
        'tmdb:original',
        'tmdb:xx',
        'tvdb:*',
        'streamingunity:it',
      ],
      background: ['tmdb:xx', 'tvdb:*', 'streamingunity:*'],
      logo: ['tmdb:it', 'tmdb:en', 'tmdb:xx', 'streamingunity:*', 'tvdb:*'],
      seasonPoster: ['tmdb:it', 'tmdb:en', 'tvdb:*', 'tmdb:xx'],
      episodeThumbnail: ['streamingunity:*', 'tmdb:*', 'tvdb:*'],
    },
    quality: {
      poster: 'original',
      background: 'original',
      logo: 'original',
      seasonPoster: 'original',
      episodeThumbnail: 'original',
    },
    sections: [
      {
        id: 'movies',
        title: '',
        enabled: true,
        type: 'movie',
        genres: [],
        sort: 'added',
      },
      {
        id: 'series',
        title: '',
        enabled: true,
        type: 'tv',
        genres: [],
        sort: 'added',
      },
      {
        id: 'popular',
        title: '',
        enabled: true,
        type: '',
        genres: [],
        sort: 'views',
      },
    ],
    heroSection: 'popular',
  };
}

export function readCatalogPreferences(
  raw?: string | null,
): CatalogPreferences {
  const defaults = defaultCatalogPreferences();
  try {
    const value = JSON.parse(raw || 'null');
    if (!value || value.version !== 1) {
      return defaults;
    }
    for (const field of imageFields) {
      if (
        Array.isArray(value.order?.[field]) &&
        value.order[field].every(
          (v: unknown) =>
            typeof v === 'string' &&
            /^[a-z0-9_-]+:(?:[a-z]{2,3}|original|unknown|\*)$/.test(v),
        )
      ) {
        defaults.order[field] = [...new Set<string>(value.order[field])];
      }
      if (tmdbSizes[field].includes(value.quality?.[field])) {
        defaults.quality[field] = value.quality[field];
      }
    }
    for (const key of ['selected', 'automatic', 'cellular'] as const) {
      if (typeof value[key] === 'boolean') {
        defaults[key] = value[key];
      }
    }
    if (Array.isArray(value.sections)) {
      defaults.sections = value.sections
        .filter(
          (s: any) =>
            s &&
            typeof s.id === 'string' &&
            typeof s.title === 'string' &&
            typeof s.enabled === 'boolean' &&
            ['', 'movie', 'tv'].includes(s.type) &&
            ['title', 'year', 'added', 'views'].includes(s.sort) &&
            Array.isArray(s.genres) &&
            s.genres.every((g: unknown) => typeof g === 'string') &&
            [s.fromYear, s.toYear].every(
              y => y === undefined || Number.isInteger(y),
            ),
        )
        .slice(0, 30);
    }
    if (typeof value.heroSection === 'string') {
      defaults.heroSection = value.heroSection;
    }
  } catch {
    /* Invalid local preferences recover to defaults. */
  }
  return defaults;
}
