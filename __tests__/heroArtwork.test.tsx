import React, {act} from 'react';
import {Animated, Image} from 'react-native';
import renderer from 'react-test-renderer';
import {afterEach, describe, expect, it, jest} from '@jest/globals';
import HeroArtwork from '../src/components/HeroArtwork';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Hero artwork transitions', () => {
  it('waits for image load, animates only once and forwards image failures', async () => {
    const start = jest.fn();
    const timing = jest
      .spyOn(Animated, 'timing')
      .mockReturnValue({start, stop: jest.fn(), reset: jest.fn()});
    const failure = jest.fn();
    const loaded = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HeroArtwork
          uri="poster"
          reducedMotion={false}
          onError={failure}
          onLoad={loaded}
        />,
      );
    });
    expect(timing).not.toHaveBeenCalled();
    const image = tree.root.findByType(Image);
    await act(async () => {
      image.props.onLoad({nativeEvent: {source: {width: 600, height: 900}}});
      image.props.onLoad();
    });
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({duration: 240, useNativeDriver: true}),
    );
    expect(start).toHaveBeenCalledTimes(1);
    expect(loaded).toHaveBeenCalledWith({width: 600, height: 900});
    await act(async () => image.props.onError());
    expect(failure).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });

  it('does not run a hidden image fade when the carousel owns the whole-card transition', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const loaded = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<HeroArtwork uri="poster" reducedMotion={false}
        animateOnLoad={false} onError={() => {}} onLoad={loaded} />);
    });
    await act(async () => tree.root.findByType(Image).props.onLoad());
    expect(loaded).toHaveBeenCalledTimes(1);
    expect(timing).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it('ignores a late load after the artwork has been removed', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HeroArtwork uri="poster" reducedMotion={false} onError={() => {}} />,
      );
    });
    const lateLoad = tree.root.findByType(Image).props.onLoad;
    await act(async () => tree.unmount());
    await act(async () => lateLoad());
    expect(timing).not.toHaveBeenCalled();
  });

  it('shows loaded artwork immediately when reduced motion is enabled', async () => {
    const timing = jest
      .spyOn(Animated, 'timing')
      .mockReturnValue({start: jest.fn(), stop: jest.fn(), reset: jest.fn()});
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HeroArtwork uri="poster" reducedMotion onError={() => {}} />,
      );
    });
    await act(async () => tree.root.findByType(Image).props.onLoad());
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({duration: 0}),
    );
    await act(async () => tree.unmount());
  });
});
