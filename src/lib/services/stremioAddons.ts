import {secureStorage, settingsStorage} from '../storage';
import i18n from '../../i18n';

export type AddonResource = {
  name: string;
  types?: string[];
  idPrefixes?: string[];
};
export type StremioAddon = {
  url: string;
  id: string;
  name: string;
  version: string;
  description: string;
  resources: AddonResource[];
  types: string[];
  idPrefixes?: string[];
  enabled: boolean;
  configurable: boolean;
  configurationRequired: boolean;
};
export type SubtitleMatch = {
  id: string;
  url: string;
  language: string;
  label: string;
  source: string;
};
const STORAGE_KEY = 'stremioAddons.v1';
const LANGUAGE_KEY = 'stremioSubtitleLanguage.v1';
export const OFFICIAL_SUBTITLE_URL =
  'https://opensubtitles-v3.strem.io/manifest.json';
const listeners = new Set<() => void>();
const cache = new Map<string, {expires: number; data: SubtitleMatch[]}>();
class AddonError extends Error {}
const error = (key: string): never => {
  throw new AddonError(i18n.t(key));
};

/** Configured URLs may contain credentials. Never log URLs or server error bodies. */
export function publicHttpsUrl(input: string): string {
  try {
    if (input.length > 8192) {
      return error('addon.invalidUrl');
    }
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.includes(':') ||
      /^\d+(\.\d+){3}$/.test(host) ||
      !host.includes('.')
    ) {
      return error('addon.invalidUrl');
    }
    return url.toString();
  } catch {
    return error('addon.invalidUrl');
  }
}

export function normalizeAddonUrl(input: string): string {
  const url = publicHttpsUrl(
    input.trim().replace(/^stremio:\/\//i, 'https://'),
  );
  if (!new URL(url).pathname.endsWith('/manifest.json')) {
    return error('addon.manifestRequired');
  }
  return url;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === 'string' && v.length < 160)
        .slice(0, 40)
    : [];
}

export function parseAddonManifest(value: unknown, url: string): StremioAddon {
  const m = value as Record<string, any> | null;
  if (
    !m ||
    typeof m !== 'object' ||
    !['id', 'name', 'version'].every(
      k => typeof m[k] === 'string' && m[k].length > 0 && m[k].length <= 200,
    ) ||
    !Array.isArray(m.resources)
  ) {
    return error('addon.invalidManifest');
  }
  const resources: AddonResource[] = m.resources
    .slice(0, 40)
    .flatMap((r: any) => {
      if (typeof r === 'string') {
        return [{name: r.slice(0, 80)}];
      }
      if (r && typeof r.name === 'string') {
        return [
          {
            name: r.name.slice(0, 80),
            types: Array.isArray(r.types) ? strings(r.types) : undefined,
            idPrefixes: Array.isArray(r.idPrefixes)
              ? strings(r.idPrefixes)
              : undefined,
          },
        ];
      }
      return [];
    });
  if (!resources.length || !strings(m.types).length) {
    return error('addon.invalidManifest');
  }
  return {
    url: normalizeAddonUrl(url),
    id: m.id,
    name: m.name,
    version: m.version,
    description:
      typeof m.description === 'string' ? m.description.slice(0, 700) : '',
    resources,
    types: strings(m.types),
    idPrefixes: Array.isArray(m.idPrefixes) ? strings(m.idPrefixes) : undefined,
    enabled:
      resources.some(r => r.name === 'subtitles') &&
      !m.behaviorHints?.configurationRequired,
    configurable: m.behaviorHints?.configurable === true,
    configurationRequired: m.behaviorHints?.configurationRequired === true,
  };
}

export const supportsSubtitles = (addon: StremioAddon) =>
  addon.resources.some(r => r.name === 'subtitles') &&
  !addon.configurationRequired;
export function matchesSubtitleRequest(
  addon: StremioAddon,
  type: string,
  id: string,
): boolean {
  return (
    addon.enabled &&
    supportsSubtitles(addon) &&
    addon.resources.some(
      r =>
        r.name === 'subtitles' &&
        (r.types ?? addon.types).includes(type) &&
        (!(r.idPrefixes ?? addon.idPrefixes) ||
          (r.idPrefixes ?? addon.idPrefixes)!.some(prefix =>
            id.startsWith(prefix),
          )),
    )
  );
}

const defaultAddon = (): StremioAddon =>
  parseAddonManifest(
    {
      id: 'org.stremio.opensubtitlesv3',
      name: 'OpenSubtitles v3',
      version: '1.0.0',
      resources: ['subtitles'],
      types: ['movie', 'series'],
      idPrefixes: ['tt'],
    },
    OFFICIAL_SUBTITLE_URL,
  );

export function getStremioAddons(): StremioAddon[] {
  const stored = secureStorage.getObject<StremioAddon[]>(STORAGE_KEY);
  if (Array.isArray(stored)) {
    return stored;
  }
  const initial = [defaultAddon()];
  secureStorage.setObject(STORAGE_KEY, initial);
  return initial;
}

function save(addons: StremioAddon[]) {
  secureStorage.setObject(STORAGE_KEY, addons);
  cache.clear();
  listeners.forEach(fn => fn());
}
export function subscribeStremioAddons(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function installStremioAddon(addon: StremioAddon) {
  const current = getStremioAddons();
  if (current.some(a => a.url === addon.url)) {
    return error('addon.duplicate');
  }
  if (current.length >= 30) {
    return error('addon.limit');
  }
  save([...current, addon]);
}
export function removeStremioAddon(url: string) {
  save(getStremioAddons().filter(a => a.url !== url));
}
export function toggleStremioAddon(url: string) {
  save(
    getStremioAddons().map(a =>
      a.url === url && supportsSubtitles(a) ? {...a, enabled: !a.enabled} : a,
    ),
  );
}
export function getSubtitleLanguage(): string {
  return (
    secureStorage.getString(LANGUAGE_KEY) || settingsStorage.getAppLanguage()
  );
}
export function setSubtitleLanguage(language: string) {
  secureStorage.setString(LANGUAGE_KEY, language);
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<any> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) {
    abort();
  }
  signal?.addEventListener('abort', abort);
  const timeout = setTimeout(abort, 12000);
  try {
    const response = await fetch(publicHttpsUrl(url), {
      signal: controller.signal,
      headers: {Accept: 'application/json'},
    });
    if (!response.ok) {
      return error(
        response.status === 429 ? 'addon.rateLimited' : 'addon.unavailable',
      );
    }
    if (Number(response.headers.get('content-length')) > 2000000) {
      return error('addon.invalidResponse');
    }
    const text = await response.text();
    if (text.length > 2000000) {
      return error('addon.invalidResponse');
    }
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof AddonError) {
      throw e;
    }
    return error(
      controller.signal.aborted ? 'addon.timeout' : 'addon.unavailable',
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function inspectStremioAddon(input: string, signal?: AbortSignal) {
  const url = normalizeAddonUrl(input);
  return parseAddonManifest(await fetchJson(url, signal), url);
}
export async function refreshStremioAddon(url: string) {
  const updated = await inspectStremioAddon(url);
  // A removed addon must not be resurrected by a pending refresh.
  save(
    getStremioAddons().map(a =>
      a.url === url
        ? {...updated, enabled: a.enabled && supportsSubtitles(updated)}
        : a,
    ),
  );
}
export function addonConfigurationUrl(addon: StremioAddon) {
  const url = new URL(addon.url);
  url.pathname = url.pathname.replace(/\/manifest\.json$/, '/configure');
  return url.toString();
}

export function subtitleVideoId(
  imdb: string,
  type: 'movie' | 'series',
  season?: string,
  episode?: string,
): string {
  const id = imdb.trim().toLowerCase();
  if (!/^tt\d{1,12}$/.test(id)) {
    return error('addon.imdbRequired');
  }
  if (type === 'movie') {
    return id;
  }
  if (
    !/^\d{1,5}$/.test(season || '') ||
    !/^\d{1,6}$/.test(episode || '') ||
    Number(episode) < 1
  ) {
    return error('addon.episodeRequired');
  }
  return `${id}:${Number(season)}:${Number(episode)}`;
}

export function normalizeSubtitleLanguage(lang: string): string {
  const aliases: Record<string, string> = {
    ita: 'it',
    eng: 'en',
    fre: 'fr',
    fra: 'fr',
    ger: 'de',
    deu: 'de',
    spa: 'es',
    por: 'pt',
    pob: 'pt-BR',
    jpn: 'ja',
    rus: 'ru',
    chi: 'zh',
    zho: 'zh',
    kor: 'ko',
    ara: 'ar',
    hin: 'hi',
    dut: 'nl',
    nld: 'nl',
    swe: 'sv',
    pol: 'pl',
    tur: 'tr',
    dan: 'da',
    nor: 'no',
    fin: 'fi',
    vie: 'vi',
    ind: 'id',
  };
  return aliases[lang.toLowerCase()] || lang.toLowerCase();
}

export async function searchStremioSubtitles(args: {
  imdb: string;
  type: 'movie' | 'series';
  season?: string;
  episode?: string;
  language: string;
  signal?: AbortSignal;
}): Promise<{results: SubtitleMatch[]; failed: string[]}> {
  const id = subtitleVideoId(args.imdb, args.type, args.season, args.episode);
  const addons = getStremioAddons().filter(a =>
    matchesSubtitleRequest(a, args.type, id),
  );
  if (!addons.length) {
    return error('addon.noCompatible');
  }
  const failed: string[] = [];
  const batches = await Promise.all(
    addons.map(async addon => {
      const endpoint = new URL(addon.url);
      endpoint.pathname = endpoint.pathname.replace(
        /\/manifest\.json$/,
        `/subtitles/${args.type}/${encodeURIComponent(id)}.json`,
      );
      const key = endpoint.toString();
      const cached = cache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      }
      try {
        const payload = await fetchJson(key, args.signal);
        if (!Array.isArray(payload?.subtitles)) {
          throw new Error();
        }
        const data: SubtitleMatch[] = payload.subtitles
          .slice(0, 2000)
          .flatMap((s: any) => {
            if (
              !s ||
              typeof s.id !== 'string' ||
              typeof s.url !== 'string' ||
              typeof s.lang !== 'string'
            ) {
              return [];
            }
            try {
              return [
                {
                  id: s.id.slice(0, 200),
                  url: publicHttpsUrl(s.url),
                  language: normalizeSubtitleLanguage(s.lang),
                  label: String(
                    s.label || s.subtitleFileName || s.movieReleaseName || '',
                  ).slice(0, 300),
                  source: addon.name,
                },
              ];
            } catch {
              return [];
            }
          });
        if (!args.signal?.aborted) {
          if (cache.size >= 20) {
            cache.delete(cache.keys().next().value!);
          }
          cache.set(key, {data, expires: Date.now() + 300000});
        }
        return data;
      } catch {
        failed.push(addon.name);
        return [];
      }
    }),
  );
  if (args.signal?.aborted) {
    return {results: [], failed: []};
  }
  const seen = new Set<string>();
  const results = batches.flat().filter(s => {
    if (s.language !== args.language || seen.has(s.url)) {
      return false;
    }
    seen.add(s.url);
    return true;
  });
  return {results, failed};
}
