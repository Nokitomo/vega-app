import type {EpisodeLink, Info, Link} from '../providers/types';

type Source = 'animeunity' | 'streamingunity';
type Route = {source: Source; data: {url: string; [key: string]: unknown}};

const prefix = 'streamcenter:v1';

const decodeRoute = (value: string, kind: string): Route | undefined => {
  const match = String(value || '').match(
    /^streamcenter:v1:(meta|episodes|stream):(animeunity|streamingunity):(.+)$/,
  );
  if (!match || match[1] !== kind) {return undefined;}
  try {
    const data = JSON.parse(decodeURIComponent(match[3]));
    return data && typeof data.url === 'string'
      ? {source: match[2] as Source, data}
      : undefined;
  } catch {
    return undefined;
  }
};

const encodeRoute = (
  kind: 'meta' | 'episodes' | 'stream',
  source: Source,
  data: Record<string, unknown>,
): string =>
  `${prefix}:${kind}:${source}:${encodeURIComponent(JSON.stringify(data))}`;

export const streamCenterMetaOrigin = (link: string): Route | undefined => {
  const route = decodeRoute(link, 'meta');
  if (route) {return route;}
  try {
    const host = new URL(link).hostname.toLowerCase();
    const source = /(?:^|\.)animeunity\./.test(host)
      ? 'animeunity'
      : /(?:^|\.)streamingunity\./.test(host)
        ? 'streamingunity'
        : undefined;
    return source ? {source, data: {url: link}} : undefined;
  } catch {
    return undefined;
  }
};

/** Use the original source's display rules without changing StreamCenter routing. */
export const getMetadataSourceProvider = (
  providerValue: string,
  link: string,
): string => providerValue === 'streamcenter'
  ? streamCenterMetaOrigin(link)?.source || providerValue
  : providerValue;

export const streamCenterEpisodesOrigin = (link: string): Route | undefined =>
  decodeRoute(link, 'episodes');

const wrapMetaLink = (link: string, source: Source): string =>
  /^https?:\/\//i.test(link)
    ? link
    : encodeRoute('meta', source, {url: link});

export const wrapStreamCenterInfo = (info: Info, source: Source): Info => {
  const identity =
    source === 'animeunity'
      ? {
          title: info.title,
          anilistId: info.extra?.ids?.anilistId,
          malId: info.extra?.ids?.malId,
          dubbed: Boolean(info.extra?.flags?.dub),
        }
      : {title: info.title};
  return {
    ...info,
    related: info.related?.map(item => ({
      ...item,
      link: wrapMetaLink(item.link, source),
      variants: item.variants?.map(variant => ({
        ...variant,
        link: wrapMetaLink(variant.link, source),
      })),
    })),
    linkList: info.linkList.map(group => ({
      ...group,
      episodesLink: group.episodesLink
        ? encodeRoute('episodes', source, {
            url: group.episodesLink,
            ...identity,
          })
        : undefined,
      directLinks: group.directLinks?.map(item => ({
        ...item,
        link: encodeRoute('stream', source, {url: item.link}),
      })),
    })),
  };
};

export const unwrapStreamCenterInfo = (info: Info): Info => ({
  ...info,
  related: info.related?.map(item => ({
    ...item,
    link: decodeRoute(item.link, 'meta')?.data.url || item.link,
    variants: item.variants?.map(variant => ({
      ...variant,
      link: decodeRoute(variant.link, 'meta')?.data.url || variant.link,
    })),
  })),
  linkList: info.linkList.map(
    (group): Link => ({
      ...group,
      episodesLink: group.episodesLink
        ? decodeRoute(group.episodesLink, 'episodes')?.data.url ||
          group.episodesLink
        : undefined,
      directLinks: group.directLinks?.map(item => ({
        ...item,
        link: decodeRoute(item.link, 'stream')?.data.url || item.link,
      })),
    }),
  ),
});

export const episodeIdentity = (link: string): string =>
  decodeRoute(link, 'stream')?.data.url || link;

export const unwrapStreamCenterEpisodes = (
  episodes: EpisodeLink[],
): EpisodeLink[] =>
  episodes.map(episode => ({
    ...episode,
    link: episodeIdentity(episode.link),
  }));

export const wrapStreamCenterEpisodes = (
  episodes: EpisodeLink[],
  route: Route,
): EpisodeLink[] =>
  episodes.map(episode => ({
    ...episode,
    link: encodeRoute('stream', route.source, {
      url: episode.link,
      ...(route.source === 'animeunity'
        ? {
            title: route.data.title,
            anilistId: route.data.anilistId,
            malId: route.data.malId,
            dubbed: route.data.dubbed,
            episodeNumber: episode.episodeNumber,
          }
        : {}),
    }),
  }));
