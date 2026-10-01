type ExternalIds = {
  malId?: number;
  anilistId?: number;
  malIds?: number[];
  anilistIds?: number[];
};

const positiveNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
};

export const resolveAnimeExternalIds = (ids?: ExternalIds) => ({
  malId: positiveNumber(ids?.malId, ids?.malIds?.[0]),
  anilistId: positiveNumber(ids?.anilistId, ids?.anilistIds?.[0]),
});
