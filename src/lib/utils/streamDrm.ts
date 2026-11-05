import {Buffer} from 'buffer';
import type {DRMType, Drm} from 'react-native-video';
import type {Stream, StreamDrm} from '../providers/types';

// These extra properties are handled by the versioned react-native-video patch.
export type PlayerDrm = {-readonly [K in keyof Drm]: Drm[K]} & {
  clearKeyResponse?: string;
  keyRequestParameters?: Record<string, string>;
};

export const DRM_START_TIMEOUT_MS = 60000;
export const DRM_INVALID = 'Invalid DRM configuration';
export const DRM_UNSUPPORTED = 'This DRM is not supported on this device';
export const DRM_PLAYER_ONLY =
  'Protected streams can only be played in the app';

const fail = (): never => {
  // Never include configuration values (keys, credentials or URLs) in errors.
  throw new Error(DRM_INVALID);
};

const httpUrl = (value: unknown): string => {
  if (typeof value !== 'string' || !/^https?:\/\/[^\s]+$/i.test(value)) {
    return fail();
  }
  return value;
};

const stringMap = (value: unknown): Record<string, string> | undefined => {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return fail();
  }
  const entries = Object.entries(value);
  if (
    entries.length > 64 ||
    entries.some(
      ([k, v]) =>
        !k || /[\r\n]/.test(k) || typeof v !== 'string' || /[\r\n]/.test(v),
    )
  ) {
    return fail();
  }
  return Object.fromEntries(entries);
};

const keyBytes = (value: unknown): string => {
  if (typeof value !== 'string') {
    return fail();
  }
  const hex = value.replace(/-/g, '');
  let bytes: Buffer;
  if (/^[a-f\d]{32}$/i.test(hex)) {
    bytes = Buffer.from(hex, 'hex');
  } else {
    if (!/^[A-Za-z\d+/_-]{22}(==)?$/.test(value)) {
      return fail();
    }
    bytes = Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  }
  if (bytes.length !== 16) {
    return fail();
  }
  return bytes
    .toString('base64')
    .replace(/[=]/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

/** Pure conversion: provider data stays in memory and license headers stay separate. */
export const getPlayerDrm = (
  drm: StreamDrm | undefined,
  platform: string,
): PlayerDrm | undefined => {
  if (drm == null) {
    return undefined;
  }
  if (
    typeof drm !== 'object' ||
    !['widevine', 'playready', 'clearkey', 'fairplay'].includes(drm.type)
  ) {
    return fail();
  }
  if (
    (platform === 'android' && drm.type === 'fairplay') ||
    (platform === 'ios' && drm.type !== 'fairplay') ||
    !['android', 'ios'].includes(platform)
  ) {
    throw new Error(DRM_UNSUPPORTED);
  }
  const localKeys = drm.clearKeys;
  if (
    localKeys != null &&
    (drm.type !== 'clearkey' ||
      !Array.isArray(localKeys) ||
      !localKeys.length ||
      localKeys.length > 64)
  ) {
    return fail();
  }
  const result: PlayerDrm = {
    type: drm.type as DRMType,
    headers: stringMap(drm.licenseHeaders),
    keyRequestParameters: stringMap(drm.keyRequestParameters),
    multiDrm: drm.multiSession ?? drm.type !== 'clearkey',
  };
  if (localKeys) {
    if (drm.licenseUrl) {
      return fail();
    }
    result.clearKeyResponse = JSON.stringify({
      keys: localKeys.map(pair => ({
        kty: 'oct',
        kid: keyBytes(pair?.kid),
        k: keyBytes(pair?.key),
      })),
      type: 'temporary',
    });
  } else {
    result.licenseServer = httpUrl(drm.licenseUrl);
  }
  if (drm.type === 'fairplay') {
    result.certificateUrl = httpUrl(drm.certificateUrl);
    result.contentId = drm.contentId;
    result.base64Certificate = drm.base64Certificate;
  }
  return result;
};

export const getStreamVideoType = (stream: Stream): string | undefined => {
  const type = stream.type?.toLowerCase();
  if (['dash', 'mpd', 'application/dash+xml'].includes(type)) {
    return 'mpd';
  }
  if (
    [
      'm3u8',
      'hls',
      'application/x-mpegurl',
      'application/vnd.apple.mpegurl',
    ].includes(type)
  ) {
    return 'm3u8';
  }
  return undefined;
};

export const assertUnprotectedStream = (stream: {drm?: unknown}) => {
  if (stream.drm != null) {
    throw new Error(DRM_PLAYER_ONLY);
  }
};
