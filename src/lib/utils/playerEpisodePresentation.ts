import type {EpisodeLink} from '../providers/types';

// Presentation only: never use this fallback to change playback or metadata.
export const getPlayerEpisodeNumber = (
  episode: Partial<EpisodeLink>,
  index: number,
) => {
  if (
    typeof episode.episodeNumber === 'number' &&
    Number.isFinite(episode.episodeNumber) &&
    episode.episodeNumber >= 0
  ) {
    return episode.episodeNumber;
  }
  const match = episode.title?.match(
    /^(?:episode|episodio|ep\.?|e)\s*(\d+(?:\.\d+)?)(?:\b|$)/i,
  );
  return match ? Number(match[1]) : index + 1;
};

export const playerEpisodeTitle = (title: string, label: string) => {
  const trimmed = title.trim();
  if (
    !trimmed ||
    trimmed === label ||
    /^(?:episode|episodio|ep\.?|e)\s*\d+(?:\.\d+)?$/i.test(trimmed)
  ) {
    return label;
  }
  return `${label} \u00b7 ${trimmed}`;
};
