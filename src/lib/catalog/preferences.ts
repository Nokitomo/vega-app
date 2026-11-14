import {Dimensions, Platform} from 'react-native';
import {isTabletScreen} from '../utils/adaptiveNavigation';
import type {CatalogPreferences, ImageField} from './types';

export const DEFAULT_DETAIL_CACHE_MB = 200;

export function isDetailCacheLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= 1 && Number.isSafeInteger(value * 1_000_000);
}

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
  const {width, height} = Dimensions.get('screen');
  const posterQuality = Platform.isTV ? 'original' : isTabletScreen(width, height) ? 'w780' : 'w342';
  return {
    version: 1,
    selected: false,
    automatic: true,
    cellular: false,
    detailCacheMb: DEFAULT_DETAIL_CACHE_MB,
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
      poster: posterQuality,
      background: 'original',
      logo: 'original',
      seasonPoster: posterQuality,
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
    if (isDetailCacheLimit(value.detailCacheMb)) {
      defaults.detailCacheMb = value.detailCacheMb;
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
  if (!defaults.sections.length) {
    defaults.sections = defaultCatalogPreferences().sections;
  }
  if (!defaults.sections.some(section => section.enabled)) {
    defaults.sections[0] = {...defaults.sections[0], enabled: true};
  }
  if (!defaults.sections.some(section => section.enabled && section.id === defaults.heroSection)) {
    defaults.heroSection = defaults.sections.find(section => section.enabled)!.id;
  }
  return defaults;
}
