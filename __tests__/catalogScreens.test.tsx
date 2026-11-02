import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import ScrollList from '../src/screens/ScrollList';
import {providerManager} from '../src/lib/services/ProviderManager';
import ArchiveFilterModal from '../src/components/ArchiveFilterModal';
import ProviderImage from '../src/components/ProviderImage';
const mockNavigate = jest.fn();
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
jest.mock('../src/lib/services/ProviderManager', () => ({
  providerManager: {
    getPosts: jest.fn(),
    getArchiveFilters: () => ({title: true}),
  },
}));
jest.mock('../src/lib/zustand/contentStore', () => ({
  __esModule: true,
  default: (select: any) => select({provider: {value: 'streamingunity'}}),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: jest.fn()}),
}));
jest.mock('../src/components/ArchiveFilterModal', () => () => null);
jest.mock('../src/components/Skeleton', () => () => null);
jest.mock('../src/components/ProviderImage', () => () => null);
jest.mock('../src/lib/storage', () => ({
  settingsStorage: {getListViewType: () => 1, setListViewType: jest.fn()},
}));
jest.mock('@shopify/flash-list', () => ({
  FlashList: (props: any) =>
    require('react').createElement('List', props, [
      props.ListFooterComponent,
      props.ListEmptyComponent,
    ]),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
const request = jest.mocked(providerManager.getPosts);
const props = (filter: string) =>
  ({
    route: {
      params: {title: 'Catalog', filter, providerValue: 'streamingunity'},
    },
  }) as any;
const post = {title: 'Title', link: '/title', image: '/poster', variants: []};
const flush = async () => {
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
};
describe('Catalog, archive and calendar presentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  it('fits measured tablet space, preserves image and Info parameters and switches to list', async () => {
    request.mockResolvedValue([post]);
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ScrollList {...props('latest')} />);
    });
    await flush();
    for (const width of [340, 700, 1100]) {
      await act(async () => {
        tree.root
          .findByProps({testID: 'catalog-viewport'})
          .props.onLayout({nativeEvent: {layout: {width}}});
      });
      const list = tree.root.findByType('List' as any);
      const cell = list.props.renderItem({item: post});
      expect(
        cell.props.style.width * list.props.numColumns,
      ).toBeLessThanOrEqual(width);
      expect(list.props.numColumns).toBeGreaterThanOrEqual(width > 600 ? 4 : 3);
      cell.props.onPress();
      expect(mockNavigate).toHaveBeenLastCalledWith(
        'Info',
        expect.objectContaining({
          link: post.link,
          poster: post.image,
          provider: 'streamingunity',
          variants: [],
        }),
      );
    }
    await act(async () => {
      tree.root
        .findAllByType(TouchableOpacity)
        .find(x => x.props.accessibilityLabel === 'Show list')!
        .props.onPress();
    });
    expect(tree.root.findByType('List' as any).props.numColumns).toBe(1);
    await act(async () => {
      tree.unmount();
    });
  });
  it('ignores an obsolete request after applying filters and reloads an unchanged selection', async () => {
    let resolveOld!: (value: any) => void;
    request.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveOld = resolve;
        }),
    );
    request.mockResolvedValue([post]);
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ScrollList {...props('archive')} />);
    });
    await flush();
    const selection = {genres: [], title: 'new'};
    await act(async () => {
      tree.root.findByType(ArchiveFilterModal).props.onApply(selection);
    });
    await flush();
    await act(async () => {
      resolveOld([{...post, link: '/stale'}]);
    });
    expect(tree.root.findByType('List' as any).props.data).toEqual([post]);
    expect(request.mock.calls[1][0]).toEqual(
      expect.objectContaining({filter: 'archive?title=new', page: 1}),
    );
    await act(async () => {
      tree.root.findByType(ArchiveFilterModal).props.onApply(selection);
    });
    await flush();
    expect(request).toHaveBeenCalledTimes(3);
    expect(tree.root.findByType('List' as any).props.data).toEqual([post]);
    await act(async () => {
      tree.unmount();
    });
  });
  it('groups calendar days, adapts its rows and retries a failed calendar request', async () => {
    request
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(
        Array.from({length: 8}, (_, i) => ({
          ...post,
          link: '/' + i,
          day: i < 7 ? 'monday' : 'tuesday',
        })),
      );
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ScrollList {...props('calendar')} />);
    });
    await flush();
    expect(
      tree.root
        .findAllByType(Text)
        .some(x => x.props.children === 'Failed to load content'),
    ).toBe(true);
    await act(async () => {
      tree.root.findAllByType(TouchableOpacity).at(-1)!.props.onPress();
    });
    await flush();
    await act(async () => {
      tree.root
        .findByProps({testID: 'catalog-viewport'})
        .props.onLayout({nativeEvent: {layout: {width: 1100}}});
    });
    expect(tree.root.findAllByType(ProviderImage)).toHaveLength(8);
    const days = tree.root
      .findAllByType(Text)
      .filter(x => ['Monday', 'Tuesday'].includes(x.props.children));
    expect(days.map(x => x.props.children)).toEqual(['Monday', 'Tuesday']);
    expect(request.mock.calls.map(x => x[0].page)).toEqual([1, 1]);
    await act(async () => {
      tree.unmount();
    });
  });
});
