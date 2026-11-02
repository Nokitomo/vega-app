import {describe, expect, it} from '@jest/globals';
import {getHomeCardWidth, getHomeHeroLayout} from '../src/components/homePresentation';

describe('home responsive bounds', () => {
  it('uses the reference phone aspect ratio when the text budget fits', () => {
    const layout = getHomeHeroLayout(411, 914, 1, 24);
    expect(layout.frameHeight).toBe(Math.ceil(411 * 1.5));
  });
  it.each([1, 1.3, 1.5, 2, 3])(
    'reserves room for all text and actions at font scale %s without depending on a slide',
    scale => {
      for (const [width, height] of [[280, 640], [411, 914]]) {
        const layout = getHomeHeroLayout(width, height, scale, 32);
        expect(layout.frameHeight - 32 - 56).toBeGreaterThanOrEqual(layout.contentBudget + 32);
        expect(layout.frameHeight).toBeGreaterThanOrEqual(
          getHomeHeroLayout(width, height, 1, 32).frameHeight,
        );
      }
    },
  );
  it.each([[280, 640], [411, 914], [800, 1280], [1280, 800], [1600, 900]])(
    'keeps content and all six indicators inside %i x %i',
    (width, height) => {
      const layout = getHomeHeroLayout(width, height);
      expect(layout.contentWidth).toBeLessThanOrEqual(width);
      expect(layout.indicatorWidth * 6 + 8 * 5 + 2 * layout.inset).toBeLessThanOrEqual(width);
      expect(getHomeCardWidth(width)).toBeLessThan(width / 2);
      expect(layout.minHeight).toBeLessThan(height);
    },
  );
  it('uses a wide tablet hero in both orientations and grows for measured accessible content', () => {
    const portrait = getHomeHeroLayout(800, 1280);
    const landscape = getHomeHeroLayout(1280, 800);
    expect(portrait.frameHeight).toBe(400);
    expect(landscape.frameHeight).toBe(640);
    expect(portrait.contentWidth).toBe(400);
    for (const [width, height] of [[600, 960], [800, 1280], [1280, 800]]) {
      const expanded = getHomeHeroLayout(width, height, 2, 32, 700);
      expect(expanded.frameHeight).toBeGreaterThanOrEqual(32 + 56 + 16 + 700);
    }
  });
  it('keeps tablet catalog density consistent across rotation without changing phone cards', () => {
    expect(getHomeCardWidth(800)).toBe(getHomeCardWidth(1280));
    expect(getHomeCardWidth(800)).toBe(146);
    expect(getHomeCardWidth(411)).toBeCloseTo(411 * 0.37);
  });
});
