import type {
  MediaLoadRequest,
  MediaQueueItem,
  MediaTrack,
} from 'react-native-google-cast';
import type {EpisodeLink, Stream} from '../providers/types';
import {providerManager} from '../services/ProviderManager';

const HTTP_URL_REGEX = /^https?:\/\//i;
const DEFAULT_STREAM_TIMEOUT_MS = 15000;
const DEFAULT_MAX_QUEUE_ITEMS = 120;
const DEFAULT_QUEUE_CONCURRENCY = 3;

type CastEpisode = Pick<EpisodeLink, 'title' | 'link' | 'episodeNumber'> & {
  seasonNumber?: number;
};

type CastQueueContext = {
  primaryTitle?: string;
  secondaryTitle?: string;
  posterUrl?: string;
  providerValue?: string;
  infoUrl?: string;
  seasonNumber?: number;
  playbackRate?: number;
  startTime?: number;
  preferredSubtitleUri?: string;
};

type PrepareNativeCastQueueInput = {
  currentEpisodeLink: string;
  episodeList: CastEpisode[];
  selectedStream: Stream;
  providerValue: string;
  contentType: string;
  context?: CastQueueContext;
  maxQueueItems?: number;
};

export type VegaCastSessionSubtitle = {
  uri: string;
  title: string;
  language: string;
  type: string;
};

export type VegaCastSessionItem = {
  episodeLink: string;
  episodeTitle: string;
  streamUrl: string;
  contentType: string;
  headers: Record<string, string>;
  subtitles: VegaCastSessionSubtitle[];
  episodeNumber?: number;
  seasonNumber?: number;
};

export type VegaCastSessionPayload = {
  version: 1;
  createdAt: number;
  providerValue: string;
  infoUrl?: string;
  primaryTitle?: string;
  secondaryTitle?: string;
  posterUrl?: string;
  playbackRate: number;
  queue: {
    startIndex: number;
    startTime: number;
    items: VegaCastSessionItem[];
  };
};

export type PrepareVegaCastSessionInput = PrepareNativeCastQueueInput;

type QueueSource = {
  episode: CastEpisode;
  stream: Stream;
};

const isHttpUrl = (value?: string): value is string =>
  !!value && HTTP_URL_REGEX.test(value.trim());

const normalizeHeaders = (
  headers?: Record<string, unknown>,
): Record<string, string> => {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  return Object.entries(headers).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      const normalizedKey = String(key || '').trim();
      const normalizedValue = String(value ?? '').trim();
      if (!normalizedKey || !normalizedValue) {
        return acc;
      }
      acc[normalizedKey] = normalizedValue;
      return acc;
    },
    {},
  );
};

const mapSubtitleContentType = (uri: string, fallbackType?: string): string => {
  const normalizedFallback = (fallbackType || '').toLowerCase();
  if (normalizedFallback.includes('subrip') || normalizedFallback.includes('srt')) {
    return 'application/x-subrip';
  }
  if (normalizedFallback.includes('ttml')) {
    return 'application/ttml+xml';
  }
  if (normalizedFallback.includes('vtt')) {
    return 'text/vtt';
  }

  const cleanUri = uri.split('?')[0]?.split('#')[0] || '';
  if (/\.srt$/i.test(cleanUri)) {
    return 'application/x-subrip';
  }
  if (/\.ttml$/i.test(cleanUri)) {
    return 'application/ttml+xml';
  }
  return 'text/vtt';
};

const mapVideoContentType = (stream: Stream): string => {
  const normalizedType = (stream.type || '').toLowerCase();
  const cleanUrl = (stream.link || '').split('?')[0]?.split('#')[0] || '';

  if (
    normalizedType.includes('hls') ||
    normalizedType.includes('m3u8') ||
    /\.m3u8$/i.test(cleanUrl)
  ) {
    return 'application/x-mpegURL';
  }
  if (
    normalizedType.includes('dash') ||
    normalizedType.includes('mpd') ||
    /\.mpd$/i.test(cleanUrl)
  ) {
    return 'application/dash+xml';
  }
  if (normalizedType.includes('mkv') || /\.mkv$/i.test(cleanUrl)) {
    return 'video/x-matroska';
  }
  if (normalizedType.includes('webm') || /\.webm$/i.test(cleanUrl)) {
    return 'video/webm';
  }
  if (normalizedType.includes('mp4') || /\.mp4$/i.test(cleanUrl)) {
    return 'video/mp4';
  }
  return 'application/x-mpegURL';
};

const parseEpisodeNumber = (episode: CastEpisode): number | undefined => {
  if (typeof episode.episodeNumber === 'number' && Number.isFinite(episode.episodeNumber)) {
    return episode.episodeNumber;
  }
  const match = (episode.title || '').match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return undefined;
  }
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildSubtitleTracks = (
  stream: Stream,
  preferredSubtitleUri?: string,
): {
  mediaTracks: MediaTrack[];
  activeTrackIds?: number[];
} => {
  const subtitleTracks = Array.isArray(stream.subtitles) ? stream.subtitles : [];
  if (subtitleTracks.length === 0) {
    return {mediaTracks: []};
  }

  const mediaTracks: MediaTrack[] = [];
  let activeTrackIds: number[] | undefined;
  let nextTrackId = 1000;

  subtitleTracks.forEach(track => {
    const subtitleUri = typeof track?.uri === 'string' ? track.uri.trim() : '';
    if (!isHttpUrl(subtitleUri)) {
      return;
    }

    const id = nextTrackId;
    nextTrackId += 1;
    mediaTracks.push({
      id,
      type: 'text',
      subtype: 'subtitles',
      contentId: subtitleUri,
      contentType: mapSubtitleContentType(subtitleUri, track?.type),
      name: track?.title || track?.language || `Subtitle ${id - 999}`,
      language: track?.language || 'it',
    });

    if (
      preferredSubtitleUri &&
      subtitleUri.toLowerCase() === preferredSubtitleUri.toLowerCase()
    ) {
      activeTrackIds = [id];
    }
  });

  return {mediaTracks, activeTrackIds};
};

const withTimeout = async <T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs = DEFAULT_STREAM_TIMEOUT_MS,
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await promiseFactory(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const pickBestStream = (
  streams: Stream[],
  preferredServer?: string,
): Stream | null => {
  const candidates = streams.filter(stream => isHttpUrl(stream?.link));
  if (candidates.length === 0) {
    return null;
  }

  const preferred = (preferredServer || '').trim().toLowerCase();
  if (preferred) {
    const matched = candidates.find(
      stream => (stream.server || '').trim().toLowerCase() === preferred,
    );
    if (matched) {
      return matched;
    }
  }

  return candidates[0];
};

const buildQueueItem = (
  source: QueueSource,
  context: CastQueueContext,
): MediaQueueItem => {
  const normalizedHeaders = normalizeHeaders(
    source.stream.headers && typeof source.stream.headers === 'object'
      ? source.stream.headers
      : undefined,
  );
  const episodeNumber = parseEpisodeNumber(source.episode);
  const seasonNumber =
    typeof source.episode.seasonNumber === 'number'
      ? source.episode.seasonNumber
      : context.seasonNumber;

  const {mediaTracks, activeTrackIds} = buildSubtitleTracks(
    source.stream,
    context.preferredSubtitleUri,
  );

  return {
    autoplay: true,
    preloadTime: 15,
    ...(activeTrackIds ? {activeTrackIds} : {}),
    mediaInfo: {
      contentUrl: source.stream.link,
      contentType: mapVideoContentType(source.stream),
      streamType: 'buffered',
      ...(mediaTracks.length > 0 ? {mediaTracks} : {}),
      metadata: {
        type: 'tvShow',
        title: source.episode.title || context.secondaryTitle || '',
        subtitle: context.secondaryTitle || '',
        seriesTitle: context.primaryTitle || '',
        ...(typeof episodeNumber === 'number' ? {episodeNumber} : {}),
        ...(typeof seasonNumber === 'number' ? {seasonNumber} : {}),
        ...(context.posterUrl
          ? {
              images: [{url: context.posterUrl}],
            }
          : {}),
      },
      customData: {
        headers: normalizedHeaders,
        providerValue: context.providerValue || '',
        infoUrl: context.infoUrl || '',
        episodeLink: source.episode.link,
        episodeTitle: source.episode.title || '',
        episodeNumber,
        seasonNumber,
      },
    },
  };
};

export const prepareNativeCastQueue = async ({
  currentEpisodeLink,
  episodeList,
  selectedStream,
  providerValue,
  contentType,
  context = {},
  maxQueueItems = DEFAULT_MAX_QUEUE_ITEMS,
}: PrepareNativeCastQueueInput): Promise<{
  request: MediaLoadRequest;
  itemCount: number;
}> => {
  if (!isHttpUrl(selectedStream?.link)) {
    throw new Error('NO_STREAM_FOR_CAST');
  }

  const normalizedEpisodeList = (Array.isArray(episodeList) ? episodeList : [])
    .filter(episode => episode && episode.link)
    .slice(0, Math.max(1, maxQueueItems));

  if (normalizedEpisodeList.length === 0) {
    normalizedEpisodeList.push({
      link: currentEpisodeLink || selectedStream.link,
      title: context.secondaryTitle || context.primaryTitle || 'Episode',
    });
  }

  if (
    currentEpisodeLink &&
    !normalizedEpisodeList.some(episode => episode.link === currentEpisodeLink)
  ) {
    normalizedEpisodeList.unshift({
      link: currentEpisodeLink,
      title: context.secondaryTitle || context.primaryTitle || 'Episode',
    });
  }

  const currentIndex = Math.max(
    0,
    normalizedEpisodeList.findIndex(episode => episode.link === currentEpisodeLink),
  );
  const preferredServer = selectedStream.server;
  const resolvedStreams = new Map<string, Stream>();
  const streamSeedKey = currentEpisodeLink || normalizedEpisodeList[currentIndex]?.link;
  if (streamSeedKey) {
    resolvedStreams.set(streamSeedKey, selectedStream);
  }

  const queue = normalizedEpisodeList.map((episode, index) => ({
    episode,
    index,
  }));
  let pointer = 0;

  const resolveWorker = async () => {
    while (pointer < queue.length) {
      const currentPointer = pointer;
      pointer += 1;
      const task = queue[currentPointer];
      if (!task?.episode?.link) {
        continue;
      }
      if (resolvedStreams.has(task.episode.link)) {
        continue;
      }

      try {
        const streams = await withTimeout(signal =>
          providerManager.getStream({
            link: task.episode.link,
            type: contentType,
            signal,
            providerValue,
          }),
        );
        const best = pickBestStream(Array.isArray(streams) ? streams : [], preferredServer);
        if (best) {
          resolvedStreams.set(task.episode.link, best);
        }
      } catch (error) {
        console.warn('[cast] episode stream resolve failed', {
          link: task.episode.link,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  const workers = Array.from({
    length: Math.min(DEFAULT_QUEUE_CONCURRENCY, queue.length),
  }).map(() => resolveWorker());

  await Promise.all(workers);

  const queueSources: QueueSource[] = normalizedEpisodeList
    .map(episode => ({
      episode,
      stream: resolvedStreams.get(episode.link) as Stream | undefined,
    }))
    .filter(item => !!item.stream && isHttpUrl(item.stream.link)) as QueueSource[];

  if (queueSources.length === 0) {
    throw new Error('CAST_QUEUE_EMPTY');
  }

  const resolvedStartIndex = Math.max(
    0,
    queueSources.findIndex(item => item.episode.link === currentEpisodeLink),
  );

  const items = queueSources.map(source =>
    buildQueueItem(source, {
      ...context,
      providerValue,
    }),
  );
  const safePlaybackRate = Number(context.playbackRate || 1);
  const playbackRate =
    Number.isFinite(safePlaybackRate) && safePlaybackRate > 0
      ? Math.min(2, Math.max(0.5, safePlaybackRate))
      : 1;
  const startTime = Math.max(0, Number(context.startTime || 0));

  return {
    itemCount: items.length,
    request: {
      autoplay: true,
      playbackRate,
      startTime,
      queueData: {
        name: context.primaryTitle || 'Vega',
        startIndex: resolvedStartIndex,
        startTime,
        items,
      },
    },
  };
};

export const resolveCastSubtitleUri = (
  subtitles: Array<{uri?: string}>,
  selectedIndex?: number,
): string | undefined => {
  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return undefined;
  }
  if (typeof selectedIndex === 'number' && selectedIndex >= 0) {
    const selected = subtitles[selectedIndex];
    if (selected?.uri && isHttpUrl(selected.uri)) {
      return selected.uri;
    }
  }
  const first = subtitles.find(item => isHttpUrl(item?.uri));
  return first?.uri;
};

export const prepareVegaCastSession = async ({
  currentEpisodeLink,
  episodeList,
  selectedStream,
  providerValue,
  contentType,
  context = {},
  maxQueueItems = DEFAULT_MAX_QUEUE_ITEMS,
}: PrepareVegaCastSessionInput): Promise<VegaCastSessionPayload> => {
  const {request} = await prepareNativeCastQueue({
    currentEpisodeLink,
    episodeList,
    selectedStream,
    providerValue,
    contentType,
    context,
    maxQueueItems,
  });

  const queueData = request.queueData;
  const queueItems = Array.isArray(queueData?.items) ? queueData.items : [];
  const startIndex = Math.max(0, Number(queueData?.startIndex || 0));
  const startTime = Math.max(0, Number(request.startTime || queueData?.startTime || 0));
  const safePlaybackRate = Number(request.playbackRate || context.playbackRate || 1);
  const playbackRate =
    Number.isFinite(safePlaybackRate) && safePlaybackRate > 0
      ? Math.min(2, Math.max(0.5, safePlaybackRate))
      : 1;

  const items: VegaCastSessionItem[] = queueItems
    .map(item => {
      const mediaInfo = item?.mediaInfo;
      if (!mediaInfo || !isHttpUrl(mediaInfo.contentUrl)) {
        return null;
      }

      const customData = mediaInfo.customData || {};
      const metadata = mediaInfo.metadata || {};
      const subtitles: VegaCastSessionSubtitle[] = Array.isArray(mediaInfo.mediaTracks)
        ? mediaInfo.mediaTracks
            .filter(track => track?.type === 'text' && isHttpUrl(track?.contentId))
            .map(track => ({
              uri: String(track.contentId),
              title: String(track.name || track.language || ''),
              language: String(track.language || 'it'),
              type: String(track.contentType || 'text/vtt'),
            }))
        : [];

      return {
        episodeLink: String(customData.episodeLink || ''),
        episodeTitle: String(
          customData.episodeTitle || metadata.title || metadata.subtitle || '',
        ),
        streamUrl: String(mediaInfo.contentUrl),
        contentType: String(mediaInfo.contentType || ''),
        headers: normalizeHeaders(
          customData.headers && typeof customData.headers === 'object'
            ? customData.headers
            : undefined,
        ),
        subtitles,
        ...(typeof customData.episodeNumber === 'number'
          ? {episodeNumber: customData.episodeNumber}
          : {}),
        ...(typeof customData.seasonNumber === 'number'
          ? {seasonNumber: customData.seasonNumber}
          : {}),
      };
    })
    .filter((item): item is VegaCastSessionItem => !!item);

  if (items.length === 0) {
    throw new Error('VEGA_CAST_SESSION_EMPTY');
  }

  return {
    version: 1,
    createdAt: Date.now(),
    providerValue,
    ...(context.infoUrl ? {infoUrl: context.infoUrl} : {}),
    ...(context.primaryTitle ? {primaryTitle: context.primaryTitle} : {}),
    ...(context.secondaryTitle ? {secondaryTitle: context.secondaryTitle} : {}),
    ...(context.posterUrl ? {posterUrl: context.posterUrl} : {}),
    playbackRate,
    queue: {
      startIndex: Math.min(startIndex, Math.max(0, items.length - 1)),
      startTime,
      items,
    },
  };
};
