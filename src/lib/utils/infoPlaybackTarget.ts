type Item = {title?: string; link?: string; episodeNumber?: number};
type Target = {episodeLink?: string; episodeTitle?: string; episodeNumber?: number};

const normalizeTitle = (title?: string) => (title || '').trim().toLowerCase();

const getEpisodeNumber = (title?: string) => {
  if (!title) {
    return undefined;
  }

  const match = title.match(/\d+/);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeNumericValue = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function resolveInfoPlaybackIndex(list: Item[], target: Target, contentType: string): number {
  if (target.episodeLink) {
    const byLink = list.findIndex(item => item.link === target.episodeLink);
    if (byLink >= 0) {
      return byLink;
    }
  }

  if (target.episodeTitle) {
    const normalizedTitle = normalizeTitle(target.episodeTitle);
    if (normalizedTitle) {
      const byTitle = list.findIndex(
        item => normalizeTitle(item.title) === normalizedTitle,
      );
      if (byTitle >= 0) {
        return byTitle;
      }
    }
  }

  if (target.episodeNumber != null) {
    const byNumber = list.findIndex(
      item =>
        (normalizeNumericValue(item.episodeNumber) ??
          getEpisodeNumber(item.title)) === target.episodeNumber,
    );
    if (byNumber >= 0) {
      return byNumber;
    }
  }

  return contentType === 'movie' && list.length === 1 && !!list[0].link ? 0 : -1;
}
