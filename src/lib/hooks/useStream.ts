import {useQuery} from '@tanstack/react-query';
import {useState, useEffect} from 'react';
import {ToastAndroid} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {providerManager} from '../services/ProviderManager';
import {settingsStorage} from '../storage';
import {ifExists} from '../file/ifExists';
import {Stream} from '../providers/types';
import i18n from '../../i18n';

interface UseStreamOptions {
  activeEpisode: any;
  routeParams: any;
  provider: string;
  enabled?: boolean;
}

type SubtitleTrack = {
  title?: string;
  language?: string;
  type?: string;
  uri?: string;
  headers?: Record<string, string>;
};

const SUBTITLE_CACHE_DIR = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}subtitles/`
  : null;

const ensureSubtitleCacheDir = async (): Promise<string | null> => {
  if (!SUBTITLE_CACHE_DIR) {
    console.log('[subs] cache directory not available');
    return null;
  }
  const info = await FileSystem.getInfoAsync(SUBTITLE_CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SUBTITLE_CACHE_DIR, {
      intermediates: true,
    });
    console.log('[subs] created cache directory', SUBTITLE_CACHE_DIR);
  } else {
    console.log('[subs] cache directory exists', SUBTITLE_CACHE_DIR);
  }
  return SUBTITLE_CACHE_DIR;
};

const isRemoteSubtitleUri = (uri: string): boolean => {
  return /^https?:\/\//i.test(uri);
};

const extractSubtitleExtension = (uri: string): string => {
  const clean = uri.split('?')[0]?.split('#')[0] || '';
  const match = clean.match(/\.(vtt|srt|ttml)$/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return 'vtt';
};

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 4294967296;
  }
  return Math.abs(hash).toString(16);
};

const getFileInfoSize = (
  info: Awaited<ReturnType<typeof FileSystem.getInfoAsync>>,
): number => {
  if (!('size' in info)) {
    return 0;
  }
  const size = info.size;
  return typeof size === 'number' && Number.isFinite(size) ? size : 0;
};

const normalizeSubtitleHeaders = (
  headers?: Record<string, string>,
): Record<string, string> | undefined => {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }
  const entries = Object.entries(headers).filter(
    ([key, value]) => key && value != null && value !== '',
  );
  if (entries.length === 0) {
    return undefined;
  }
  return entries.reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = String(value);
    return acc;
  }, {});
};

const resolveSubtitleTrack = async (
  track: SubtitleTrack,
  cacheDir: string | null,
): Promise<SubtitleTrack> => {
  const uri = typeof track.uri === 'string' ? track.uri.trim() : '';
  console.log('[subs] track input', {
    title: track.title,
    language: track.language,
    type: track.type,
    uri,
    hasHeaders: !!track.headers,
  });
  if (!uri || !isRemoteSubtitleUri(uri)) {
    console.log('[subs] non-remote subtitle uri, skip download', uri);
    return {...track, headers: undefined};
  }
  if (!cacheDir) {
    console.log('[subs] no cache directory, using remote uri', uri);
    return {...track, headers: undefined};
  }

  const extension = extractSubtitleExtension(uri);
  const fileName = `${hashString(uri)}.${extension}`;
  const fileUri = `${cacheDir}${fileName}`;
  const headers = normalizeSubtitleHeaders(track.headers);
  console.log('[subs] resolved cache target', {fileUri, extension});

  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    const infoSize = getFileInfoSize(info);
    console.log('[subs] cache info', {exists: info.exists, size: infoSize});
    if (!info.exists || infoSize <= 0) {
      console.log('[subs] downloading subtitle', {
        from: uri,
        to: fileUri,
        hasHeaders: !!headers,
      });
      await FileSystem.downloadAsync(uri, fileUri, {
        headers,
      });
      const downloadedInfo = await FileSystem.getInfoAsync(fileUri);
      const downloadedSize = getFileInfoSize(downloadedInfo);
      console.log('[subs] download result', {
        exists: downloadedInfo.exists,
        size: downloadedSize,
      });
    }
    return {
      ...track,
      uri: fileUri,
      headers: undefined,
    };
  } catch (error) {
    console.log('[subs] download failed', {
      uri,
      message: error instanceof Error ? error.message : String(error),
    });
    return {...track, headers: undefined};
  }
};

const resolveExternalSubtitles = async (
  tracks: SubtitleTrack[],
): Promise<SubtitleTrack[]> => {
  if (!tracks || tracks.length === 0) {
    console.log('[subs] no external subtitles to resolve');
    return [];
  }
  console.log('[subs] resolving external subtitles', {count: tracks.length});
  const cacheDir = await ensureSubtitleCacheDir();
  const resolvedCache = new Map<string, Promise<SubtitleTrack>>();

  const resolveWithCache = (track: SubtitleTrack): Promise<SubtitleTrack> => {
    const uri = typeof track.uri === 'string' ? track.uri.trim() : '';
    const key = uri ? `uri:${uri}` : `track:${Math.random()}`;
    if (!resolvedCache.has(key)) {
      resolvedCache.set(key, resolveSubtitleTrack(track, cacheDir));
    }
    return resolvedCache.get(key) as Promise<SubtitleTrack>;
  };

  const resolved = await Promise.all(tracks.map(resolveWithCache));
  console.log('[subs] resolved external subtitles', {
    count: resolved.length,
  });
  return resolved.map(track => ({
    title: track.title,
    language: track.language,
    type: track.type,
    uri: track.uri,
  }));
};

export const useStream = ({
  activeEpisode,
  routeParams,
  provider,
  enabled = true,
}: UseStreamOptions) => {
  const [selectedStream, setSelectedStream] = useState<Stream>({
    server: '',
    link: '',
    type: '',
  });
  const [externalSubs, setExternalSubs] = useState<any[]>([]);

  const {
    data: streamData = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Stream[], Error>({
    queryKey: ['stream', activeEpisode?.link, routeParams?.type, provider],
    queryFn: async () => {
      if (!activeEpisode?.link) {
        return [];
      }

      console.log('Fetching stream for:', activeEpisode);

      // Handle direct URL (downloaded content)
      if (routeParams?.directUrl) {
        return [
          {
            server: i18n.t('Downloaded'),
            link: routeParams.directUrl,
            type: 'mp4',
          },
        ];
      }

      // Check for local downloaded file
      if (routeParams?.primaryTitle && routeParams?.secondaryTitle) {
        const file = (
          routeParams.primaryTitle +
          routeParams.secondaryTitle +
          activeEpisode.title
        ).replaceAll(/[^a-zA-Z0-9]/g, '_');

        const exists = await ifExists(file);
        if (exists) {
          return [
            {
              server: i18n.t('Downloaded'),
              link: exists,
              type: 'mp4',
            },
          ];
        }
      }

      // Fetch streams from provider
      const controller = new AbortController();
      const data = await providerManager.getStream({
        link: activeEpisode.link,
        type: routeParams?.type,
        signal: controller.signal,
        providerValue: routeParams?.providerValue || provider,
      });

      // Filter out excluded qualities
      const excludedQualities = settingsStorage.getExcludedQualities() || [];
      const filteredQualities = data?.filter(
        streamItem => !excludedQualities.includes(streamItem?.quality + 'p'),
      );

      const filteredData =
        filteredQualities?.length > 0 ? filteredQualities : data;

      if (!filteredData || filteredData.length === 0) {
        throw new Error(i18n.t('No Streams Available'));
      }

      return filteredData;
    },
    enabled: enabled && !!activeEpisode?.link,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: (failureCount, _error) => {
      if (failureCount >= 2) {
        return false;
      }
      return true;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Update selected stream when data changes
  useEffect(() => {
    let isActive = true;

    const updateStreams = async () => {
      if (streamData && streamData.length > 0) {
        setSelectedStream(streamData[0]);

        // Extract external subtitles (preserve stream headers for protected files)
        const subs: SubtitleTrack[] = [];
        streamData.forEach(stream => {
          if (stream?.subtitles?.length && stream.subtitles.length > 0) {
            stream.subtitles.forEach(track => {
              subs.push({
                ...track,
                headers:
                  stream.headers && typeof stream.headers === 'object'
                    ? stream.headers
                    : undefined,
              });
            });
          }
        });
        console.log('[subs] extracted subtitles from streams', {
          streams: streamData.length,
          subtitles: subs.length,
        });

        const resolvedSubs = await resolveExternalSubtitles(subs);
        if (isActive) {
          setExternalSubs(resolvedSubs);
        }
        return;
      }

      if (isActive) {
        setExternalSubs([]);
      }
    };

    updateStreams().catch(() => {
      if (isActive) {
        setExternalSubs([]);
      }
    });

    return () => {
      isActive = false;
    };
  }, [streamData]);

  // Handle errors
  useEffect(() => {
    if (error) {
      console.error('Stream fetch error:', error);
      ToastAndroid.show(
        i18n.t('No stream found, try again later'),
        ToastAndroid.SHORT,
      );
    }
  }, [error]);

  const switchToNextStream = () => {
    if (streamData && streamData.length > 0) {
      const currentIndex = streamData.indexOf(selectedStream);
      if (currentIndex < streamData.length - 1) {
        setSelectedStream(streamData[currentIndex + 1]);
        ToastAndroid.show(
          i18n.t('Video could not be played, Trying next server'),
          ToastAndroid.SHORT,
        );
        return true;
      }
    }
    return false;
  };

  return {
    streamData,
    selectedStream,
    setSelectedStream,
    externalSubs,
    setExternalSubs,
    isLoading,
    error,
    refetch,
    switchToNextStream,
  };
};

// Hook for managing video tracks and settings
export const useVideoSettings = () => {
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [textTracks, setTextTracks] = useState<any[]>([]);
  const [videoTracks, setVideoTracks] = useState<any[]>([]);

  const [selectedAudioTrackIndex, setSelectedAudioTrackIndex] = useState(0);
  const [selectedTextTrackIndex, setSelectedTextTrackIndex] = useState(1000);
  const [selectedQualityIndex, setSelectedQualityIndex] = useState(1000);

  const processAudioTracks = (tracks: any[]) => {
    const uniqueMap = new Map();
    const uniqueTracks = tracks.filter(track => {
      const key = `${track.type}-${track.title}-${track.language}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, true);
        return true;
      }
      return false;
    });
    setAudioTracks(uniqueTracks);
  };

  const processVideoTracks = (tracks: any[]) => {
    const uniqueMap = new Map();
    const uniqueTracks = tracks.filter(track => {
      const key = `${track.bitrate}-${track.height}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, true);
        return true;
      }
      return false;
    });
    setVideoTracks(uniqueTracks);
  };

  return {
    audioTracks,
    textTracks,
    videoTracks,
    selectedAudioTrackIndex,
    selectedTextTrackIndex,
    selectedQualityIndex,
    setAudioTracks,
    setTextTracks,
    setVideoTracks,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
    setSelectedQualityIndex,
    processAudioTracks,
    processVideoTracks,
  };
};
