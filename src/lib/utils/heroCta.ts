import type {Info} from '../providers/types';

// Available streams/seasons are not a reliable count of the complete work.
export const heroCtaKey = (info?: Partial<Info>): 'Play' | 'Start Watching E1' => {
  const type = info?.type?.trim().toLowerCase();
  if (!['series', 'tv', 'tv_series'].includes(type || '')) {
    return 'Play';
  }
  const status = info?.extra?.meta?.status?.trim().toLowerCase();
  const completed = ['finished', 'completed', 'ended', 'concluso', 'completato', 'terminato'].includes(status || '');
  return info?.episodesCount === 1 && completed ? 'Play' : 'Start Watching E1';
};
