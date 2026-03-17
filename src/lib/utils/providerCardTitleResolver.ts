import {Post} from '../providers/types';
import {providerManager} from '../services/ProviderManager';

const PROVIDER_CARD_TITLE_VALUES = new Set([
  'animeunity',
  'streamingunity',
  'streamingcommunity',
  'altadefinizionez',
]);

const SEARCH_TIMEOUT_MS = 8000;

const normalizeWhitespace = (value?: string) =>
  (value || '').replace(/\s+/g, ' ').trim();

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseUrl = (value: string): URL | null => {
  if (!value) {
    return null;
  }
  try {
    return new URL(value);
  } catch {
    try {
      return new URL(value, 'https://vega.local');
    } catch {
      return null;
    }
  }
};

const getPathname = (value: string): string => {
  const parsed = parseUrl(value);
  if (!parsed) {
    return safeDecode(value.split(/[?#]/)[0] || '');
  }
  return safeDecode(parsed.pathname || '');
};

const normalizeLink = (value: string): string => {
  const parsed = parseUrl(value);
  if (!parsed) {
    return normalizeWhitespace(value).toLowerCase().replace(/\/+$/, '');
  }
  const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const pathname = safeDecode(parsed.pathname || '')
    .replace(/\/+$/, '')
    .toLowerCase();
  return `${hostname}${pathname}`;
};

const extractNumericId = (value: string): string | undefined => {
  const pathname = getPathname(value).toLowerCase();
  const directMatch = pathname.match(/(?:^|\/)(\d+)(?:-|\/|$)/);
  if (directMatch?.[1]) {
    return directMatch[1];
  }
  const titleIdMatch = pathname.match(/\/titles?\/(\d+)(?:-|\/|$)/);
  if (titleIdMatch?.[1]) {
    return titleIdMatch[1];
  }
  return undefined;
};

const extractSlug = (link: string): string => {
  const pathname = getPathname(link);
  const parts = pathname.split('/').filter(Boolean);
  const lastSegment = safeDecode(parts[parts.length - 1] || '')
    .replace(/\.html?$/i, '')
    .trim();
  if (!lastSegment) {
    return '';
  }
  return lastSegment.replace(/^\d+-/, '');
};

const slugToTitle = (slug: string): string =>
  normalizeWhitespace(slug.replace(/[_-]+/g, ' ').replace(/\./g, ' '));

const findMatchingPostTitle = (posts: Post[], link: string): string => {
  const targetLink = normalizeLink(link);
  const directMatch = posts.find(post => normalizeLink(post?.link || '') === targetLink);
  if (directMatch?.title) {
    return normalizeWhitespace(directMatch.title);
  }

  const targetId = extractNumericId(link);
  if (targetId) {
    const idMatch = posts.find(
      post => extractNumericId(post?.link || '') === targetId,
    );
    if (idMatch?.title) {
      return normalizeWhitespace(idMatch.title);
    }
  }

  return '';
};

const searchProviderCardTitle = async ({
  providerValue,
  link,
  fallbackTitle,
}: {
  providerValue: string;
  link: string;
  fallbackTitle?: string;
}): Promise<string> => {
  const slugQuery = slugToTitle(extractSlug(link));
  const searchQuery = slugQuery || normalizeWhitespace(fallbackTitle);
  if (!searchQuery) {
    return '';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const posts = await providerManager.getSearchPosts({
      searchQuery,
      page: 1,
      providerValue,
      signal: controller.signal,
    });
    if (!Array.isArray(posts) || posts.length === 0) {
      return '';
    }
    return findMatchingPostTitle(posts, link);
  } catch (error) {
    console.error('Error resolving provider card title:', error);
    return '';
  } finally {
    clearTimeout(timeout);
  }
};

export const shouldResolveProviderCardTitle = (providerValue?: string): boolean =>
  PROVIDER_CARD_TITLE_VALUES.has((providerValue || '').toLowerCase());

export const resolveProviderCardTitle = async ({
  providerValue,
  link,
  fallbackTitle,
}: {
  providerValue?: string;
  link: string;
  fallbackTitle?: string;
}): Promise<string> => {
  const normalizedProvider = (providerValue || '').toLowerCase();
  const normalizedFallback = normalizeWhitespace(fallbackTitle);

  if (!shouldResolveProviderCardTitle(normalizedProvider) || !link) {
    return normalizedFallback;
  }

  const providerTitle = await searchProviderCardTitle({
    providerValue: normalizedProvider,
    link,
    fallbackTitle: normalizedFallback,
  });
  if (providerTitle) {
    return providerTitle;
  }

  const slugTitle = slugToTitle(extractSlug(link));
  if (slugTitle) {
    return slugTitle;
  }

  return normalizedFallback;
};
