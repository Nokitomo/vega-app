import {cacheStorage} from '../storage';
import {getAnimeSkipSession} from './animeSkipAuth';

export type VideoSkipType =
  | 'opening'
  | 'ending'
  | 'recap'
  | 'mixed-opening'
  | 'mixed-ending'
  | 'credits'
  | 'intro'
  | 'preview';

export type VideoSkipStamp = {
  type: VideoSkipType;
  startTime: number;
  endTime: number;
  source: 'AniSkip' | 'TheIntroDB' | 'IntroDB' | 'AnimeSkip';
};

export type VideoSkipContext = {
  title: string;
  type: string;
  episodeNumber?: number;
  seasonNumber?: number;
  duration: number;
  malId?: number;
  imdbId?: string;
  tmdbId?: number;
};

const REQUEST_TIMEOUT_MS = 8000;

const withTimeout = async <T>(
  callback: (signal: AbortSignal) => Promise<T>,
  parentSignal?: AbortSignal,
): Promise<T> => {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  parentSignal?.addEventListener('abort', onAbort, {once: true});
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await callback(controller.signal);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onAbort);
  }
};

const getJson = async <T>(url: string, signal?: AbortSignal): Promise<T> =>
  withTimeout(async timeoutSignal => {
    const response = await fetch(url, {signal: timeoutSignal});
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }, signal);

const validStamp = (
  type: VideoSkipType,
  startTime: unknown,
  endTime: unknown,
  source: VideoSkipStamp['source'],
  duration: number,
): VideoSkipStamp | undefined => {
  const start = Number(startTime);
  const end = Number(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return undefined;
  }
  const boundedStart = Math.max(0, start);
  const boundedEnd = duration > 0 ? Math.min(end, duration) : end;
  return boundedEnd > boundedStart
    ? {type, startTime: boundedStart, endTime: boundedEnd, source}
    : undefined;
};

const isMovie = (type: string) => /movie|film/i.test(type);
const isAnime = (context: VideoSkipContext) =>
  !!context.malId || /anime|ova/i.test(context.type);
const isSeries = (context: VideoSkipContext) => !isMovie(context.type);

export const resolveAniSkip = async (
  context: VideoSkipContext,
  signal?: AbortSignal,
): Promise<VideoSkipStamp[]> => {
  if (!isAnime(context) || !context.malId || !context.episodeNumber) {
    return [];
  }
  const types = ['ed', 'mixed-ed', 'mixed-op', 'op', 'recap']
    .map(type => `types[]=${encodeURIComponent(type)}`)
    .join('&');
  const url = `https://api.aniskip.com/v2/skip-times/${context.malId}/${context.episodeNumber}?${types}&episodeLength=${Math.max(0, Math.floor(context.duration))}`;
  const response = await getJson<{
    found?: boolean;
    results?: Array<{
      skipType?: string;
      interval?: {startTime?: number; endTime?: number};
    }>;
  }>(url, signal);
  if (!response.found || !Array.isArray(response.results)) {
    return [];
  }
  const typeMap: Record<string, VideoSkipType> = {
    op: 'opening',
    ed: 'ending',
    recap: 'recap',
    'mixed-op': 'mixed-opening',
    'mixed-ed': 'mixed-ending',
  };
  return response.results.flatMap(item => {
    const type = typeMap[item.skipType || ''];
    const stamp = type
      ? validStamp(
          type,
          item.interval?.startTime,
          item.interval?.endTime,
          'AniSkip',
          context.duration,
        )
      : undefined;
    return stamp ? [stamp] : [];
  });
};

export const resolveTheIntroDb = async (
  context: VideoSkipContext,
  signal?: AbortSignal,
): Promise<VideoSkipStamp[]> => {
  const id = context.tmdbId
    ? `tmdb_id=${context.tmdbId}`
    : context.imdbId
      ? `imdb_id=${encodeURIComponent(context.imdbId)}`
      : '';
  if (!id || (!isMovie(context.type) && (!context.seasonNumber || !context.episodeNumber))) {
    return [];
  }
  const episodeQuery = isMovie(context.type)
    ? ''
    : `&season=${context.seasonNumber}&episode=${context.episodeNumber}`;
  const response = await getJson<Record<string, Array<{start_ms?: number; end_ms?: number}>>>(
    `https://api.theintrodb.org/v2/media?${id}${episodeQuery}`,
    signal,
  );
  const groups: Array<[string, VideoSkipType]> = [
    ['intro', 'intro'],
    ['credits', 'credits'],
    ['recap', 'recap'],
    ['preview', 'preview'],
  ];
  return groups.flatMap(([key, type]) =>
    (Array.isArray(response[key]) ? response[key] : []).flatMap(item => {
      const stamp = validStamp(
        type,
        Number(item.start_ms ?? 0) / 1000,
        Number(item.end_ms ?? context.duration * 1000) / 1000,
        'TheIntroDB',
        context.duration,
      );
      return stamp ? [stamp] : [];
    }),
  );
};

export const resolveIntroDb = async (
  context: VideoSkipContext,
  signal?: AbortSignal,
): Promise<VideoSkipStamp[]> => {
  if (
    !isSeries(context) ||
    isAnime(context) ||
    !context.imdbId ||
    !context.seasonNumber ||
    !context.episodeNumber
  ) {
    return [];
  }
  const response = await getJson<Record<string, {start_ms?: number; end_ms?: number} | null>>(
    `https://api.introdb.app/segments?imdb_id=${encodeURIComponent(context.imdbId)}&season=${context.seasonNumber}&episode=${context.episodeNumber}`,
    signal,
  );
  const groups: Array<[string, VideoSkipType]> = [
    ['intro', 'opening'],
    ['recap', 'recap'],
    ['outro', 'ending'],
  ];
  return groups.flatMap(([key, type]) => {
    const item = response[key];
    const stamp = item
      ? validStamp(
          type,
          Number(item.start_ms) / 1000,
          Number(item.end_ms) / 1000,
          'IntroDB',
          context.duration,
        )
      : undefined;
    return stamp ? [stamp] : [];
  });
};

const normalizeAscii = (value?: string) =>
  value?.replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase();

export const resolveAnimeSkip = async (
  context: VideoSkipContext,
  signal?: AbortSignal,
): Promise<VideoSkipStamp[]> => {
  const session = getAnimeSkipSession();
  if (!session?.clientId || !isAnime(context) || !context.episodeNumber) {
    return [];
  }
  const query = `{
    searchShows(search: ${JSON.stringify(context.title)}, limit: 1) {
      name originalName seasonCount episodeCount
      episodes { number absoluteNumber season timestamps { at type { name } } }
    }
  }`;
  const data = await withTimeout(async timeoutSignal => {
    const response = await fetch('https://api.anime-skip.com/graphql', {
      method: 'POST',
      signal: timeoutSignal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Client-ID': session.clientId,
      },
      body: JSON.stringify({query}),
    });
    if (!response.ok) {
      throw new Error(`AnimeSkip HTTP ${response.status}`);
    }
    return (await response.json()) as {
      data?: {searchShows?: Array<{name?: string; episodes?: Array<{number?: string; absoluteNumber?: string; season?: string; timestamps?: Array<{at?: number; type?: {name?: string}}>}>}>};
    };
  }, signal);
  const normalizedTitle = normalizeAscii(context.title);
  const show = data.data?.searchShows?.find(
    candidate =>
      normalizedTitle &&
      normalizedTitle.length > 4 &&
      normalizeAscii(candidate.name) === normalizedTitle,
  );
  const episodeNumber = String(context.episodeNumber);
  const episode = show?.episodes?.find(item => item.absoluteNumber === episodeNumber) ||
    show?.episodes?.find(
      item =>
        item.number === episodeNumber &&
        (!context.seasonNumber || !item.season || item.season === String(context.seasonNumber)),
    );
  const timestamps = episode?.timestamps || [];
  const typeMap: Record<string, VideoSkipType> = {
    Intro: 'intro',
    'New Intro': 'intro',
    Credits: 'credits',
    Preview: 'preview',
    Recap: 'recap',
    'Mixed Credits': 'mixed-ending',
  };
  const stamps: VideoSkipStamp[] = [];
  timestamps.forEach((timestamp, index) => {
    const type = typeMap[timestamp.type?.name || ''];
    const nextAt = timestamps[index + 1]?.at ?? context.duration;
    const stamp = type
      ? validStamp(type, timestamp.at, nextAt, 'AnimeSkip', context.duration)
      : undefined;
    if (stamp) {
      stamps.push(stamp);
    }
  });
  return stamps;
};

const resolvers = [resolveAniSkip, resolveTheIntroDb, resolveIntroDb, resolveAnimeSkip];

export const getVideoSkipStamps = async (
  context: VideoSkipContext,
  signal?: AbortSignal,
): Promise<VideoSkipStamp[]> => {
  const cacheKey = `video-skip:v3:${JSON.stringify(context)}`;
  const cached = cacheStorage.getObject<VideoSkipStamp[]>(cacheKey);
  if (cached && (!cached.some(stamp => stamp.source === 'AnimeSkip') || getAnimeSkipSession())) {
    return cached;
  }
  if (cached) {
    cacheStorage.delete(cacheKey);
  }
  for (const resolver of resolvers) {
    try {
      const stamps = await resolver(context, signal);
      if (stamps.length > 0) {
        cacheStorage.setObject(cacheKey, stamps);
        return stamps;
      }
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      console.warn('Video skip resolver failed', error);
    }
  }
  return [];
};
