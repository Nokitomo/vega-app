import type {EpisodeLink} from '../providers/types';

export const needsPrePlayRefresh = (provider: string): boolean =>
  provider === 'animeunity' ||
  provider === 'streamingunity' ||
  provider === 'streamcenter';

/** Keep the tapped episode stable while a pre-play inventory check updates the queue. */
export const resolvePrePlayEpisodes = <T extends EpisodeLink>(
  selected: T[],
  selectedIndex: number,
  currentSeason: EpisodeLink[],
  refreshed?: EpisodeLink[],
  descending = false,
): {episodes: EpisodeLink[]; index: number} => {
  const selectedLink = selected[selectedIndex]?.link;
  if (!selectedLink || !refreshed?.some(item => item.link === selectedLink)) {
    return {episodes: selected, index: selectedIndex};
  }

  const currentLinks = new Set(currentSeason.map(item => item.link));
  const isFullSeason = selected.length === currentLinks.size &&
    selected.every(item => currentLinks.has(item.link));
  const refreshedByLink = new Map(refreshed.map(item => [item.link, item]));
  const episodes = isFullSeason
    ? descending ? [...refreshed].reverse() : refreshed
    : selected.map(item => refreshedByLink.get(item.link) || item);
  const index = episodes.findIndex(item => item.link === selectedLink);
  return index >= 0
    ? {episodes, index}
    : {episodes: selected, index: selectedIndex};
};
