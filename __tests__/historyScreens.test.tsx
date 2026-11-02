import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {Alert, TouchableOpacity} from 'react-native';
import {describe, expect, it, jest} from '@jest/globals';
import ContinueWatchingAll from '../src/screens/ContinueWatchingAll';
import WatchHistory from '../src/screens/WatchHistory';
import {getPosterGrid} from '../src/components/usePosterGrid';
const mockNavigate = jest.fn();
const mockHide = jest.fn();
const mockRemove = jest.fn();
const mockMigrate = jest.fn<() => Promise<void>>().mockResolvedValue();
const mockItem = {
  id: 'film',
  link: 'film',
  title: 'Film',
  displayTitle: 'Film',
  provider: 'fixture',
  poster: 'poster',
  duration: 1000,
  progress: 250,
  isSeries: false,
};
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({bottom: 0}),
}));
jest.mock('../src/lib/zustand/watchHistrory', () => ({
  __esModule: true,
  default: (select: any) =>
    select({
      history: [mockItem],
      hiddenFromContinueWatching: [],
      hideContinueWatchingItem: mockHide,
      removeItemsByLinks: mockRemove,
      clearHistory: jest.fn(),
      migrateDisplayTitles: mockMigrate,
    }),
}));
jest.mock('@shopify/flash-list', () => ({
  FlashList: (props: any) => require('react').createElement('List', props),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
const navigation: any = {navigate: mockNavigate, goBack: jest.fn()};
async function mount(Component: any) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Component navigation={navigation} />);
  });
  await act(async () => {
    tree.root
      .findByProps({testID: 'history-viewport'})
      .props.onLayout({nativeEvent: {layout: {width: 1100}}});
  });
  return tree;
}
describe('History and full continue watching grids', () => {
  it('fits narrow and wide viewports without losing card space', () => {
    for (const width of [280, 380, 700, 1100]) {
      const grid = getPosterGrid(width);
      expect(grid.cellWidth * grid.columns).toBeCloseTo(width);
      expect(grid.posterWidth + 12).toBeLessThanOrEqual(grid.cellWidth + 0.001);
    }
  });
  it('retains Info target and hides only the chosen continue-watching item', async () => {
    const tree = await mount(ContinueWatchingAll);
    const list = tree.root.findByType('List' as any);
    expect(list.props.numColumns).toBeGreaterThan(3);
    let card!: renderer.ReactTestRenderer;
    await act(async () => {
      card = renderer.create(list.props.renderItem({item: mockItem}));
    });
    const buttons = card.root.findAllByType(TouchableOpacity);
    await act(async () => {
      buttons[0].props.onPress();
      buttons[1].props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      'Info',
      expect.objectContaining({
        link: 'film',
        provider: 'fixture',
        poster: 'poster',
      }),
    );
    expect(mockHide).toHaveBeenCalledWith('film');
    await act(async () => {
      card.unmount();
      tree.unmount();
    });
  });
  it('keeps selection and confirmation before removing history', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tree = await mount(WatchHistory);
    let card!: renderer.ReactTestRenderer;
    await act(async () => {
      card = renderer.create(
        tree.root.findByType('List' as any).props.renderItem({item: mockItem}),
      );
    });
    await act(async () => {
      card.root.findByType(TouchableOpacity).props.onLongPress();
    });
    await act(async () => {
      tree.root.findAllByType(TouchableOpacity).at(-1)!.props.onPress();
    });
    expect(mockRemove).not.toHaveBeenCalled();
    const actions = alert.mock.calls[0][2]!;
    expect(actions[0].style).toBe('cancel');
    await act(async () => {
      actions[1].onPress!();
    });
    expect(mockRemove).toHaveBeenCalledWith(['film']);
    await act(async () => {
      card.unmount();
      tree.unmount();
    });
    alert.mockRestore();
  });
});
