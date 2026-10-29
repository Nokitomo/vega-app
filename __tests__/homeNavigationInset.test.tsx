import React, {act} from 'react';
import {Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import renderer from 'react-test-renderer';
import {afterEach, describe, expect, it, jest} from '@jest/globals';
import HomeNavigationInset from '../src/components/HomeNavigationInset';

jest.mock('react-native-safe-area-context', () => ({SafeAreaView: 'SafeAreaView'}));
jest.mock('../src/lib/zustand/uiSettingsStore', () => ({__esModule: true, default: () => false}));
afterEach(() => {jest.restoreAllMocks();});

describe('Home navigation inset isolation', () => {
  it('paints only the reserved inset and removes it in the player', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    let state: any = {routes: [{name: 'TabStack'}]};
    let listener = () => {};
    const unsubscribe = jest.fn();
    const navigation: any = {isReady: () => true, getRootState: () => state,
      addListener: (_: string, callback: () => void) => {listener = callback; return unsubscribe;}};
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {tree = renderer.create(<HomeNavigationInset navigation={navigation} />);});
    expect(tree.root.findByType(SafeAreaView).props.edges.bottom).toBe('additive');
    for (const tab of ['HomeStack', 'SearchStack', 'WatchListStack', 'SettingsStack']) {
      await act(async () => {state = {routes: [{name: 'TabStack', state: {routes: [{name: tab}]}}]}; listener();});
      expect(tree.root.findByType(SafeAreaView).props.style.backgroundColor).toBe('#23252B');
    }
    await act(async () => {state = {routes: [{name: 'TabStack', state: {routes: [{name: 'SearchStack', state: {routes: [{name: 'Webview'}]}}]}}]}; listener();});
    expect(tree.root.findByType(SafeAreaView).props.style.backgroundColor).toBe('black');
    await act(async () => {state = {routes: [{name: 'Player'}]}; listener();});
    expect(tree.root.findByType(SafeAreaView).props.style.backgroundColor).toBe('black');
    await act(async () => {state = {routes: [{name: 'TabStack'}]}; listener();});
    expect(tree.root.findByType(SafeAreaView).props.style.backgroundColor).toBe('#23252B');
    await act(async () => {tree.unmount();});
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
