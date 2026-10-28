import React, {act} from 'react';
import {FlatList, TouchableOpacity} from 'react-native';
import renderer from 'react-test-renderer';
import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import ContinueWatching from '../src/components/ContinueWatching';

const mockNavigate = jest.fn();
const mockHide = jest.fn();
const mockMigrate = jest.fn<() => Promise<void>>().mockResolvedValue();
const mockItem = {
  id: 'film',
  link: 'film',
  title: 'Film',
  displayTitle: 'Display title',
  provider: 'fixture',
  poster: 'poster',
  duration: 1000,
  progress: 250,
  isSeries: false,
};
let mockHistory = [mockItem];
let mockShow = true;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));
jest.mock('../src/lib/zustand/watchHistrory', () => ({
  __esModule: true,
  default: (selector: (state: unknown) => unknown) =>
    selector({
      history: mockHistory,
      hiddenFromContinueWatching: [],
      hideContinueWatchingItem: mockHide,
      migrateDisplayTitles: mockMigrate,
    }),
}));
jest.mock('../src/lib/zustand/uiSettingsStore', () => ({
  __esModule: true,
  default: (selector: (state: unknown) => unknown) =>
    selector({showRecentlyWatched: mockShow}),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

beforeEach(() => {
  mockHistory = [mockItem];
  mockShow = true;
  mockNavigate.mockClear();
  mockHide.mockClear();
});

async function renderRow() {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<ContinueWatching />);
  });
  return tree;
}

// Render the actual list cell, retaining the list's production handlers.
async function renderCard(tree: renderer.ReactTestRenderer) {
  const list = tree.root.findByType(FlatList);
  let card!: renderer.ReactTestRenderer;
  await act(async () => {
    card = renderer.create(list.props.renderItem({item: mockItem, index: 0}));
  });
  return card;
}

describe('Continue Watching home interactions', () => {
  it('preserves provider, poster and detail navigation when a card is pressed', async () => {
    const tree = await renderRow();
    const card = await renderCard(tree);
    await act(async () => {
      card.root
        .findByType(TouchableOpacity)
        .props.onPress({stopPropagation() {}});
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      'Info',
      expect.objectContaining({
        link: 'film',
        provider: 'fixture',
        poster: 'poster',
      }),
    );
    await act(async () => {
      card.unmount();
      tree.unmount();
    });
  });

  it('long press selects without navigating and removal hides only the selected title', async () => {
    const tree = await renderRow();
    const card = await renderCard(tree);
    await act(async () => {
      card.root
        .findByType(TouchableOpacity)
        .props.onLongPress({stopPropagation() {}});
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    const remove = tree.root
      .findAllByType(TouchableOpacity)
      .find(
        node =>
          node.props.accessibilityLabel ===
          'Hide selected from continue watching',
      );
    expect(remove).toBeDefined();
    await act(async () => {
      remove!.props.onPress();
    });
    expect(mockHide).toHaveBeenCalledTimes(1);
    expect(mockHide).toHaveBeenCalledWith('film');
    expect(
      tree.root
        .findAllByType(TouchableOpacity)
        .some(
          node =>
            node.props.accessibilityLabel ===
            'Hide selected from continue watching',
        ),
    ).toBe(false);
    await act(async () => {
      card.unmount();
      tree.unmount();
    });
  });

  it('keeps the section hidden for an empty history or disabled preference', async () => {
    mockHistory = [];
    const empty = await renderRow();
    expect(empty.toJSON()).toBeNull();
    await act(async () => {
      empty.unmount();
    });
    mockHistory = [mockItem];
    mockShow = false;
    const disabled = await renderRow();
    expect(disabled.toJSON()).toBeNull();
    await act(async () => {
      disabled.unmount();
    });
  });
});
