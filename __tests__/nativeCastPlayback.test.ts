import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import type {MediaStatus, RemoteMediaClient} from 'react-native-google-cast';
import {MediaPlayerIdleReason, MediaPlayerState} from 'react-native-google-cast';
import {observeNativeCastPlayback} from '../src/lib/cast/nativeCastPlayback';

const streamUrl = 'https://example.com/video.m3u8';

const status = (
  playerState: MediaPlayerState,
  idleReason?: MediaPlayerIdleReason,
  contentUrl = streamUrl,
): MediaStatus =>
  ({playerState, idleReason, mediaInfo: {contentUrl}}) as MediaStatus;

describe('native cast playback startup', () => {
  let listener: (value: MediaStatus | null) => void;
  let remove: jest.Mock;
  let client: RemoteMediaClient;

  beforeEach(() => {
    jest.useFakeTimers();
    remove = jest.fn();
    client = {
      onMediaStatusUpdated: jest.fn((handler: (value: MediaStatus | null) => void) => {
        listener = handler;
        return {remove};
      }),
      getMediaStatus: jest.fn(() => Promise.resolve(null)),
    } as unknown as RemoteMediaClient;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a successful native cast without showing fallback', () => {
    const onError = jest.fn();
    observeNativeCastPlayback(client, streamUrl, onError);
    listener(status(MediaPlayerState.BUFFERING));
    listener(status(MediaPlayerState.PLAYING));
    listener(status(MediaPlayerState.IDLE, MediaPlayerIdleReason.ERROR));
    expect(onError).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('offers fallback only for an error on the new stream', () => {
    const onError = jest.fn();
    observeNativeCastPlayback(client, streamUrl, onError);
    listener(status(MediaPlayerState.IDLE, MediaPlayerIdleReason.ERROR, 'https://example.com/old.mp4'));
    listener(status(MediaPlayerState.LOADING));
    listener(status(MediaPlayerState.IDLE, MediaPlayerIdleReason.ERROR));
    listener(status(MediaPlayerState.IDLE, MediaPlayerIdleReason.ERROR));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('stops watching after the startup window', () => {
    const onError = jest.fn();
    observeNativeCastPlayback(client, streamUrl, onError);
    jest.advanceTimersByTime(30000);
    listener(status(MediaPlayerState.IDLE, MediaPlayerIdleReason.ERROR));
    expect(onError).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
