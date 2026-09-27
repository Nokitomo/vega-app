import type {
  ArtworkCandidate,
  ArtworkSource,
  Info,
} from '../providers/types';

type EnhancedArtwork = {
  logo?: string;
  poster?: string;
  background?: string;
  banner?: string;
};

export type ArtworkCandidates = {
  logo: string[];
  poster: string[];
  background: string[];
};

const normalizeUrl = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const uniqueUrls = (...values: unknown[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];

  values.forEach(value => {
    const normalized = normalizeUrl(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    output.push(normalized);
  });

  return output;
};

const isExternallySelectedLogo = (source?: ArtworkSource): boolean =>
  source === 'tmdb' ||
  source === 'tvdb' ||
  source === 'cinemeta' ||
  source === 'anizip';

const urlsForSources = (
  candidates: ArtworkCandidate[] | undefined,
  sources: ArtworkSource[],
): string[] =>
  sources.flatMap(source =>
    (candidates || [])
      .filter(candidate => candidate?.source === source)
      .map(candidate => candidate.url),
  );

export const isSvgArtworkUri = (uri?: string): boolean => {
  const normalized = normalizeUrl(uri);
  if (!normalized) {
    return false;
  }
  return /\.svg(?:$|[?#])/i.test(normalized);
};

export const selectArtworkCandidates = ({
  providerValue,
  info,
  enhanced,
  activePoster,
}: {
  providerValue: string;
  info?: Info;
  enhanced?: EnhancedArtwork;
  activePoster?: string;
}): ArtworkCandidates => {
  if (providerValue === 'animeunity') {
    return {
      logo: uniqueUrls(info?.logo),
      poster: uniqueUrls(
        info?.poster,
        enhanced?.poster,
        activePoster,
        info?.image,
      ),
      background: uniqueUrls(
        info?.background,
        enhanced?.banner,
        info?.image,
      ),
    };
  }

  const logoSource = info?.extra?.artworkSources?.logo;
  const providerCandidates = info?.extra?.artworkCandidates;
  const explicitLogoCandidates = providerCandidates?.logo || [];
  const logo = explicitLogoCandidates.length
    ? uniqueUrls(
        ...urlsForSources(explicitLogoCandidates, ['tmdb', 'tvdb']),
        enhanced?.logo,
        ...urlsForSources(explicitLogoCandidates, ['provider']),
        info?.logo,
      )
    : isExternallySelectedLogo(logoSource)
      ? uniqueUrls(info?.logo, enhanced?.logo)
      : uniqueUrls(enhanced?.logo, info?.logo);

  const explicitPosterCandidates = urlsForSources(
    providerCandidates?.poster,
    ['provider', 'tmdb', 'tvdb'],
  );
  const explicitBackgroundCandidates = urlsForSources(
    providerCandidates?.background,
    ['provider', 'tmdb', 'tvdb'],
  );

  return {
    logo,
    poster: uniqueUrls(
      ...explicitPosterCandidates,
      info?.poster,
      activePoster,
      info?.image,
      enhanced?.poster,
    ),
    background: uniqueUrls(
      ...explicitBackgroundCandidates,
      info?.background,
      enhanced?.background,
      info?.image,
      info?.poster,
      activePoster,
    ),
  };
};
