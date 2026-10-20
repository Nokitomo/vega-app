import {queryClient} from '../client';
import type {EpisodeLink, Info} from '../providers/types';
import {
  markMetadataChecked,
  metadataIdentity,
  readMetadata,
  writeMetadata,
  type MetadataRecord,
} from '../storage/MetadataDatabase';
import {extensionManager} from './ExtensionManager';
import {
  streamCenterEpisodesOrigin,
  streamCenterMetaOrigin,
  unwrapStreamCenterEpisodes,
  unwrapStreamCenterInfo,
  wrapStreamCenterEpisodes,
  wrapStreamCenterInfo,
} from './streamCenterMetadata';

export const animeMetaSourceLink = (provider: string, link: string): string | undefined => {
  if (provider === 'animeunity') {return link;}
  if (provider !== 'streamcenter') {return undefined;}
  const origin = streamCenterMetaOrigin(link);
  return origin?.source === 'animeunity' ? origin.data.url : undefined;
};

export const animeEpisodesSourceLink = (provider: string, link: string): string | undefined => {
  if (provider === 'animeunity') {return link;}
  if (provider !== 'streamcenter') {return undefined;}
  const origin = streamCenterEpisodesOrigin(link);
  return origin?.source === 'animeunity' ? origin.data.url : undefined;
};

const sourceVersion = () =>
  extensionManager.getProviderModules('animeunity')?.version || '';

const synchronizeQueries = <T>(
  kind: 'contentInfo' | 'episodes',
  sourceLink: string,
  value: T,
  wrap: (value: T, route: NonNullable<ReturnType<typeof streamCenterMetaOrigin>>) => T,
) => {
  const sourceIdentity = kind === 'contentInfo'
    ? metadataIdentity('animeunity', sourceLink)
    : sourceLink;
  for (const query of queryClient.getQueryCache().findAll({queryKey: [kind]})) {
    const [queryKind, link, provider] = query.queryKey;
    if (queryKind !== kind || typeof link !== 'string' || typeof provider !== 'string') {
      continue;
    }
    const targetLink = kind === 'contentInfo'
      ? animeMetaSourceLink(provider, link)
      : animeEpisodesSourceLink(provider, link);
    if (!targetLink || (kind === 'contentInfo'
      ? metadataIdentity('animeunity', targetLink) !== sourceIdentity
      : targetLink !== sourceIdentity)) {
      continue;
    }
    if (query.state.data === undefined) {continue;}
    const route = kind === 'contentInfo'
      ? streamCenterMetaOrigin(link)
      : streamCenterEpisodesOrigin(link);
    queryClient.setQueryData(query.queryKey, provider === 'streamcenter' && route
      ? wrap(value, route)
      : value);
  }
};

export const readSharedAnimeInfo = (
  provider: string,
  link: string,
): MetadataRecord<Info> | undefined => {
  const own = readMetadata<Info>('contentInfo', provider, link);
  const sourceLink = animeMetaSourceLink(provider, link);
  if (provider !== 'streamcenter' || !sourceLink) {return own;}
  const source = readMetadata<Info>('contentInfo', 'animeunity', sourceLink);
  return source && (!own || source.updatedAt >= own.updatedAt)
    ? {...source, value: wrapStreamCenterInfo(source.value, 'animeunity')}
    : own;
};

export const writeSharedAnimeInfo = (
  provider: string,
  link: string,
  info: Info,
  version = '',
) => {
  writeMetadata('contentInfo', provider, link, info, version);
  const sourceLink = animeMetaSourceLink(provider, link);
  if (!sourceLink) {return;}
  const sourceInfo = provider === 'streamcenter' ? unwrapStreamCenterInfo(info) : info;
  if (provider === 'streamcenter') {
    writeMetadata('contentInfo', 'animeunity', sourceLink, sourceInfo, sourceVersion());
  }
  synchronizeQueries('contentInfo', sourceLink, sourceInfo, (value, route) =>
    wrapStreamCenterInfo(value, route.source));
};

export const markSharedAnimeInfoChecked = (
  provider: string,
  link: string,
  version = '',
) => {
  markMetadataChecked('contentInfo', provider, link, version);
  const sourceLink = animeMetaSourceLink(provider, link);
  if (provider === 'streamcenter' && sourceLink) {
    markMetadataChecked('contentInfo', 'animeunity', sourceLink, sourceVersion());
  }
};

export const readSharedAnimeEpisodes = (
  provider: string,
  link: string,
): MetadataRecord<EpisodeLink[]> | undefined => {
  const own = readMetadata<EpisodeLink[]>('episodes', provider, link);
  const route = provider === 'streamcenter' ? streamCenterEpisodesOrigin(link) : undefined;
  if (route?.source !== 'animeunity') {return own;}
  const source = readMetadata<EpisodeLink[]>('episodes', 'animeunity', route.data.url);
  return source && (!own || source.updatedAt >= own.updatedAt)
    ? {...source, value: wrapStreamCenterEpisodes(source.value, route)}
    : own;
};

export const writeSharedAnimeEpisodes = (
  provider: string,
  link: string,
  episodes: EpisodeLink[],
  version = '',
) => {
  const route = provider === 'streamcenter' ? streamCenterEpisodesOrigin(link) : undefined;
  const durable = route
    ? wrapStreamCenterEpisodes(unwrapStreamCenterEpisodes(episodes), route)
    : episodes;
  writeMetadata('episodes', provider, link, durable, version);
  const sourceLink = animeEpisodesSourceLink(provider, link);
  if (!sourceLink) {return;}
  const sourceEpisodes = provider === 'streamcenter'
    ? unwrapStreamCenterEpisodes(episodes)
    : episodes;
  if (provider === 'streamcenter') {
    writeMetadata('episodes', 'animeunity', sourceLink, sourceEpisodes, sourceVersion());
  }
  synchronizeQueries('episodes', sourceLink, sourceEpisodes, (value, episodeRoute) =>
    wrapStreamCenterEpisodes(value, episodeRoute));
};

export const markSharedAnimeEpisodesChecked = (
  provider: string,
  link: string,
  version = '',
) => {
  markMetadataChecked('episodes', provider, link, version);
  const sourceLink = animeEpisodesSourceLink(provider, link);
  if (provider === 'streamcenter' && sourceLink) {
    markMetadataChecked('episodes', 'animeunity', sourceLink, sourceVersion());
  }
};
