import type {SeriesCatalog, SeriesCatalogEpisode} from '../storage/SeriesCompletionStorage';

/** Returns null when the provider data cannot safely define the range. */
export const getEpisodesThroughTarget = (
  catalog: SeriesCatalog | undefined,
  targetLink: string,
): SeriesCatalogEpisode[] | null => {
  if (!catalog?.complete || !catalog.episodes?.length || !targetLink) {
    return null;
  }
  const target = catalog.episodes.find(episode => episode.link === targetLink);
  if (!target || target.seasonNumber === 0) {
    return null;
  }
  const regular = catalog.episodes.filter(episode => episode.seasonNumber !== 0);
  const groups = new Set(regular.map(episode => episode.seasonEpisodesLink || 'direct'));
  if (groups.size > 1 && regular.some(episode => episode.seasonNumber == null)) {
    return null;
  }
  const ordered = regular.map((episode, index) => ({episode, index}));
  ordered.sort((left, right) => {
    const leftSeason = left.episode.seasonNumber;
    const rightSeason = right.episode.seasonNumber;
    if (leftSeason != null && rightSeason != null && leftSeason !== rightSeason) {
      return leftSeason - rightSeason;
    }
    if (left.episode.seasonEpisodesLink === right.episode.seasonEpisodesLink &&
        left.episode.episodeNumber != null && right.episode.episodeNumber != null) {
      return left.episode.episodeNumber - right.episode.episodeNumber;
    }
    return left.index - right.index;
  });
  const targetIndex = ordered.findIndex(item => item.episode.link === targetLink);
  return targetIndex < 0
    ? null
    : ordered.slice(0, targetIndex + 1).map(item => item.episode);
};
