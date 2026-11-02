import type {Info} from '../providers/types';
import {heroCtaKey} from './heroCta';

export function infoCtaKey(info: Partial<Info>, options: {
  playFromBeginning: boolean; canResume: boolean; hasEpisodeTarget: boolean;
}) {
  if (options.playFromBeginning) {return 'Play from beginning';}
  if (options.canResume) {return 'Resume';}
  const startKey = heroCtaKey(info);
  return startKey !== 'Play' && options.hasEpisodeTarget ? 'Play {{episode}}' : startKey;
}
