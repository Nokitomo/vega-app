import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {FlatList} from 'react-native';
import {describe, expect, it, jest} from '@jest/globals';
import WatchList from '../src/screens/WatchList';

const mockNavigate = jest.fn();
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
  default: () => ({watchList: mockItems}),
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
      const usedWidth = cell.props.style.width * columns + (columns - 1) * 10;
      expect(usedWidth).toBeLessThanOrEqual(width + 0.001);
      expect(usedWidth).toBeCloseTo(width);
      if (columns === 1) {
        expect(list.props.columnWrapperStyle).toBeUndefined();
      }
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
});
