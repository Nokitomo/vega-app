import Constants from 'expo-constants';
import {Buffer} from 'buffer';
import {Linking} from 'react-native';
import {
  PrepareVegaCastSessionInput,
  VegaCastSessionPayload,
  prepareVegaCastSession,
} from './nativeCast';

const DEFAULT_VEGA_CAST_RECEIVER_URL =
  'https://nokitomo.github.io/vega-cast-receiver/';
const VEGA_CAST_SESSION_QUERY_KEY = 'vegaSession';
const VEGA_CAST_PAIR_CODE_QUERY_KEY = 'vegaCode';
const VEGA_CAST_PAIR_API_QUERY_KEY = 'vegaApi';
const VEGA_CAST_MAX_URL_LENGTH = 7500;
const VEGA_CAST_PAIR_TTL_SECONDS = 600;
const VEGA_CAST_PAIR_REQUEST_TIMEOUT_MS = 12000;

type VegaCastLaunchMode = 'pairing' | 'inline';

export type VegaCastTracking = {
  sessionId: string;
  progressToken: string;
  apiBaseUrl: string;
};

export type VegaCastProgressSnapshot = {
  sessionId: string;
  infoUrl?: string;
  primaryTitle?: string;
  secondaryTitle?: string;
  providerValue?: string;
  episodeLink?: string;
  episodeTitle?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  queueIndex?: number;
  currentTime?: number;
  duration?: number;
  playbackRate?: number;
  isEnded?: boolean;
  updatedAt?: number;
};

const normalizeApiBaseUrl = (value: string): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\/+$/, '');
};

const normalizeReceiverUrl = (value: string): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return DEFAULT_VEGA_CAST_RECEIVER_URL;
  }
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
};

const getReceiverUrlFromConfig = (): string => {
  const configured = Constants?.expoConfig?.extra?.castReceiverWebUrl || '';
  return normalizeReceiverUrl(configured);
};

const getPairApiBaseUrlFromConfig = (): string => {
  const configured = Constants?.expoConfig?.extra?.castPairApiBaseUrl || '';
  return normalizeApiBaseUrl(configured);
};

const encodeSession = (session: VegaCastSessionPayload): string => {
  const raw = JSON.stringify(session);
  const base64 = Buffer.from(raw, 'utf8').toString('base64');
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(new RegExp('=+$'), '');
};

const hashString = (value: string): number => {
  const MOD = 2147483647;
  let hash = 17;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % MOD;
  }
  return hash;
};

const createRandomToken = (bytes = 12): string =>
  Buffer.from(
    Array.from({length: bytes}, () => Math.floor(Math.random() * 256)),
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(new RegExp('/', 'g'), '_')
    .replace(new RegExp('=+$'), '');

const buildTelemetryTracking = (
  pairApiBaseUrl: string,
): VegaCastTracking => ({
  sessionId: `vega_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  progressToken: createRandomToken(18),
  apiBaseUrl: pairApiBaseUrl,
});

export const buildVegaCastSessionCode = (
  session: VegaCastSessionPayload,
): string => {
  const encoded = encodeSession(session);
  const hash = hashString(encoded).toString(36).toUpperCase();
  return hash.slice(-6).padStart(6, '0');
};

const buildVegaCastReceiverUrlWithCode = (
  code: string,
  pairApiBaseUrl: string,
): string => {
  const baseUrl = getReceiverUrlFromConfig();

  try {
    const url = new URL(baseUrl);
    url.searchParams.set(VEGA_CAST_PAIR_CODE_QUERY_KEY, code);
    if (pairApiBaseUrl) {
      url.searchParams.set(VEGA_CAST_PAIR_API_QUERY_KEY, pairApiBaseUrl);
    }
    return url.toString();
  } catch (_error) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const encodedCode = encodeURIComponent(code);
    const encodedApi = encodeURIComponent(pairApiBaseUrl);
    if (pairApiBaseUrl) {
      return `${baseUrl}${separator}${VEGA_CAST_PAIR_CODE_QUERY_KEY}=${encodedCode}&${VEGA_CAST_PAIR_API_QUERY_KEY}=${encodedApi}`;
    }
    return `${baseUrl}${separator}${VEGA_CAST_PAIR_CODE_QUERY_KEY}=${encodedCode}`;
  }
};

export const buildVegaCastReceiverUrl = (
  session: VegaCastSessionPayload,
): string => {
  const baseUrl = getReceiverUrlFromConfig();
  const encoded = encodeSession(session);
  const separator = baseUrl.includes('?') ? '&' : '?';
  const url = `${baseUrl}${separator}${VEGA_CAST_SESSION_QUERY_KEY}=${encodeURIComponent(encoded)}`;
  if (url.length > VEGA_CAST_MAX_URL_LENGTH) {
    throw new Error('VEGA_CAST_SESSION_TOO_LARGE');
  }
  return url;
};

const postJsonWithTimeout = async (
  url: string,
  body: Record<string, unknown>,
): Promise<{status: number; payload: any}> => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    VEGA_CAST_PAIR_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    return {
      status: response.status,
      payload,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const createPairingSession = async (
  session: VegaCastSessionPayload,
  pairApiBaseUrl: string,
): Promise<{code: string; expiresAt: number; sessionId?: string}> => {
  const endpoint = `${pairApiBaseUrl}/api/session`;
  const {status, payload} = await postJsonWithTimeout(endpoint, {
    session,
    ttlSeconds: VEGA_CAST_PAIR_TTL_SECONDS,
  });

  if (
    status === 200 &&
    payload?.ok === true &&
    typeof payload.code === 'string' &&
    typeof payload.expiresAt === 'number'
  ) {
    return {
      code: payload.code.toUpperCase(),
      expiresAt: payload.expiresAt,
      sessionId:
        typeof payload.sessionId === 'string' ? payload.sessionId : undefined,
    };
  }

  const apiError = String(payload?.error || '').trim();
  if (apiError === 'SESSION_PAYLOAD_TOO_LARGE') {
    throw new Error('VEGA_CAST_SESSION_TOO_LARGE');
  }

  throw new Error('VEGA_CAST_PAIRING_FAILED');
};

export const openVegaCastReceiverUrl = async (
  url: string,
): Promise<boolean> => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      return false;
    }
    await Linking.openURL(url);
    return true;
  } catch (error) {
    console.warn('Failed to open Vega Cast receiver URL:', error);
    return false;
  }
};

export const prepareVegaCastLaunchData = async (
  input: PrepareVegaCastSessionInput,
): Promise<{
  session: VegaCastSessionPayload;
  receiverUrl: string;
  sessionCode: string;
  launchMode: VegaCastLaunchMode;
  tracking?: VegaCastTracking;
  expiresAt?: number;
}> => {
  const pairApiBaseUrl = getPairApiBaseUrlFromConfig();
  const telemetry = pairApiBaseUrl
    ? buildTelemetryTracking(pairApiBaseUrl)
    : undefined;

  const session = await prepareVegaCastSession({
    ...input,
    context: {
      ...input.context,
      ...(telemetry ? {telemetry} : {}),
    },
  });

  if (pairApiBaseUrl) {
    try {
      const paired = await createPairingSession(session, pairApiBaseUrl);
      const tracking = {
        ...telemetry!,
        ...(paired.sessionId ? {sessionId: paired.sessionId} : {}),
      };
      return {
        session,
        receiverUrl: buildVegaCastReceiverUrlWithCode(
          paired.code,
          pairApiBaseUrl,
        ),
        sessionCode: paired.code,
        launchMode: 'pairing',
        tracking,
        expiresAt: paired.expiresAt,
      };
    } catch (error) {
      console.warn('Vega Cast pairing API failed, fallback to inline URL:', error);
    }
  }

  const receiverUrl = buildVegaCastReceiverUrl(session);
  const sessionCode = buildVegaCastSessionCode(session);

  return {
    session,
    receiverUrl,
    sessionCode,
    launchMode: 'inline',
  };
};

export const fetchVegaCastProgress = async (
  tracking: VegaCastTracking,
): Promise<VegaCastProgressSnapshot | null> => {
  if (!tracking?.apiBaseUrl || !tracking?.sessionId || !tracking?.progressToken) {
    return null;
  }

  const endpoint = `${normalizeApiBaseUrl(tracking.apiBaseUrl)}/api/session/progress/get`;
  const {status, payload} = await postJsonWithTimeout(endpoint, {
    sessionId: tracking.sessionId,
    progressToken: tracking.progressToken,
  });

  if (status !== 200 || payload?.ok !== true || !payload?.progress) {
    return null;
  }

  return payload.progress as VegaCastProgressSnapshot;
};
