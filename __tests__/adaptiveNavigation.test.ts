import {describe, expect, it} from '@jest/globals';
import {getAdaptiveNavigation} from '../src/lib/utils/adaptiveNavigation';

describe('Bottom navigation independently of rotation permission', () => {
  it('keeps phone tabs distributed even in landscape', () => {
    expect(getAdaptiveNavigation(915, 915, 412)).toEqual({
      isTabletDevice: false, useSideTabLayout: false, tabBarHorizontalPadding: 0,
    });
  });
  it('widens the tablet group for larger text but never beyond the window', () => {
    expect(getAdaptiveNavigation(800, 800, 1280, 1.5).tabBarHorizontalPadding).toBe(100);
    expect(getAdaptiveNavigation(500, 800, 1280, 2).tabBarHorizontalPadding).toBe(0);
  });
  it.each([350, 600, 800, 900, 1280])('centers tablet tabs without overflowing a %i dp window', width => {
    const layout = getAdaptiveNavigation(width, 1280, 800);
    expect(layout.isTabletDevice).toBe(true);
    expect(layout.useSideTabLayout).toBe(false);
    const itemWidth = (width - layout.tabBarHorizontalPadding * 2) / 4;
    expect(itemWidth).toBeGreaterThanOrEqual(48);
    expect(itemWidth).toBeLessThanOrEqual(100);
  });
});
