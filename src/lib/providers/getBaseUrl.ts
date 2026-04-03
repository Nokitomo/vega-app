import {cacheStorageService} from '../storage';
import {PASTEBIN_PROVIDERS, PASTEBIN_URL} from './baseUrlRegistry';

// 1 hour
const expireTime = 60 * 60 * 1000;

const BASE_URL_CACHE_REVISIONS: Record<string, string> = {
  altadefinizionez: '2',
};

const getBaseUrlCacheRevision = (providerValue: string) =>
  BASE_URL_CACHE_REVISIONS[providerValue] || '1';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const getPastebinBaseUrl = async (
  providerValue: string,
): Promise<string | null> => {
  const config = PASTEBIN_PROVIDERS[providerValue];
  if (!config) {
    return null;
  }
  try {
    const res = await fetch(PASTEBIN_URL);
    const text = await res.text();
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    for (const line of lines) {
      const withoutProtocol = line.replace(/^https?:\/\//i, '');
      const host = withoutProtocol.split('/')[0].split(':')[0];
      if (!host) {
        continue;
      }
      if (config.match.test(host)) {
        return normalizeBaseUrl(line);
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const getBaseUrl = async (providerValue: string) => {
  try {
    let baseUrl = '';
    const cacheRevision = getBaseUrlCacheRevision(providerValue);
    const cacheKey = `CacheBaseUrl${providerValue}:v${cacheRevision}`;
    const timeKey = `baseUrlTime${providerValue}:v${cacheRevision}`;

    const cachedUrl = cacheStorageService.getString(cacheKey);
    const cachedTime = cacheStorageService.getObject<number>(timeKey);

    if (cachedUrl && cachedTime && Date.now() - cachedTime < expireTime) {
      baseUrl = cachedUrl;
      console.log(`[baseUrl] cache ${providerValue} -> ${baseUrl}`);
    } else {
      const pastebinUrl = await getPastebinBaseUrl(providerValue);
      if (pastebinUrl) {
        baseUrl = pastebinUrl;
        console.log(`[baseUrl] pastebin ${providerValue}`);
        cacheStorageService.setString(cacheKey, baseUrl);
        cacheStorageService.setObject(timeKey, Date.now());
      } else {
        if (PASTEBIN_PROVIDERS[providerValue]) {
          console.log(`[baseUrl] pastebin missing ${providerValue}`);
          return '';
        }
        const baseUrlRes = await fetch(
          'https://himanshu8443.github.io/providers/modflix.json',
        );
        const baseUrlData = await baseUrlRes.json();
        baseUrl = baseUrlData[providerValue].url;
        console.log(`[baseUrl] modflix ${providerValue} -> ${baseUrl}`);
        cacheStorageService.setString(cacheKey, baseUrl);
        cacheStorageService.setObject(timeKey, Date.now());
      }
    }
    return baseUrl;
  } catch (error) {
    console.error(`Error fetching baseUrl: ${providerValue}`, error);
    return '';
  }
};
