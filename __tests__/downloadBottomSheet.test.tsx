import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {
  Modal,
  Text,
  TouchableOpacity,
  Clipboard,
  ToastAndroid,
} from 'react-native';
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import DownloadBottomSheet from '../src/components/DownloadBottomSheet';
import {TextTrackType} from 'react-native-video';
const mockClose = jest.fn();
const mockExpand = jest.fn();
jest.mock('@gorhom/bottom-sheet', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: R.forwardRef((props: any, ref: any) => {
      R.useImperativeHandle(ref, () => ({
        close: mockClose,
        expand: mockExpand,
      }));
      return R.createElement('Sheet', props, props.children);
    }),
    BottomSheetScrollView: require('react-native').ScrollView,
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 24, bottom: 24, left: 0, right: 0}),
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: require('react-native').View,
}));
jest.mock('../src/components/Skeleton', () => 'Skeleton');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('../src/lib/storage', () => ({
  settingsStorage: {isHapticFeedbackEnabled: () => false},
}));
jest.mock('../src/lib/zustand/themeStore', () => ({
  __esModule: true,
  default: (select: any) => select({primary: '#123456'}),
}));
const stream = {
  server: 'Server 1080p',
  link: 'https://example.invalid/video',
  type: 'mp4',
  subtitles: [
    {
      title: 'Italiano',
      language: 'it' as const,
      uri: 'https://example.invalid/sub',
      type: TextTrackType.VTT,
    },
    {
      title: 'English',
      language: 'en' as const,
      uri: 'https://example.invalid/sub2',
      type: TextTrackType.SUBRIP,
    },
  ],
};
describe('Download sheet actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('preserves video, subtitle payloads, copy link and closing', async () => {
    const video = jest.fn(),
      subs = jest.fn(),
      setModal = jest.fn();
    const copy = jest
      .spyOn(Clipboard, 'setString')
      .mockImplementation(() => {});
    jest.spyOn(ToastAndroid, 'show').mockImplementation(() => {});
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <DownloadBottomSheet
          data={[stream]}
          loading={false}
          title="Title"
          showModal
          setModal={setModal}
          onPressVideo={video}
          onPressSubs={subs}
        />,
      );
    });
    expect(mockExpand).toHaveBeenCalled();
    const row = tree.root.findByType(TouchableOpacity);
    await act(async () => row.props.onLongPress());
    expect(copy).toHaveBeenCalledWith(stream.link);
    expect(video).not.toHaveBeenCalled();
    await act(async () => row.props.onPress());
    expect(video).toHaveBeenCalledWith(stream);
    expect(mockClose).toHaveBeenCalled();
    const tab = tree.root
      .findAllByType(Text)
      .find(n => n.props.children === 'Subtitle')!;
    await act(async () => tab.props.onPress());
    const subRows = tree.root.findAllByType(TouchableOpacity);
    await act(async () => subRows[0].props.onLongPress());
    expect(copy).toHaveBeenLastCalledWith(stream.subtitles[0].uri);
    for (const r of subRows) {
      await act(async () => r.props.onPress());
    }
    expect(subs).toHaveBeenNthCalledWith(1, {
      server: 'Subtitles',
      link: stream.subtitles[0].uri,
      type: 'vtt',
      title: 'Italiano',
    });
    expect(subs).toHaveBeenNthCalledWith(2, {
      server: 'Subtitles',
      link: stream.subtitles[1].uri,
      type: 'srt',
      title: 'English',
    });
    await act(async () => tree.root.findByType(Modal).props.onRequestClose());
    await act(async () => tree.root.findByType('Sheet' as any).props.onClose());
    expect(setModal).toHaveBeenCalledWith(false);
    await act(async () => tree.unmount());
  });
  it('keeps loading, empty and error states without actionable rows', async () => {
    const props = {
      data: [],
      loading: true,
      title: 'Title',
      showModal: true,
      setModal: jest.fn(),
      onPressVideo: jest.fn(),
      onPressSubs: jest.fn(),
    };
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<DownloadBottomSheet {...props} />);
    });
    expect(tree.root.findAllByType('Skeleton' as any)).toHaveLength(4);
    expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(0);
    await act(async () =>
      tree.update(<DownloadBottomSheet {...props} loading={false} />),
    );
    expect(
      tree.root
        .findAllByType(Text)
        .some(n => n.props.children === 'No server found'),
    ).toBe(true);
    await act(async () =>
      tree.update(
        <DownloadBottomSheet
          {...props}
          loading={false}
          error="Provider error"
        />,
      ),
    );
    expect(
      tree.root
        .findAllByType(Text)
        .some(n => n.props.children === 'Provider error'),
    ).toBe(true);
    await act(async () => tree.unmount());
  });
});
