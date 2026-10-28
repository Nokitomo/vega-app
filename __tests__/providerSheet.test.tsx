import React, {act} from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {Modal} from 'react-native';
import renderer from 'react-test-renderer';
import ProviderDrawer from '../src/components/ProviderDrawer';
import useContentStore from '../src/lib/zustand/contentStore';
import {extensionStorage} from '../src/lib/storage';

jest.mock('../src/lib/zustand/contentStore', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../src/lib/storage', () => ({
  extensionStorage: {setDefaultProviderSource: jest.fn()},
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 24, bottom: 16, left: 0, right: 0}),
}));
jest.mock('../src/lib/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

describe('provider sheet', () => {
  const first = {
    value: 'same',
    display_name: 'First source',
    source: {author: 'first'},
  };
  const second = {
    value: 'same',
    display_name: 'Second source',
    source: {author: 'second'},
  };
  const legacy = {value: 'legacy', display_name: 'Legacy'};
  const setProvider = jest.fn();
  const onClose = jest.fn();
  let tree: renderer.ReactTestRenderer;
  beforeEach(() => {
    jest.clearAllMocks();
    (useContentStore as unknown as jest.Mock).mockReturnValue({
      provider: first,
      setProvider,
      installedProviders: [first, second, legacy],
    });
    act(() => {
      tree = renderer.create(<ProviderDrawer visible onClose={onClose} />);
    });
  });
  afterEach(() => {
    act(() => tree.unmount());
  });

  it('distinguishes identical provider IDs from different authors and switches source', () => {
    const matches = tree.root.findAll(
      node =>
        node.props.accessibilityRole === 'radio' &&
        typeof node.props.onPress === 'function',
    );
    const rows = Array.from(
      new Map(
        matches.map(node => [node.props.accessibilityLabel, node]),
      ).values(),
    );
    expect(rows.map(row => row.props.accessibilityState.checked)).toEqual([
      true,
      false,
      false,
    ]);
    act(() => rows[1].props.onPress());
    expect(extensionStorage.setDefaultProviderSource).toHaveBeenCalledWith(
      'second',
    );
    expect(setProvider).toHaveBeenCalledWith(second);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('keeps legacy providers selectable without overwriting the default source', () => {
    const row = tree.root
      .findAll(node => typeof node.props.onPress === 'function')
      .find(node => node.props.accessibilityLabel === 'Legacy')!;
    act(() => row.props.onPress());
    expect(setProvider).toHaveBeenCalledWith(legacy);
    expect(extensionStorage.setDefaultProviderSource).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('dismisses with Back, close and backdrop without changing provider', () => {
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    act(() =>
      tree.root
        .findAll(node => typeof node.props.onPress === 'function')
        .find(node => node.props.accessibilityLabel === 'Close')!
        .props.onPress(),
    );
    act(() =>
      tree.root
        .findAll(node => typeof node.props.onPress === 'function')
        .find(node => node.props.testID === 'provider-sheet-backdrop')!
        .props.onPress(),
    );
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(setProvider).not.toHaveBeenCalled();
    expect(tree.root.findByType(Modal).props.animationType).toBe('none');
  });
});
