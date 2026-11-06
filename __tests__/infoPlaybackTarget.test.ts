import {expect, it} from '@jest/globals';
import {resolveInfoPlaybackIndex} from '../src/lib/utils/infoPlaybackTarget';

it('starts an unnumbered single movie and preserves numbered anime movies', () => {
  expect(resolveInfoPlaybackIndex([{title: 'Play', link: 'movie'}], {episodeNumber: 1}, 'movie')).toBe(0);
  expect(resolveInfoPlaybackIndex([{title: 'Complete Movie', link: 'anime', episodeNumber: 1}], {episodeNumber: 1}, 'movie')).toBe(0);
});

it('keeps resume link priority and never guesses among multiple movie parts', () => {
  const parts = [{title: 'Part A', link: 'a'}, {title: 'Part B', link: 'b'}];
  expect(resolveInfoPlaybackIndex(parts, {episodeLink: 'b', episodeTitle: 'Part A'}, 'movie')).toBe(1);
  expect(resolveInfoPlaybackIndex(parts, {episodeNumber: 1}, 'movie')).toBe(-1);
  expect(resolveInfoPlaybackIndex(parts, {episodeTitle: 'part b'}, 'movie')).toBe(1);
});

it('does not change missing series targets or accept an unavailable movie', () => {
  expect(resolveInfoPlaybackIndex([{title: 'Episode 2', link: 'e2'}], {episodeNumber: 1}, 'series')).toBe(-1);
  expect(resolveInfoPlaybackIndex([{title: 'Episode 2', link: 'e2'}], {episodeNumber: 2}, 'series')).toBe(0);
  expect(resolveInfoPlaybackIndex([], {}, 'movie')).toBe(-1);
  expect(resolveInfoPlaybackIndex([{title: 'Play'}], {}, 'movie')).toBe(-1);
});
