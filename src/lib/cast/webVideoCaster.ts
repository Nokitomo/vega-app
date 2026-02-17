import {Linking, Platform} from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

const WVC_ANDROID_PACKAGE = 'com.instantbits.cast.webvideo';
const WVC_ANDROID_MARKET_URL = `market://details?id=${WVC_ANDROID_PACKAGE}`;
const WVC_ANDROID_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${WVC_ANDROID_PACKAGE}`;
const WVC_IOS_APP_STORE_URL =
  'https://itunes.apple.com/us/app/web-video-caster/id1400866497';

type HeadersMap = Record<string, string>;

export type WvcSubtitleTrack = {
  uri?: string;
  title?: string;
};

export type OpenWebVideoCasterOptions = {
  videoUrl: string;
  headers?: HeadersMap;
  subtitles?: WvcSubtitleTrack[];
  title?: string;
  subtitle?: string;
  poster?: string;
  secureUri?: boolean;
};

export type OpenWebVideoCasterResult = 'opened' | 'store_opened' | 'failed';

const isHttpUrl = (value?: string): value is string =>
  !!value && /^https?:\/\//i.test(value.trim());

const normalizeHeaders = (headers?: HeadersMap): HeadersMap => {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  return Object.entries(headers).reduce<HeadersMap>((acc, [key, value]) => {
    if (!key || value == null) {
      return acc;
    }
    const normalizedKey = String(key).trim();
    const normalizedValue = String(value).trim();
    if (!normalizedKey || !normalizedValue) {
      return acc;
    }
    acc[normalizedKey] = normalizedValue;
    return acc;
  }, {});
};

const getRemoteSubtitleUris = (subtitles?: WvcSubtitleTrack[]): string[] => {
  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return [];
  }

  return subtitles
    .map(track => (typeof track?.uri === 'string' ? track.uri.trim() : ''))
    .filter(uri => isHttpUrl(uri));
};

const flattenHeadersForIntent = (headers: HeadersMap): string[] => {
  const values: string[] = [];
  Object.entries(headers).forEach(([key, value]) => {
    values.push(key, value);
  });
  return values;
};

const buildIosCallbackUrl = ({
  videoUrl,
  headers,
  secureUri,
}: {
  videoUrl: string;
  headers: HeadersMap;
  secureUri: boolean;
}): string => {
  const params = [`url=${encodeURIComponent(videoUrl)}`];

  Object.entries(headers).forEach(([key, value]) => {
    params.push(`header=${encodeURIComponent(`${key}: ${value}`)}`);
  });

  if (secureUri) {
    params.push('secure_uri=true');
  }

  return `wvc-x-callback://open?${params.join('&')}`;
};

const openAndroidStore = async (): Promise<boolean> => {
  try {
    await Linking.openURL(WVC_ANDROID_MARKET_URL);
    return true;
  } catch (_error) {
    try {
      await Linking.openURL(WVC_ANDROID_PLAY_STORE_URL);
      return true;
    } catch (_fallbackError) {
      return false;
    }
  }
};

const openIosStore = async (): Promise<boolean> => {
  try {
    await Linking.openURL(WVC_IOS_APP_STORE_URL);
    return true;
  } catch (_error) {
    return false;
  }
};

const buildAndroidExtras = ({
  headers,
  subtitles,
  title,
  subtitle,
  poster,
  secureUri,
}: Omit<OpenWebVideoCasterOptions, 'videoUrl'>): Record<string, any> => {
  const extras: Record<string, any> = {};
  const normalizedHeaders = normalizeHeaders(headers);
  const subtitleUris = getRemoteSubtitleUris(subtitles);

  if (title) {
    extras.title = title;
  }
  if (subtitle) {
    extras.subtitle = subtitle;
  }
  if (poster) {
    extras.poster = poster;
  }
  if (secureUri) {
    extras.secure_uri = true;
  }
  if (subtitleUris.length > 0) {
    extras.subtitle = subtitleUris[0];
    extras.subs = subtitleUris;
  }
  if (Object.keys(normalizedHeaders).length > 0) {
    extras['android.media.intent.extra.HTTP_HEADERS'] = normalizedHeaders;
    extras.headers = flattenHeadersForIntent(normalizedHeaders);
  }

  return extras;
};

export const openInWebVideoCaster = async (
  options: OpenWebVideoCasterOptions,
): Promise<OpenWebVideoCasterResult> => {
  const streamUrl = options.videoUrl?.trim();
  if (!isHttpUrl(streamUrl)) {
    return 'failed';
  }

  const secureUri = options.secureUri ?? true;
  const normalizedHeaders = normalizeHeaders(options.headers);

  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: streamUrl,
        type: 'video/*',
        packageName: WVC_ANDROID_PACKAGE,
        extra: buildAndroidExtras({
          headers: normalizedHeaders,
          subtitles: options.subtitles,
          title: options.title,
          subtitle: options.subtitle,
          poster: options.poster,
          secureUri,
        }),
      });
      return 'opened';
    } catch (error) {
      console.warn('Failed to open Web Video Caster on Android:', error);
      const storeOpened = await openAndroidStore();
      return storeOpened ? 'store_opened' : 'failed';
    }
  }

  if (Platform.OS === 'ios') {
    try {
      const callbackUrl = buildIosCallbackUrl({
        videoUrl: streamUrl,
        headers: normalizedHeaders,
        secureUri,
      });
      await Linking.openURL(callbackUrl);
      return 'opened';
    } catch (error) {
      console.warn('Failed to open Web Video Caster on iOS:', error);
      const storeOpened = await openIosStore();
      return storeOpened ? 'store_opened' : 'failed';
    }
  }

  return 'failed';
};
