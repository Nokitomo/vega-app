import {expect, it} from '@jest/globals';
import {infoCtaKey} from '../src/lib/utils/infoCta';

const fresh = {playFromBeginning: false, canResume: false, hasEpisodeTarget: false};
it('uses the same fresh series and movie labels as the hero', () => {
  expect(infoCtaKey({type: 'series'}, fresh)).toBe('Start Watching E1');
  expect(infoCtaKey({type: 'movie'}, fresh)).toBe('Play');
  expect(infoCtaKey({type: 'series', episodesCount: 12, extra: {meta: {status: 'terminato'}}}, fresh)).toBe('Start Watching E1');
});
it('labels a next episode without treating a movie target as an episode', () => {
  expect(infoCtaKey({type: 'series'}, {...fresh, hasEpisodeTarget: true})).toBe('Play {{episode}}');
  expect(infoCtaKey({type: 'movie'}, {...fresh, hasEpisodeTarget: true})).toBe('Play');
});
it('preserves resume and restart semantics', () => {
  expect(infoCtaKey({type: 'series'}, {...fresh, canResume: true})).toBe('Resume');
  expect(infoCtaKey({type: 'movie'}, {...fresh, canResume: true})).toBe('Resume');
  expect(infoCtaKey({type: 'series'}, {...fresh, playFromBeginning: true})).toBe('Play from beginning');
});
