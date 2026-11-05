import {Dispatch, SetStateAction, useCallback, useRef, useState} from 'react';

/** Native events queued before a local play/pause command must not undo it. */
export function usePlaybackPauseState(
  initial: boolean,
  acknowledgeNative: boolean,
) {
  const [paused, setState] = useState(initial);
  const current = useRef(initial);
  const pending = useRef<boolean | null>(null);
  const setPaused = useCallback<Dispatch<SetStateAction<boolean>>>(
    value => {
      const next = typeof value === 'function' ? value(current.current) : value;
      if (next === current.current) {
        return;
      }
      current.current = next;
      if (acknowledgeNative) {
        pending.current = next;
      }
      setState(next);
    },
    [acknowledgeNative],
  );
  const receiveNativePaused = useCallback((value: boolean) => {
    if (pending.current !== null && value !== pending.current) {
      return;
    }
    pending.current = null;
    current.current = value;
    setState(value);
  }, []);
  return {paused, setPaused, receiveNativePaused};
}
