import React, {act} from 'react';
import {Image, StyleSheet} from 'react-native';
import renderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import RemoteLogo from '../src/components/RemoteLogo';

jest.mock('react-native-svg', () => ({SvgUri: 'SvgUri'}));
describe('hero logo alignment', () => {
  it('fits a narrow bitmap to the left without changing the frame height and resets on URI change', async () => {
    let tree!: renderer.ReactTestRenderer;
    const onLoad = jest.fn();
    await act(async () => {tree = renderer.create(<RemoteLogo align="left" uri="a.png" width={380} height={80} onError={jest.fn()} onLoad={onLoad} />);});
    await act(async () => tree.root.findByType(Image).props.onLoad({nativeEvent: {source: {width: 200, height: 100}}}));
    expect(StyleSheet.flatten(tree.root.findByType(Image).props.style)).toMatchObject({width: 160, height: 80});
    expect(onLoad).toHaveBeenCalledTimes(1);
    await act(async () => {tree.update(<RemoteLogo align="left" uri="b.png" width={380} height={80} onError={jest.fn()} />);});
    expect(StyleSheet.flatten(tree.root.findByType(Image).props.style).width).toBe(380);
    await act(async () => {tree.unmount();});
  });
  it('keeps the existing centered layout outside the hero', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {tree = renderer.create(<RemoteLogo uri="a.png" width={380} height={80} onError={jest.fn()} />);});
    await act(async () => tree.root.findByType(Image).props.onLoad({nativeEvent: {source: {width: 200, height: 100}}}));
    expect(StyleSheet.flatten(tree.root.findByType(Image).props.style).width).toBe(380);
    await act(async () => {tree.unmount();});
  });
});
