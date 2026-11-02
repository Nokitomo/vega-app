import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {Modal, Text, TextInput, TouchableOpacity} from 'react-native';
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import Tutorial from '../src/components/Touturial';
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
  useFocusEffect: jest.fn(),
}));
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
jest.mock('../src/lib/zustand/contentStore', () => ({
  __esModule: true,
  default: (select: any) => select({provider: null, installedProviders: []}),
}));
jest.mock('../src/lib/storage', () => ({
  settingsStorage: {isHapticFeedbackEnabled: () => false},
}));
import SearchSubtitles from '../src/components/SearchSubtitles';
import ArchiveFilterModal from '../src/components/ArchiveFilterModal';
import {ErrorFallback} from '../src/components/ErrorBoundary';
import {
  searchOpenSubtitles,
  getOpenSubtitlesDownloadUrl,
} from '../src/lib/services/openSubtitles';
const mockSearch = searchOpenSubtitles as jest.MockedFunction<
  typeof searchOpenSubtitles
>;
const mockDownload = getOpenSubtitlesDownloadUrl as jest.MockedFunction<
  typeof getOpenSubtitlesDownloadUrl
>;
jest.mock('../src/lib/services/openSubtitles', () => ({
  getOpenSubtitlesApiKey: () => 'test',
  searchOpenSubtitles: jest.fn(),
  getOpenSubtitlesDownloadUrl: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (k: string) => k}),
}));
jest.mock('../src/lib/zustand/themeStore', () => ({
  __esModule: true,
  default: (select?: any) =>
    select ? select({primary: '#123456'}) : {primary: '#123456'},
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({top: 0, bottom: 0}),
}));
jest.mock('react-native-element-dropdown', () => ({Dropdown: 'Dropdown'}));
const buttonWithText = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find(b => b.findAllByType(Text).some(t => t.props.children === label))!;
describe('Secondary UI actions', () => {
  it('keeps the no-provider action linked to Extensions', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<Tutorial />);
    });
    await act(async () =>
      buttonWithText(tree, 'Install Providers').props.onPress(),
    );
    expect(mockNavigate).toHaveBeenCalledWith('TabStack', {
      screen: 'SettingsStack',
      params: {screen: 'Extensions'},
    });
    await act(async () => tree.unmount());
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('searches subtitles only on request and preserves language, season, episode and selection', async () => {
    mockSearch.mockResolvedValue([
      {
        id: '1',
        fileId: 9,
        title: 'Result',
        language: 'it',
        release: 'Release',
        uploader: 'Uploader',
      },
    ] as any);
    mockDownload.mockResolvedValue('https://example.invalid/sub.srt');
    const query = jest.fn(),
      external = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SearchSubtitles
          searchQuery="Series"
          setSearchQuery={query}
          setExternalSubs={external}
        />,
      );
    });
    await act(async () =>
      buttonWithText(tree, 'Search subtitles online').props.onPress(),
    );
    await act(async () => {
      tree.root
        .findAllByType(TextInput)
        .find(x => x.props.accessibilityLabel === 'Name or IMDB ID')!
        .props.onChangeText('New');
      tree.root
        .findAllByType(TextInput)
        .find(x => x.props.accessibilityLabel === 'Season')!
        .props.onChangeText('2');
      tree.root
        .findAllByType(TextInput)
        .find(x => x.props.accessibilityLabel === 'Episode')!
        .props.onChangeText('12');
      tree.root.findByType('Dropdown' as any).props.onChange({id: 'it'});
    });
    expect(query).toHaveBeenCalledWith('New');
    expect(mockSearch).not.toHaveBeenCalled();
    await act(async () =>
      tree.root
        .findAllByType(TouchableOpacity)
        .find(x => x.props.accessibilityLabel === 'Search')!
        .props.onPress(),
    );
    expect(mockSearch).toHaveBeenCalledWith({
      query: 'Series',
      language: 'it',
      season: '2',
      episode: '12',
    });
    await act(async () => buttonWithText(tree, 'Result').props.onPress());
    expect(mockDownload).toHaveBeenCalledWith(9);
    const update = external.mock.calls[0][0] as (previous: any[]) => any[];
    expect(update([{title: 'existing'}])).toEqual([
      expect.objectContaining({
        language: 'it',
        uri: 'https://example.invalid/sub.srt',
      }),
      {title: 'existing'},
    ]);
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
    await act(async () => tree.unmount());
  });
  it('keeps archive edits local until Apply and preserves Reset and Close', async () => {
    const apply = jest.fn(),
      close = jest.fn();
    const value = {title: 'Original', genres: ['a']};
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <ArchiveFilterModal
          visible
          filters={
            {
              title: true,
              genres: [
                {title: 'Action', value: 'a'},
                {title: 'Drama', value: 'b'},
              ],
            } as any
          }
          value={value}
          primary="#123456"
          onApply={apply}
          onClose={close}
        />,
      );
    });
    await act(async () => {
      tree.root.findByType(TextInput).props.onChangeText('Changed');
      buttonWithText(tree, 'Drama').props.onPress();
    });
    expect(value).toEqual({title: 'Original', genres: ['a']});
    expect(apply).not.toHaveBeenCalled();
    await act(async () => buttonWithText(tree, 'Apply').props.onPress());
    expect(apply).toHaveBeenLastCalledWith(
      expect.objectContaining({title: 'Changed', genres: ['a', 'b']}),
    );
    await act(async () => buttonWithText(tree, 'Reset').props.onPress());
    await act(async () => buttonWithText(tree, 'Apply').props.onPress());
    expect(apply).toHaveBeenLastCalledWith(
      expect.objectContaining({genres: []}),
    );
    await act(async () => tree.root.findByType(Modal).props.onRequestClose());
    expect(close).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });
  it('preserves recovery from a query error', async () => {
    const retry = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <ErrorFallback error={new Error('Test')} resetError={retry} />,
      );
    });
    await act(async () => buttonWithText(tree, 'Try Again').props.onPress());
    expect(retry).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });
});
