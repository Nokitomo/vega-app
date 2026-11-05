import type {PlayerTrackLike} from '../services/playerTrackSelection';

export const MAX_SUBTITLE_DELAY_MS = 600_000;

export function parseSubtitleDelay(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    return null;
  }
  const ms = Math.round(Number(normalized) * 1000);
  return Number.isFinite(ms) && Math.abs(ms) <= MAX_SUBTITLE_DELAY_MS
    ? ms
    : null;
}

/** External identities survive native group reordering; embedded IDs are stream-scoped. */
export function subtitleTimingKey(
  track: PlayerTrackLike | undefined,
  streamKey: string,
): string | null {
  if (!track) {
    return null;
  }
  return track.uri
    ? JSON.stringify(['external', track.uri])
    : JSON.stringify(['internal', streamKey, track.sourceId, track.index]);
}
