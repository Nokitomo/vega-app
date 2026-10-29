import {describe, expect, it} from '@jest/globals';
import {heroCtaKey} from '../src/lib/utils/heroCta';

describe('hero CTA classification', () => {
  it('keeps movies and unknown metadata generic', () => {
    expect(heroCtaKey()).toBe('Play');
    expect(heroCtaKey({type: 'movie', episodesCount: 1})).toBe('Play');
    expect(heroCtaKey({type: 'unknown'})).toBe('Play');
  });
  it('does not mistake the only released episode for a standalone work', () => {
    expect(heroCtaKey({type: 'series', episodesCount: 1})).toBe('Start Watching E1');
    expect(heroCtaKey({type: 'series', episodesCount: 1, extra: {meta: {status: 'ongoing'}}})).toBe('Start Watching E1');
  });
  it('uses Play for a confirmed completed single episode', () => {
    expect(heroCtaKey({type: 'series', episodesCount: 1, extra: {meta: {status: 'Finished'}}})).toBe('Play');
    expect(heroCtaKey({type: 'series', episodesCount: 12, extra: {meta: {status: 'Finished'}}})).toBe('Start Watching E1');
  });
});
