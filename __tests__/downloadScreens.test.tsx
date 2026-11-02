import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {TouchableOpacity} from 'react-native';
import {describe, expect, it, jest, beforeEach} from '@jest/globals';
import Downloads from '../src/screens/settings/Downloads';
import SeriesEpisodes from '../src/screens/settings/SeriesEpisodes';
const mockNavigate = jest.fn();
const mockBack = jest.fn();
const mockUnlink = jest.fn<() => Promise<void>>().mockResolvedValue();
const mockFiles = [
  {uri: 'file:///test/Series-episode-2.mp4', exists: true, size: 2048},
  {uri: 'file:///test/Series-episode-1.mp4', exists: true, size: 1024},
  {uri: 'file:///test/Movie.mp4', exists: true, size: 4096},
];
const mockThumbnails = Object.fromEntries(
  mockFiles.map(f => [f.uri, 'thumbnail']),
);
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
  useFocusEffect: () => {},
}));
jest.mock('../src/lib/file/getStoragePermission', () => ({
  __esModule: true,
  default: () => Promise.resolve(false),
}));
jest.mock('../src/lib/storage', () => ({
  settingsStorage: {
    getDownloadLocationConfig: () => ({type: 'path', path: '/test'}),
    isHapticFeedbackEnabled: () => false,
  },
  downloadsStorage: {
    getCacheLocation: () => '',
    getFilesInfo: () => mockFiles,
    getThumbnails: () => mockThumbnails,
    saveThumbnails: jest.fn(),
    saveFilesInfo: jest.fn(),
  },
}));
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: () => Promise.resolve({exists: true}),
  StorageAccessFramework: {deleteAsync: jest.fn()},
}));
jest.mock('@dr.pogodin/react-native-fs', () => ({unlink: () => mockUnlink()}));
jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: () => Promise.resolve({uri: 'thumbnail'}),
}));
jest.mock('@shopify/flash-list', () => ({
  FlashList: (props: any) => require('react').createElement('List', props),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('../src/lib/zustand/themeStore', () => ({
  __esModule: true,
  default: (select: any) => select({primary: '#ff640a'}),
}));
describe('Download presentation preserves actions', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockBack.mockClear();
    mockUnlink.mockClear();
  });
  it('retains movie playback and grouped series navigation', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<Downloads />);
    });
    const list = tree.root.findByType('List' as any);
    expect(list.props.data).toHaveLength(2);
    for (const item of list.props.data) {
      let row!: renderer.ReactTestRenderer;
      await act(async () => {
        row = renderer.create(list.props.renderItem({item}));
      });
      await act(async () => {
        row.root.findByType(TouchableOpacity).props.onPress();
      });
      await act(async () => row.unmount());
    }
    expect(mockNavigate).toHaveBeenCalledWith(
      'Player',
      expect.objectContaining({directUrl: mockFiles[2].uri, doNotTrack: true}),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      'TabStack',
      expect.objectContaining({screen: 'SettingsStack'}),
    );
    await act(async () => tree.unmount());
  });
  it('sorts episodes and opens the chosen local file without tracking', async () => {
    let tree!: renderer.ReactTestRenderer, row!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SeriesEpisodes
          navigation={{goBack: mockBack} as any}
          route={
            {
              params: {
                series: 'Long series title',
                episodes: mockFiles.slice(0, 2),
                thumbnails: mockThumbnails,
              },
            } as any
          }
        />,
      );
    });
    const list = tree.root.findByType('List' as any);
    expect(list.props.data.map((x: any) => x.uri)).toEqual([
      mockFiles[1].uri,
      mockFiles[0].uri,
    ]);
    await act(async () => {
      row = renderer.create(list.props.renderItem({item: list.props.data[0]}));
    });
    await act(async () =>
      row.root.findByType(TouchableOpacity).props.onPress(),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      'Player',
      expect.objectContaining({directUrl: mockFiles[1].uri, doNotTrack: true}),
    );
    mockNavigate.mockClear();
    await act(async () =>
      row.root.findByType(TouchableOpacity).props.onLongPress(),
    );
    await act(async () => {
      row.update(
        tree.root
          .findByType('List' as any)
          .props.renderItem({item: mockFiles[1]}),
      );
    });
    await act(async () =>
      row.root.findByType(TouchableOpacity).props.onPress(),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockUnlink).not.toHaveBeenCalled();
    await act(async () =>
      row.root.findByType(TouchableOpacity).props.onLongPress(),
    );
    await act(async () => {
      await tree.root
        .findAllByProps({name: 'delete-outline'})[0]
        .props.onPress();
    });
    expect(mockUnlink).toHaveBeenCalledTimes(1);
    expect(
      tree.root.findByType('List' as any).props.data.map((x: any) => x.uri),
    ).toEqual([mockFiles[0].uri]);
    await act(async () => {
      row.unmount();
      tree.unmount();
    });
  });
});
