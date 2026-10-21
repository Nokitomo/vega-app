import {describe, expect, it} from '@jest/globals';
import {getSkeletonPlaceholderCount} from '../src/components/sliderSkeleton';

describe('getSkeletonPlaceholderCount', () => {
  it.each([
    [320, 4],
    [393, 4],
    [768, 7],
    [1024, 9],
    [2048, 16],
  ])('covers a %ipx window with %i placeholders', (width, expected) => {
    expect(getSkeletonPlaceholderCount(width)).toBe(expected);
  });

  it('handles an unavailable width without creating an empty row', () => {
    expect(getSkeletonPlaceholderCount(0)).toBeGreaterThan(0);
    expect(getSkeletonPlaceholderCount(Number.NaN)).toBeGreaterThan(0);
  });
});
