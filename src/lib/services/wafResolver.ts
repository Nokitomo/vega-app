import {headers as commonHeaders} from '../providers/headers';
import type {
  OpenWebViewOptions,
  OpenWebViewResult,
} from '../providers/types';
import {useWafStore} from '../zustand/wafStore';
import {buildCookieString, getCookies, pickUserAgent} from './cookieManager';

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_TIMEOUT_MS = 5 * 60 * 1000;

const assertSupportedUrl = (value: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('openWebView: invalid url');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('openWebView: only http and https URLs are supported');
  }
};

const normalizeTimeout = (timeoutMs?: number): number => {
  if (!timeoutMs || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.min(timeoutMs, MAX_TIMEOUT_MS);
};

export const openWebView = async (
  url: string,
  options?: OpenWebViewOptions,
): Promise<OpenWebViewResult> => {
  assertSupportedUrl(url);

  const userAgent =
    pickUserAgent(options?.headers) || commonHeaders['User-Agent'];

  if (!options?.force && options?.waitForCookie) {
    const cookieMap = await getCookies(url);
    if (cookieMap[options.waitForCookie]) {
      return {
        data: '',
        cookies: buildCookieString(cookieMap),
        cookieMap,
        url,
        userAgent,
      };
    }
  }

  return new Promise<OpenWebViewResult>((resolve, reject) => {
    useWafStore.getState().enqueue({
      ...options,
      url,
      timeoutMs: normalizeTimeout(options?.timeoutMs),
      resolve,
      reject,
    });
  });
};
