import type {EpisodeLink} from '../providers/types';

export type EpisodeReconciliation = {
  episodes: EpisodeLink[];
  added: string[];
  missing: string[];
  confirmedRemoved: string[];
};

const sameIds = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

/** Never delete an episode on a single successful provider inventory. */
export const reconcileEpisodes = (
  cached: EpisodeLink[],
  inventory: EpisodeLink[],
  priorMissing: string[] = [],
  identity: (link: string) => string = link => link,
): EpisodeReconciliation => {
  const cachedByLink = new Map(
    cached.map(episode => [identity(episode.link), episode]),
  );
  const liveByLink = new Map(
    inventory.map(episode => [identity(episode.link), episode]),
  );
  const added = inventory
    .filter(episode => !cachedByLink.has(identity(episode.link)))
    .map(episode => identity(episode.link));
  const missing = cached
    .filter(episode => !liveByLink.has(identity(episode.link)))
    .map(episode => identity(episode.link))
    .sort();
  const confirmedRemoved =
    missing.length > 0 && sameIds(missing, [...priorMissing].sort())
      ? missing
      : [];
  const removed = new Set(confirmedRemoved);
  const episodes = cached
    .filter(episode => !removed.has(identity(episode.link)))
    .map(episode => {
      const live = liveByLink.get(identity(episode.link));
      return live
        ? {
            ...episode,
            link: live.link,
            episodeNumber: live.episodeNumber,
            sourceEpisodeNumber: live.sourceEpisodeNumber,
            sourceEpisodeEndNumber: live.sourceEpisodeEndNumber,
            seasonNumber: live.seasonNumber,
          }
        : episode;
    });
  for (const live of inventory) {
    if (!cachedByLink.has(identity(live.link))) {
      episodes.push(live);
    }
  }
  if (episodes.every(episode => episode.episodeNumber != null)) {
    episodes.sort(
      (left, right) => left.episodeNumber! - right.episodeNumber!,
    );
  }
  return {episodes, added, missing, confirmedRemoved};
};
