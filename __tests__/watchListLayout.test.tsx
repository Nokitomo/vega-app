import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {FlatList, Image, ScrollView, Text} from 'react-native';
import {describe, expect, it, jest} from '@jest/globals';
import WatchList from '../src/screens/WatchList';

const mockNavigate = jest.fn();
let mockEmpty = false;
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
const mockItems = Array.from({length: 40}, (_, index) => ({
  title: `Item ${index}`,
  link: `item-${index}`,
  poster: `poster-${index}`,
  provider: 'animeunity',
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));
jest.mock('../src/lib/zustand/watchListStore', () => ({
  __esModule: true,
  default: () => ({watchList: mockEmpty ? [] : mockItems}),
}));
jest.mock('../src/lib/zustand/themeStore', () => ({
  __esModule: true,
  default: () => ({primary: '#ff640a'}),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

describe('Watchlist measured viewport', () => {
  it('waits for measurement, fits 40 existing items after resizing and preserves detail navigation', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<WatchList />);
    });
    expect(tree.root.findAllByType(FlatList)).toHaveLength(0);
    for (const width of [1200, 1056, 376, 80, 742, 1056]) {
      await act(async () => {
        tree.root
          .findAllByProps({testID: 'watchlist-viewport'})[0]
          .props.onLayout({nativeEvent: {layout: {width}}});
      });
      const list = tree.root.findByType(FlatList);
      expect(list.props.data).toBe(mockItems);
      expect(list.props.data).toHaveLength(40);
      const columns = list.props.numColumns;
      const cell = list.props.renderItem({item: mockItems[39], index: 39});
      const usedWidth =
        cell.props.style.width * columns +
        (columns - 1) * (list.props.columnWrapperStyle?.gap || 0);
      expect(usedWidth).toBeLessThanOrEqual(width + 0.001);
      expect(usedWidth).toBeCloseTo(width);
      if (columns === 1) {
        expect(list.props.columnWrapperStyle).toBeUndefined();
      }
      let card!: renderer.ReactTestRenderer;
      await act(async () => {
        card = renderer.create(cell);
      });
      const poster = card.root.findByType(Image);
      expect(poster.props.source).toEqual({uri: 'poster-39'});
      expect(poster.props.style.height / poster.props.style.width).toBeCloseTo(
        1.5,
      );
      expect(
        card.root
          .findAllByType(Text)
          .some(node => node.props.children === 'Item 39'),
      ).toBe(true);
      await act(async () => {
        card.unmount();
      });
      cell.props.onPress();
      expect(mockNavigate).toHaveBeenLastCalledWith('Info', {
        link: 'item-39',
        provider: 'animeunity',
        poster: 'poster-39',
      });
    }
    await act(async () => {
      tree.unmount();
    });
  });
  it('shows a scrollable empty state and updates when saved items become available', async () => {
    mockEmpty = true;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<WatchList />);
    });
    expect(tree.root.findAllByType(FlatList)).toHaveLength(0);
    expect(tree.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
    expect(
      tree.root
        .findAllByType(Text)
        .some(node => node.props.children === 'Your watchlist is empty'),
    ).toBe(true);
    mockEmpty = false;
    await act(async () => {
      tree.update(<WatchList />);
    });
    await act(async () => {
      tree.root
        .findAllByProps({testID: 'watchlist-viewport'})[0]
        .props.onLayout({nativeEvent: {layout: {width: 376}}});
    });
    expect(tree.root.findByType(FlatList).props.data).toBe(mockItems);
    await act(async () => {
      tree.unmount();
    });
  });
});
