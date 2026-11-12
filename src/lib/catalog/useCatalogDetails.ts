import {useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import i18n from '../../i18n';
import useContentStore from '../zustand/contentStore';
import type {Info, Link} from '../providers/types';
import type {CatalogRef} from './types';
import {useCatalogStore} from './store';
import {catalogChildren, catalogWork, catalogEpisodeCount} from './reader';
import {type CatalogSource, sourceLink, syncCatalogSeries, workImages, workTitle} from './content';
import {registerCatalogIdentity, sourceIdentity} from './identity';

const labels = (value: unknown): string[] => Array.isArray(value)
  ? value.flatMap(item => {
      const label = typeof item === 'string' ? item : item?.name;
      return typeof label === 'string' ? [label] : [];
    }) : [];
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export function useCatalogDetails(ref: CatalogRef | undefined, sourceHint: string, resume: boolean) {
  const installed = useCatalogStore(s => s.installed);
  const generation = useCatalogStore(s => s.generation);
  const installedProviders = useContentStore(s => s.installedProviders);
  const [selection, setSelection] = useState({workId: '', sourceId: ''});
  const query = useQuery({
    queryKey: ['catalog-details', installed?.revision, generation, ref?.workId, i18n.language],
    enabled: !!ref && !!installed,
    queryFn: async () => {
      const work = await catalogWork(ref!.workId);
      const [sources, seasons, poster, background, logo, episodesCount] = await Promise.all([
        catalogChildren<CatalogSource>('source', work.id),
        catalogChildren<{number: number}>('season', work.id),
        workImages(work, 'poster'), workImages(work, 'background'), workImages(work, 'logo'),
        work.payload.info.type === 'movie' ? Promise.resolve(0) : catalogEpisodeCount(work.id),
      ]);
      const compatible = sources.filter(s => s.payload.provider === 'streamingunity' && s.payload.availability === 'present');
      registerCatalogIdentity({catalogId: 'cinema', workId: work.id},
        compatible.map(s => sourceLink(s.payload)), compatible.map(s => `streamingunity:${s.payload.id}`));
      return {work, sources: compatible, seasons, episodesCount, artwork: {poster, background, logo}};
    },
    staleTime: Infinity,
  });
  const sources = useMemo(() => query.data?.sources.filter(s => installedProviders.some(p => p.value === s.payload.provider)) || [], [query.data, installedProviders]);
  const source = sources.find(s => selection.workId === ref?.workId && s.id === selection.sourceId)
    || (resume && sourceIdentity(sourceHint) ? sources.find(s => sourceIdentity(sourceLink(s.payload)) === sourceIdentity(sourceHint)) : undefined)
    || (sources.length === 1 ? sources[0] : undefined);
  useEffect(() => {
    if (query.data && source && query.data.work.payload.info.type !== 'movie') {
      syncCatalogSeries(query.data.work, source).catch(() => undefined);
    }
  }, [query.data, source]);
  const info = useMemo<Info | undefined>(() => {
    if (!query.data) {return undefined;}
    const {work, seasons, artwork} = query.data;
    const raw = work.payload.info;
    const ids = work.payload.sourceIds || {};
    const movie = raw.type === 'movie';
    const numberId = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? [Number(value)] : undefined;
    const imdbId = text(ids.imdb || ids.imdb_id);
    const linkList: Link[] = !source ? [] : movie
      ? [{title: workTitle(work.payload), directLinks: [{title: workTitle(work.payload), link: sourceLink(source.payload), type: 'movie'}]}]
      : seasons.map(season => ({
          title: i18n.t('catalog.season', {number: season.payload.number}),
          seasonNumber: season.payload.number,
          catalogSeasonRef: {workId: work.id, sourceId: source.id, seasonId: season.id},
        }));
    return {
      title: workTitle(work.payload), type: movie ? 'movie' : 'series',
      synopsis: text(raw.synopsis), imdbId,
      image: artwork.poster[0] || '', poster: artwork.poster[0],
      background: artwork.background[0], logo: artwork.logo[0],
      year: text(raw.year), runtime: /^\d+(?:\.\d+)?$/.test(text(raw.runtime))
        ? i18n.t('catalog.runtimeMinutes', {count: Number(raw.runtime)}) : text(raw.runtime),
      rating: text(raw.rating), episodesCount: movie ? undefined : query.data.episodesCount,
      genres: labels(raw.genres), cast: labels(raw.cast),
      country: text(raw.country), director: text(raw.director),
      trailers: labels(raw.trailers), linkList,
      extra: {ids: movie ? {
        imdbMovieIds: imdbId ? [imdbId] : undefined,
        tmdbMovieIds: numberId(ids.tmdb || ids.tmdb_id), tvdbMovieIds: numberId(ids.tvdb || ids.tvdb_id),
      } : {
        imdbShowIds: imdbId ? [imdbId] : undefined,
        tmdbShowIds: numberId(ids.tmdb || ids.tmdb_id), tvdbShowIds: numberId(ids.tvdb || ids.tvdb_id),
      }},
    };
  }, [query.data, source]);
  return {
    info, sources, source, artwork: query.data?.artwork,
    link: source ? sourceLink(source.payload) : ref?.workId || '',
    provider: source?.payload.provider || '',
    selectSource: (sourceId: string) => setSelection({workId: ref?.workId || '', sourceId}),
    isLoading: query.isLoading,
    error: query.error || (ref && !installed ? new Error('catalog.notInstalled') : undefined),
    refetch: query.refetch,
  };
}
