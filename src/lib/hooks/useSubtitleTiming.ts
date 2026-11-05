import {useCallback, useEffect, useState} from 'react';
import {MAX_SUBTITLE_DELAY_MS} from '../utils/subtitleTiming';

/** Session-only offsets. A new content identity invalidates values synchronously. */
export function useSubtitleTiming(contentKey: string, trackKey: string | null) {
  const [state, setState] = useState<{
    content: string;
    offsets: Record<string, number>;
  }>({content: contentKey, offsets: {}});

  useEffect(() => {
    setState({content: contentKey, offsets: {}});
  }, [contentKey]);

  const delayMs =
    trackKey && state.content === contentKey ? state.offsets[trackKey] || 0 : 0;
  const apply = useCallback(
    (value: number) => {
      if (
        !trackKey ||
        !Number.isFinite(value) ||
        Math.abs(value) > MAX_SUBTITLE_DELAY_MS
      ) {
        return;
      }
      setState(previous => ({
        content: contentKey,
        offsets: {
          ...(previous.content === contentKey ? previous.offsets : {}),
          [trackKey]: Math.round(value),
        },
      }));
    },
    [contentKey, trackKey],
  );

  return {delayMs, apply};
}
