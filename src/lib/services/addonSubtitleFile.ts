import * as FileSystem from 'expo-file-system/legacy';
import type {TextTrackType} from 'react-native-video';
import i18n from '../../i18n';
import {publicHttpsUrl} from './stremioAddons';

export function identifySubtitleFormat(text: string): {
  extension: string;
  type: TextTrackType;
} {
  const body = text.trimStart();
  if (body.startsWith('WEBVTT')) {
    return {extension: 'vtt', type: 'text/vtt' as TextTrackType};
  }
  if (/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(body) && !/<html/i.test(body)) {
    return {extension: 'srt', type: 'application/x-subrip' as TextTrackType};
  }
  if (/^\[Script Info\]/i.test(body)) {
    return {extension: 'ass', type: 'text/x-ssa' as TextTrackType};
  }
  if (/<tt(?:\s|>)/.test(body)) {
    return {extension: 'ttml', type: 'application/ttml+xml' as TextTrackType};
  }
  throw new Error(i18n.t('addon.invalidSubtitle'));
}

export async function downloadAddonSubtitle(
  input: string,
  signal?: AbortSignal,
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) {
    abort();
  }
  signal?.addEventListener('abort', abort);
  const timer = setTimeout(abort, 20000);
  try {
    const response = await fetch(publicHttpsUrl(input), {
      signal: controller.signal,
    });
    if (
      !response.ok ||
      Number(response.headers.get('content-length')) > 4000000
    ) {
      throw new Error();
    }
    const text = await response.text();
    if (text.length > 4000000 || controller.signal.aborted) {
      throw new Error();
    }
    const format = identifySubtitleFormat(text);
    if (!FileSystem.cacheDirectory) {
      throw new Error();
    }
    const folder = `${FileSystem.cacheDirectory}stremio-subtitles/`;
    await FileSystem.makeDirectoryAsync(folder, {intermediates: true});
    // Only our temporary files are eligible for cleanup; retain recent player sessions.
    const entries = await FileSystem.readDirectoryAsync(folder);
    await Promise.all(
      entries
        .filter(
          name =>
            /^\d+-[a-z0-9]+\.(srt|vtt|ass|ttml)$/.test(name) &&
            Number(name.split('-')[0]) < Date.now() - 86400000,
        )
        .map(name => FileSystem.deleteAsync(folder + name, {idempotent: true})),
    );
    const uri = `${folder}${Date.now()}-${Math.random().toString(36).slice(2)}.${format.extension}`;
    await FileSystem.writeAsStringAsync(uri, text);
    if (controller.signal.aborted) {
      await FileSystem.deleteAsync(uri, {idempotent: true});
      throw new Error();
    }
    return {uri, type: format.type};
  } catch {
    throw new Error(i18n.t('addon.downloadFailed'));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
