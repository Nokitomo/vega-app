import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {Animated, TextInput, TouchableOpacity} from 'react-native';
import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import Search from '../src/screens/Search';
import HomeHeader from '../src/components/HomeHeader';
import {MMKV} from '../src/lib/Mmkv';
const mockNavigate = jest.fn();
jest.mock('../src/lib/Mmkv', () => {
  const data: Record<string, unknown[]> = {};
  return {MMKV: {getArray: (key: string) => data[key], setArray: (key: string, value: unknown[]) => {data[key] = value;}}};
});
jest.mock('@react-navigation/native', () => ({useNavigation: () => ({navigate: mockNavigate}), useIsFocused: () => true}));
jest.mock('react-native-safe-area-context', () => ({SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0})}));
jest.mock('../src/lib/zustand/contentStore', () => ({__esModule: true, default: () => ({provider: {value: 'animeunity', display_name: 'AnimeUnity'}})}));
jest.mock('../src/lib/zustand/uiSettingsStore', () => ({__esModule: true, default: (select: any) => select({showHamburgerMenu: true, disableDrawer: false})}));
jest.mock('../src/lib/hooks/useSearchSuggestions', () => ({useSearchSuggestions: () => ({suggestions: [], status: 'idle'})}));
jest.mock('react-i18next', () => ({useTranslation: () => ({t: (key: string) => key})}));

describe('Global search preserves submit and history behavior', () => {
  beforeEach(() => {jest.clearAllMocks(); MMKV.setArray('searchHistory', []);});
  it('does not search or save while typing, searches on submit and caps history at 30', async () => {
    MMKV.setArray('searchHistory', Array.from({length: 30}, (_, index) => `old-${index}`));
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {tree = renderer.create(<Search />);});
    await act(async () => {tree.root.findByType(TextInput).props.onChangeText('  Frieren  ');});
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(MMKV.getArray('searchHistory')).toHaveLength(30);
    await act(async () => {tree.root.findByType(TextInput).props.onSubmitEditing({nativeEvent: {text: '  Frieren  '}});});
    expect(mockNavigate).toHaveBeenCalledWith('SearchResults', {filter: 'Frieren'});
    const history = MMKV.getArray<string>('searchHistory')!;
    expect(history).toHaveLength(30);
    expect(history[0]).toBe('Frieren');
    await act(async () => {tree.root.findByType(TextInput).props.onSubmitEditing({nativeEvent: {text: 'Frieren'}});});
    expect(MMKV.getArray('searchHistory')).toEqual(history);
    await act(async () => {tree.unmount();});
  });
  it('clears only the input with X and removes history explicitly', async () => {
    MMKV.setArray('searchHistory', ['Frieren', 'Naruto']);
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {tree = renderer.create(<Search />);});
    await act(async () => {tree.root.findByType(TextInput).props.onChangeText('query');});
    await act(async () => {tree.root.findAllByProps({accessibilityLabel: 'Clear search'})[0].props.onPress();});
    expect(tree.root.findByType(TextInput).props.value).toBe('');
    expect(MMKV.getArray('searchHistory')).toEqual(['Frieren', 'Naruto']);
    const remove = tree.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === 'Remove recent search: {{query}}')!;
    await act(async () => {remove.props.onPress();});
    expect(MMKV.getArray('searchHistory')).toEqual(['Naruto']);
    await act(async () => {tree.root.findAllByType(TouchableOpacity)[0].props.onPress();});
    expect(MMKV.getArray('searchHistory')).toEqual([]);
    await act(async () => {tree.unmount();});
  });
});

describe('Home provider search invariants', () => {
  it('uses only the selected provider, saves no history, and preserves direct URL navigation', async () => {
    mockNavigate.mockClear();
    MMKV.setArray('searchHistory', ['existing']);
    const close = jest.fn();
    const opacity = new Animated.Value(0).interpolate({inputRange: [0, 1], outputRange: [0, 1]});
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {tree = renderer.create(<HomeHeader isDrawerOpen={false} onOpenDrawer={jest.fn()} searchActive setSearchActive={close} backgroundOpacity={opacity} />);});
    expect(tree.root.findByType(TextInput).props.autoFocus).toBe(true);
    await act(async () => {tree.root.findByType(TextInput).props.onChangeText('Frieren');});
    expect(mockNavigate).not.toHaveBeenCalled();
    await act(async () => {tree.root.findByType(TextInput).props.onSubmitEditing({nativeEvent: {text: ' Frieren '}});});
    expect(mockNavigate).toHaveBeenCalledWith('ScrollList', {providerValue: 'animeunity', filter: 'Frieren', title: 'AnimeUnity', isSearch: true});
    expect(close).toHaveBeenCalledWith(false);
    expect(MMKV.getArray('searchHistory')).toEqual(['existing']);
    await act(async () => {tree.root.findByType(TextInput).props.onSubmitEditing({nativeEvent: {text: 'https://example.com/content'}});});
    expect(mockNavigate).toHaveBeenLastCalledWith('Info', {link: 'https://example.com/content'});
    await act(async () => {tree.unmount();});
  });
});
