const PREFERRED_RETRY_MS = 24 * 60 * 60 * 1000;

export type WorkingLogo = {url: string; preferredUrl: string};

export const validLogoUrl = (url: unknown): url is string =>
  typeof url === 'string' &&
  /^https:\/\//i.test(url.trim()) &&
  url.trim().length <= 2048;

export const orderedLogoUrls = (
  candidates: string[],
  saved: {value: WorkingLogo; updatedAt: number} | undefined,
  now: number,
): string[] => {
  const available = candidates
    .filter((url): url is string => typeof url === 'string')
    .map(url => url.trim())
    .filter(Boolean);
  const preferred = available[0];
  const savedUrl =
    saved?.value.preferredUrl === preferred && validLogoUrl(saved.value.url)
      ? saved.value.url.trim()
      : undefined;
  const useSavedFirst =
    !!savedUrl && !!saved && now - saved.updatedAt < PREFERRED_RETRY_MS;
  return Array.from(
    new Set(
      (useSavedFirst
        ? [savedUrl, ...available]
        : [...available, savedUrl]
      ).filter((url): url is string => !!url),
    ),
  );
};
