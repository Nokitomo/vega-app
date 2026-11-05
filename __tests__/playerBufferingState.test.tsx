import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {Platform} from 'react-native';
import {describe, expect, it, jest} from '@jest/globals';
import Video from 'react-native-video';
import {VideoPlayer} from '../src/vendor/media-console/VideoPlayer';

jest.mock('react-native-video', () => ({
  __esModule: true,
  default: 'Video',
  ResizeMode: {CONTAIN: 'contain', COVER: 'cover'},
}));
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
jest.mock('expo-brightness', () => ({
  getBrightnessAsync: async () => 0.5,
  restoreSystemBrightnessAsync: async () => {},
  setBrightnessAsync: async () => {},
}));
jest.mock('../src/vendor/media-console/components/Gestures', () => 'Gestures');
jest.mock(
  '../src/vendor/media-console/components/PlayPause/SeekButton',
  () => ({SeekControls: 'SeekControls'}),
);
jest.mock('../src/vendor/media-console/components', () => ({
  Error: 'Error',
  Loader: 'Loader',
  TopControls: 'TopControls',
  BottomControls: 'BottomControls',
  PlayPause: 'PlayPause',
  Overlay: 'Overlay',
}));
jest.mock('../src/vendor/media-console/OSSupport', () => ({
  PlatformSupport: ({children}: any) => children,
}));
jest.mock('../src/vendor/media-console/hooks', () => ({
  useControlTimeout: () => ({
    clearControlTimeout() {},
    resetControlTimeout() {},
    setControlTimeout() {},
  }),
  useJSAnimations: () => ({
    showControlAnimation() {},
    hideControlAnimation() {},
  }),
  usePanResponders: () => ({
    volumePanResponder: {panHandlers: {}},
    seekPanResponder: {panHandlers: {}},
  }),
}));

describe('Android playback intent during buffering', () => {
  it('preserves play and pause through buffering, speed changes and subtitle reload events', async () => {
    const platform = Platform.OS;
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    let tree!: renderer.ReactTestRenderer;
    try {
      await act(async () => {
        tree = renderer.create(
          <VideoPlayer source={{uri: 'file:///test.mp4'}} showOnStart />,
        );
      });
      const props = () => tree.root.findByType(Video).props;
      await act(async () =>
        props().onPlaybackRateChange({playbackRate: 0, isPaused: false}),
      );
      await act(async () => props().onBuffer({isBuffering: true}));
      expect(props().paused).toBe(false);
      await act(async () => props().onBuffer({isBuffering: false}));
      expect(props().paused).toBe(false);
      await act(async () =>
        props().onPlaybackRateChange({playbackRate: 0, isPaused: true}),
      );
      expect(props().paused).toBe(true);
      await act(async () => props().onBuffer({isBuffering: true}));
      await act(async () =>
        props().onPlaybackRateChange({playbackRate: 1.5, isPaused: true}),
      );
      await act(async () => props().onBuffer({isBuffering: false}));
      await act(async () =>
        props().onLoad({duration: 60, subtitleTimingReload: true}),
      );
      expect(props().paused).toBe(true);
      await act(async () => {
        tree.root
          .findAll(node => typeof node.props.togglePlayPause === 'function')[0]
          .props.togglePlayPause();
      });
      expect(props().paused).toBe(false);
      // A queued pre-command pause event must not undo the user's Resume.
      await act(async () =>
        props().onPlaybackRateChange({playbackRate: 0, isPaused: true}),
      );
      expect(props().paused).toBe(false);
      await act(async () =>
        props().onPlaybackRateChange({playbackRate: 1, isPaused: false}),
      );
      expect(props().paused).toBe(false);
      // After acknowledgement, native controls may legitimately pause playback.
      await act(async () =>
        props().onPlaybackRateChange({playbackRate: 0, isPaused: true}),
      );
      expect(props().paused).toBe(true);
    } finally {
      await act(async () => tree?.unmount());
      Object.defineProperty(Platform, 'OS', {
        value: platform,
        configurable: true,
      });
    }
  });
});
