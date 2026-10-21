type StreamCenterRouteKind = 'filter' | 'meta' | 'episodes' | 'stream';

const STREAMCENTER_ROUTE_PREFIX = 'streamcenter:v1:';

const decodeStreamCenterRoute = (
  value: string,
  expectedKind?: StreamCenterRouteKind,
) => {
  const raw = String(value || '').trim();
  if (!raw.startsWith(STREAMCENTER_ROUTE_PREFIX)) {
    return null;
  }

  const remainder = raw.slice(STREAMCENTER_ROUTE_PREFIX.length);
  const firstSeparator = remainder.indexOf(':');
  const secondSeparator = remainder.indexOf(':', firstSeparator + 1);
  if (firstSeparator <= 0 || secondSeparator <= firstSeparator) {
    return null;
  }

  const kind = remainder.slice(0, firstSeparator) as StreamCenterRouteKind;
  if (
    expectedKind &&
    kind !== expectedKind
  ) {
    return null;
  }

  try {
    const data = JSON.parse(
      decodeURIComponent(remainder.slice(secondSeparator + 1)),
    ) as {url?: string};
    return typeof data?.url === 'string' ? data.url.trim() : null;
  } catch {
    return null;
  }
};

export const resolveWebViewLink = (value: string): string => {
  const normalized = String(value || '').trim();
  const resolved = decodeStreamCenterRoute(normalized, 'meta') || normalized;
  try {
    const url = new URL(resolved);
    if (url.protocol === 'https:' && /^(?:www\.)?animeunity\.so$/i.test(url.hostname)) {
      url.hostname = url.hostname.toLowerCase().startsWith('www.')
        ? 'www.animeunity.co'
        : 'animeunity.co';
      return url.toString();
    }
  } catch {
    // Keep non-URL provider links unchanged.
  }
  return resolved;
};

export const resolveLegacyAnimeUnityImageUrl = (value: string): string => {
  if (!/^https:\/\/img\.animeunity\.so(?:[/?#]|$)/i.test(value)) {
    return value;
  }
  return value.replace(/^https:\/\/img\.animeunity\.so/i, 'https://img.animeunity.co');
};
