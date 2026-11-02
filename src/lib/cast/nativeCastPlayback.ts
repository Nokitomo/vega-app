import type {RemoteMediaClient, MediaStatus} from 'react-native-google-cast';
import {MediaPlayerIdleReason, MediaPlayerState} from 'react-native-google-cast';

const STARTUP_MONITOR_MS = 30000;

/** Watch the receiver only while the newly loaded item starts playing. */
export const observeNativeCastPlayback = (
  client: RemoteMediaClient,
  contentUrl: string,
  onPlaybackError: () => void,
): (() => void) => {
  let active = true;
  let sawCurrentMedia = false;
  const subscription = client.onMediaStatusUpdated(handleStatus);
  const timeout = setTimeout(cleanup, STARTUP_MONITOR_MS);

  function cleanup() {
    if (!active) {
      return;
    }
    active = false;
    clearTimeout(timeout);
    subscription.remove();
  }

  function handleStatus(status: MediaStatus | null) {
    if (!active || !status) {
      return;
    }
    const statusUrl = status.mediaInfo?.contentUrl;
    if (statusUrl === contentUrl) {
      sawCurrentMedia = true;
    }
    if (statusUrl && statusUrl !== contentUrl) {
      return;
    }
    if (status.playerState === MediaPlayerState.PLAYING && sawCurrentMedia) {
      cleanup();
      return;
    }
    if (
      status.playerState === MediaPlayerState.IDLE &&
      status.idleReason === MediaPlayerIdleReason.ERROR &&
      sawCurrentMedia
    ) {
      cleanup();
      onPlaybackError();
    }
  }

  client.getMediaStatus().then(handleStatus).catch(() => {});
  return cleanup;
};
