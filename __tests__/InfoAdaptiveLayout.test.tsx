import React, {act, useState} from 'react';
import {Animated, Text, TouchableOpacity} from 'react-native';
import renderer from 'react-test-renderer';
import {expect, it} from '@jest/globals';
import InfoAdaptiveLayout from '../src/components/InfoAdaptiveLayout';

it('retains selected content state and a single CTA across repeated rotation', async () => {
  function StatefulEpisodes() {
    const [season, setSeason] = useState(1);
    return <TouchableOpacity testID="season" onPress={() => setSeason(2)}><Text>{season}</Text></TouchableOpacity>;
  }
  const scrollY = new Animated.Value(0);
  const render = (landscape: boolean) => <InfoAdaptiveLayout landscape={landscape}
    scrollY={scrollY} toolbarHeight={56} summary={<Text>Summary</Text>}
    background={null} tabs={<Text>Episodes</Text>} footer={<Text testID="cta">Play</Text>}>
    <StatefulEpisodes />
  </InfoAdaptiveLayout>;
  let tree: renderer.ReactTestRenderer;
  await act(async () => {tree = renderer.create(render(false));});
  await act(async () => {tree.root.findByProps({testID: 'season'}).props.onPress();});
  for (const landscape of [true, false, true]) {
    await act(async () => {tree.update(render(landscape));});
    expect(tree!.root.findByType(StatefulEpisodes).findByType(Text).props.children).toBe(2);
    expect(tree!.root.findAllByType(Text).filter(node => node.props.testID === 'cta')).toHaveLength(1);
  }
  await act(async () => {tree.unmount();});
});
