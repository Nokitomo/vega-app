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
  !backgroundSource;

export const selectAnimeUnityBackground = ({
  providerBackground,
  aniListBanner,
  fallback,
}: {
  backgroundSource: AnimeArtworkSource;
  providerBackground?: string;
  aniListBanner?: string;
  fallback?: string;
}): string | undefined => {
  if (hasText(providerBackground)) {
    return providerBackground;
  }
  if (hasText(aniListBanner)) {
    return aniListBanner;
  }
  return hasText(fallback) ? fallback : undefined;
};
