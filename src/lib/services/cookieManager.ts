import type {
  Cookie,
  Cookies,
} from '@preeternal/react-native-cookie-manager';

type CookieManagerModule = {
  get: (url: string, useWebKit?: boolean) => Promise<Cookies>;
  flush: () => Promise<void>;
};

type NativeCookie = Cookie & {
  name: string;
  value: string;
};

let cookieManager: CookieManagerModule | null | undefined;

const getCookieManager = (): CookieManagerModule | null => {
  const cached = cookieManager;
  if (cached !== undefined) {
    return cached;
  }

  try {
    // Lazy-load so environments without the native module can still boot.
    const loaded =
      require('@preeternal/react-native-cookie-manager').default || null;
    cookieManager = loaded;
  } catch (error) {
    console.warn('[cookieManager] native module unavailable', error);
    cookieManager = null;
  }

  return cookieManager || null;
};

const isNativeCookie = (cookie: unknown): cookie is NativeCookie => {
  if (!cookie || typeof cookie !== 'object') {
    return false;
  }

  const candidate = cookie as Partial<NativeCookie>;
  return (
    typeof candidate.name === 'string' &&
    candidate.name.length > 0 &&
    typeof candidate.value === 'string'
  );
};

export const pickUserAgent = (
  headers?: Record<string, string>,
): string | undefined => {
  if (!headers) {
    return undefined;
  }

  const key = Object.keys(headers).find(
    header => header.toLowerCase() === 'user-agent',
  );
  return key ? headers[key] : undefined;
};

const readCookieStore = async (
  url: string,
  useWebKit: boolean,
): Promise<Cookies> => {
  const manager = getCookieManager();
  if (!manager) {
    return {};
  }

  try {
    return await manager.get(url, useWebKit);
  } catch (error) {
    console.warn('[cookieManager] failed to read cookies', error);
    return {};
  }
};

export const getCookieObjects = async (
  url: string,
): Promise<NativeCookie[]> => {
  const manager = getCookieManager();
  if (!manager) {
    return [];
  }

  try {
    await manager.flush();
  } catch {}

  const stores = await Promise.all([
    readCookieStore(url, true),
    readCookieStore(url, false),
  ]);
  const byName: Record<string, NativeCookie> = {};

  for (const store of stores) {
    for (const value of Object.values(store)) {
      if (isNativeCookie(value)) {
        byName[value.name] = value;
      }
    }
  }

  return Object.values(byName);
};

export const getCookies = async (
  url: string,
): Promise<Record<string, string>> => {
  const cookieObjects = await getCookieObjects(url);
  const map: Record<string, string> = {};

  for (const cookie of cookieObjects) {
    map[cookie.name] = cookie.value;
  }

  return map;
};

export const buildCookieString = (map: Record<string, string>): string =>
  Object.entries(map)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
