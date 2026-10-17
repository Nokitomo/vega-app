import {EpisodeLink, Link} from '../providers/types';
import {readMetadata} from '../storage/MetadataDatabase';
import {setSeriesCatalog} from '../storage/SeriesCompletionStorage';
import {providerManager} from './ProviderManager';

const EPISODE_CACHE_FRESH_MS = 4 * 60 * 60 * 1000;
const syncGenerations = new Map<string, number>();

export const syncSeriesCatalog = async ({
  contentLink,
  providerValue,
  groups,
  activeSeasonLink,
  activeEpisodes,
}: {
  contentLink: string;
  providerValue: string;
  groups: Link[];
  activeSeasonLink?: string;
  activeEpisodes?: EpisodeLink[];
}): Promise<void> => {
  const generation = (syncGenerations.get(contentLink) || 0) + 1;
  syncGenerations.set(contentLink, generation);
  const episodeLinks: string[] = [];
  let complete = true;

  for (const group of groups) {
    if (group.availabilityStatus === 'upcoming') {
      continue;
    }
    let episodes: Array<{link: string}> = [];
    if (group.episodesLink) {
      if (group.episodesLink === activeSeasonLink && activeEpisodes?.length) {
        episodes = activeEpisodes;
      } else {
        const cached = readMetadata<EpisodeLink[]>(
          'episodes',
          providerValue,
          group.episodesLink,
        );
        if (cached && Date.now() - cached.checkedAt < EPISODE_CACHE_FRESH_MS) {
          episodes = cached.value;
        } else {
          try {
            episodes = await providerManager.getEpisodes({
              url: group.episodesLink,
              providerValue,
            });
          } catch {
            complete = false;
            episodes = cached?.value || [];
          }
        }
      }
      if (episodes.length === 0 && group.directLinks?.length) {
        episodes = group.directLinks;
      }
    } else {
      episodes = group.directLinks || [];
    }
    const playable = episodes.filter(episode => !!episode?.link);
    if (playable.length === 0) {
      complete = false;
    }
    episodeLinks.push(...playable.map(episode => episode.link));
  }

  if (syncGenerations.get(contentLink) === generation) {
    setSeriesCatalog(contentLink, episodeLinks, complete);
  }
};
