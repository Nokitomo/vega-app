import React, {act} from 'react';
import {ActivityIndicator, TouchableOpacity} from 'react-native';
import renderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import HomeRowState from '../src/components/HomeRowState';
jest.mock('react-i18next', () => ({useTranslation: () => ({t: (key: string) => key})}));
jest.mock('@expo/vector-icons', () => ({Ionicons: 'Icon'}));
describe('Home error and empty states', () => {
  it('keeps retry available on errors and disables it during a pending retry', async () => {
    const retry = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {tree = renderer.create(<HomeRowState error onRetry={retry} />);});
    await act(async () => tree.root.findByType(TouchableOpacity).props.onPress());
    expect(retry).toHaveBeenCalledTimes(1);
    await act(async () => {tree.update(<HomeRowState error onRetry={retry} retrying />);});
    expect(tree.root.findByType(TouchableOpacity).props.disabled).toBe(true);
    expect(tree.root.findByType(TouchableOpacity).props.accessibilityState.busy).toBe(true);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    await act(async () => {tree.unmount();});
  });
  it('does not misrepresent an empty category as a retryable error', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {tree = renderer.create(<HomeRowState onRetry={jest.fn()} />);});
    expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('No Content Found');
    await act(async () => {tree.unmount();});
  });
});
