export type AnimeArtworkSource =
  | 'tmdb'
  | 'cinemeta'
  | 'provider'
  | 'anizip'
  | undefined;

const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const shouldFetchAniListBanner = ({
  anilistId,
  backgroundSource,
}: {
  anilistId?: number;
  backgroundSource: AnimeArtworkSource;
}) =>
  Number.isFinite(anilistId) &&
  Number(anilistId) > 0 &&
  backgroundSource !== 'provider';

export const selectAnimeUnityBackground = ({
  backgroundSource,
  providerBackground,
  aniListBanner,
  fallback,
}: {
  backgroundSource: AnimeArtworkSource;
  providerBackground?: string;
  aniListBanner?: string;
  fallback?: string;
}): string | undefined => {
  if (backgroundSource === 'provider') {
    return hasText(providerBackground)
      ? providerBackground
      : hasText(fallback)
        ? fallback
        : undefined;
  }

  if (hasText(aniListBanner)) {
    return aniListBanner;
  }
  if (hasText(providerBackground)) {
    return providerBackground;
  }
  return hasText(fallback) ? fallback : undefined;
};
