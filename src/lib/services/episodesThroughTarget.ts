import type {EpisodeLink, Link} from '../providers/types';
import {readMetadata, writeMetadata} from '../storage/MetadataDatabase';
import {getSeriesCatalog, type SeriesCatalogEpisode} from '../storage/SeriesCompletionStorage';
import {getEpisodesThroughTarget} from '../utils/episodesThroughTarget';
import {providerManager} from './ProviderManager';

type Options = {
  contentLink: string;
  providerValue: string;
  groups: Link[];
  activeSeasonLink?: string;
  activeEpisodes?: EpisodeLink[];
  targetLink: string;
};

/** Resolve only the seasons needed for this action; never save a partial series catalog. */
export const resolveEpisodesThroughTarget = async ({
  contentLink, providerValue, groups, activeSeasonLink, activeEpisodes, targetLink,
}: Options): Promise<SeriesCatalogEpisode[] | null> => {
  const available = groups.filter(group =>
    group.availabilityStatus !== 'upcoming' && group.seasonNumber !== 0);
  const targetGroup = available.find(group =>
    group.directLinks?.some(episode => episode.link === targetLink) ||
    (group.episodesLink === activeSeasonLink &&
      activeEpisodes?.some(episode => episode.link === targetLink)));
  if (!targetGroup) {
    return null;
  }

  const targetSeason = targetGroup.seasonNumber;
  const required = targetSeason != null && available.every(group => group.seasonNumber != null)
    ? available.filter(group => group.seasonNumber! <= targetSeason)
    : available;
  const cachedCatalog = getSeriesCatalog(contentLink);
  const cachedLinks = new Set(cachedCatalog?.episodes?.map(episode => episode.link));
  const catalogCoversRequired = required.every(group => group.episodesLink
    ? cachedCatalog?.episodes?.some(episode => episode.seasonEpisodesLink === group.episodesLink)
    : group.directLinks?.every(episode => cachedLinks.has(episode.link)));
  if (cachedCatalog?.complete && cachedLinks.has(targetLink) && catalogCoversRequired) {
    const resolved = getEpisodesThroughTarget(cachedCatalog, targetLink);
    if (resolved) {
      return resolved;
    }
  }

  const loadGroup = async (group: Link): Promise<SeriesCatalogEpisode[]> => {
    let episodes: EpisodeLink[] = [];
    if (group.episodesLink === activeSeasonLink && activeEpisodes?.length) {
      episodes = activeEpisodes;
    } else if (group.episodesLink) {
      const cached = readMetadata<EpisodeLink[]>('episodes', providerValue, group.episodesLink);
      if (cached?.value?.length) {
        episodes = cached.value;
      } else {
        episodes = await providerManager.getEpisodes({
          url: group.episodesLink, providerValue, silent: true,
        });
        if (episodes.length) {
          writeMetadata('episodes', providerValue, group.episodesLink, episodes);
        }
      }
    }
    if (!episodes.length) {
      episodes = group.directLinks || [];
    }
    if (!episodes.some(episode => !!episode.link)) {
      throw new Error('Season episodes unavailable');
    }
    return episodes.filter(episode => !!episode.link).map(episode => ({
      link: episode.link,
      title: episode.title,
      episodeNumber: episode.episodeNumber,
      seasonNumber: episode.seasonNumber ?? group.seasonNumber,
      seasonEpisodesLink: group.episodesLink,
    }));
  };
  const groupEpisodes: SeriesCatalogEpisode[][] = [];
  for (let index = 0; index < required.length; index += 3) {
    groupEpisodes.push(...await Promise.all(required.slice(index, index + 3).map(loadGroup)));
  }
  const episodes = groupEpisodes.flat();
  return getEpisodesThroughTarget({
    episodeLinks: episodes.map(episode => episode.link),
    episodes,
    complete: true,
    fullyWatched: false,
    updatedAt: Date.now(),
  }, targetLink);
};
