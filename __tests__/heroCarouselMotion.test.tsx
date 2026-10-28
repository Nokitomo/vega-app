import React, {act} from 'react';
import {Animated} from 'react-native';
import renderer from 'react-test-renderer';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {heroSwipeTarget, useHeroCarouselMotion} from '../src/lib/hooks/useHeroCarouselMotion';

type Options = Parameters<typeof useHeroCarouselMotion>[0];
let motion: ReturnType<typeof useHeroCarouselMotion>;
const Harness = (props: Options) => {motion = useHeroCarouselMotion(props); return null;};
let tree: renderer.ReactTestRenderer;
let animations: Array<{finish: () => void; stop: ReturnType<typeof jest.fn>}>;
const render = async (props: Partial<Options> = {}) => {
  await act(async () => {
    const element = <Harness requestedLink="first" ready active reducedMotion={false} {...props} />;
    if (tree) {tree.update(element);} else {tree = renderer.create(element);}
  });
};
beforeEach(() => {
  tree = undefined as unknown as renderer.ReactTestRenderer;
  animations = [];
  jest.spyOn(Animated, 'spring').mockImplementation((value, config) => {
    const stop = jest.fn();
    return {stop, reset: jest.fn(), start: callback => {
      animations.push({stop, finish: () => {
        (value as Animated.Value).setValue(config.toValue as number);
        callback?.({finished: true});
      }});
    }};
  });
});
afterEach(async () => {
  if (tree) {await act(async () => tree.unmount());}
  jest.restoreAllMocks();
});

describe('hero presentation transitions', () => {
  it('keeps the current card until readiness, then blends the entire old and new card', async () => {
    await render();
    expect(motion.displayedLink).toBe('first');
    expect(animations).toHaveLength(0);
    await render({requestedLink: 'second', ready: false});
    expect(motion.displayedLink).toBe('first');
    await render({requestedLink: 'second'});
    expect(motion.displayedLink).toBe('second');
    expect(motion.outgoing?.link).toBe('first');
    expect(motion.transitioning).toBe(true);
    expect(Animated.spring).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      stiffness: 1500, mass: 1, useNativeDriver: true, toValue: 1,
    }));
    await act(async () => animations[0].finish());
    expect(motion.outgoing).toBeNull();
    expect(motion.transitioning).toBe(false);
  });
  it('ignores late completion when rapid selection replaces a transition', async () => {
    await render();
    await render({requestedLink: 'second'});
    const stale = animations[0];
    await render({requestedLink: 'third'});
    expect(stale.stop).toHaveBeenCalled();
    expect(motion.outgoing?.link).toBe('second');
    // Native cancelled animations may still deliver an already queued callback.
    await act(async () => stale.finish());
    expect(motion.outgoing?.link).toBe('second');
    expect(motion.transitioning).toBe(true);
    await act(async () => animations[1].finish());
    expect(motion.displayedLink).toBe('third');
    expect(motion.outgoing).toBeNull();
  });
  it('restores opacity on a cancelled gesture and never dims beyond a carousel boundary', async () => {
    await render();
    await act(async () => {motion.beginDrag(); motion.moveDrag(100, 400, true);});
    expect(motion.dragging).toBe(true);
    expect((motion.dragOpacity as any).__getValue()).toBe(0.75);
    await act(async () => motion.endDrag());
    await act(async () => animations[0].finish());
    expect(motion.dragging).toBe(false);
    expect((motion.dragOpacity as any).__getValue()).toBe(1);
    await act(async () => {motion.beginDrag(); motion.moveDrag(100, 400, false);});
    expect((motion.dragOpacity as any).__getValue()).toBe(1);
  });
  it('ignores an old restore callback after a new drag begins', async () => {
    await render();
    await act(async () => {motion.beginDrag(); motion.moveDrag(100, 400, true); motion.endDrag();});
    const oldRestore = animations[0];
    await act(async () => {motion.beginDrag(); motion.moveDrag(200, 400, true);});
    await act(async () => oldRestore.finish());
    await render({requestedLink: 'second'});
    expect(motion.outgoing?.opacity).toBe(0.5);
  });

  it('settles safely on background and waits until active before changing the displayed card', async () => {
    await render();
    await render({requestedLink: 'second'});
    await render({requestedLink: 'third', active: false});
    expect(motion.transitioning).toBe(false);
    expect(motion.displayedLink).toBe('second');
    expect(motion.outgoing).toBeNull();
    await render({requestedLink: 'third'});
    expect(motion.displayedLink).toBe('third');
  });
  it('uses immediate changes and no drag attenuation with reduced motion', async () => {
    await render({reducedMotion: true});
    await render({requestedLink: 'second', reducedMotion: true});
    await act(async () => {motion.beginDrag(); motion.moveDrag(100, 400, true); motion.endDrag();});
    expect(motion.displayedLink).toBe('second');
    expect(motion.outgoing).toBeNull();
    expect((motion.dragOpacity as any).__getValue()).toBe(1);
    expect(animations).toHaveLength(0);
  });
});

describe('hero swipe intent', () => {
  it('accepts deliberate slow gestures and short flicks, without wrapping at the edges', () => {
    expect(heroSwipeTarget(1, 6, 400, -100, -0.1)).toBe(2);
    expect(heroSwipeTarget(1, 6, 400, 30, 0.8)).toBe(0);
    expect(heroSwipeTarget(1, 6, 400, 10, 1)).toBe(1);
    expect(heroSwipeTarget(1, 6, 400, 30, 0.1)).toBe(1);
    expect(heroSwipeTarget(0, 6, 400, 300, 1)).toBe(0);
    expect(heroSwipeTarget(5, 6, 400, -300, -1)).toBe(5);
  });
});
