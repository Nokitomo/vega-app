import {describe, expect, it} from '@jest/globals';
import {getAdaptiveNavigation} from '../src/lib/utils/adaptiveNavigation';

describe('Navigation follows available space independently of rotation permission', () => {
  it('keeps phone tabs even in landscape', () => {
    expect(getAdaptiveNavigation(915, 915, 412)).toEqual({
      isTabletDevice: false,
      useSideTabLayout: false,
    });
  });
  it('uses tablet tabs in portrait and narrow windows and a rail in wide windows', () => {
    for (const width of [400, 600, 800, 899]) {
      expect(getAdaptiveNavigation(width, 800, 1280)).toEqual({
        isTabletDevice: true,
        useSideTabLayout: false,
      });
    }
    for (const width of [900, 1100, 1280]) {
      expect(getAdaptiveNavigation(width, 1280, 800)).toEqual({
        isTabletDevice: true,
        useSideTabLayout: true,
      });
    }
  });
  it('keeps device classification in a narrow split window', () => {
    expect(getAdaptiveNavigation(350, 1280, 800).isTabletDevice).toBe(true);
  });
});
