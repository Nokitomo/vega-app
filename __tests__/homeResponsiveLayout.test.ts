import {describe, expect, it} from '@jest/globals';
import {getHomeCardWidth, getHomeHeroLayout} from '../src/components/homePresentation';

describe('home responsive bounds', () => {
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
  it('does not grow the landscape artwork spacer with tablet width', () => {
    const portrait = getHomeHeroLayout(800, 1280);
    const landscape = getHomeHeroLayout(1280, 800);
    expect(portrait.tablet && landscape.tablet).toBe(true);
    expect(landscape.spacer).toBeLessThan(portrait.spacer);
    expect(landscape.contentWidth).toBeLessThan(1280 / 2);
    expect(landscape.minHeight).toBeLessThan(portrait.minHeight);
  });
});
