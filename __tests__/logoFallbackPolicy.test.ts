import {describe, expect, it} from '@jest/globals';
import {
  orderedLogoUrls,
  validLogoUrl,
} from '../src/lib/services/logoFallbackPolicy';

describe('logo fallback policy', () => {
  const preferred = 'https://logos.test/preferred.png';
  const fallback = 'https://logos.test/fallback.png';

  it('validates new URLs without changing existing provider candidate order', () => {
    expect(validLogoUrl('file:///logo.png')).toBe(false);
    expect(validLogoUrl('https://logos.test/logo.png')).toBe(true);
    expect(
      orderedLogoUrls([preferred, fallback, preferred, 'file:///logo'], undefined, 0),
    ).toEqual([preferred, fallback, 'file:///logo']);
  });

  it('keeps the Hero usable before any logo candidate or saved fallback exists', () => {
    expect(orderedLogoUrls([], undefined, 0)).toEqual([]);
    expect(orderedLogoUrls(['', '  '], undefined, 0)).toEqual([]);
  });

  it('shows a working fallback first, then retries the preferred logo after a day', () => {
    const saved = {
      value: {url: fallback, preferredUrl: preferred},
      updatedAt: 1000,
    };
    expect(orderedLogoUrls([preferred], saved, 1000 + 60_000)).toEqual([
      fallback,
      preferred,
    ]);
    expect(
      orderedLogoUrls([preferred], saved, 1000 + 24 * 60 * 60 * 1000),
    ).toEqual([preferred, fallback]);
  });

  it('discards an override when the provider selects a different preferred logo', () => {
    const saved = {
      value: {url: fallback, preferredUrl: preferred},
      updatedAt: 1000,
    };
    expect(
      orderedLogoUrls(['https://logos.test/new.png'], saved, 2000),
    ).toEqual(['https://logos.test/new.png']);
  });
});
