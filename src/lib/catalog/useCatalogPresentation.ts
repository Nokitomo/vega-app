import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {useQueries, useQuery} from '@tanstack/react-query';
import {useCatalogStore} from './store';
import {catalogList, catalogWork} from './reader';
import {loadCatalogPosts} from './presentation';
import {workImages, workTitle} from './content';
import type {CatalogRef, CatalogSection} from './types';
import type {HomePageData} from '../hooks/useHomePageData';
import {cinemaHeroDay, loadCinemaHeroRotation} from './heroRotation';

export const catalogSearchSection: CatalogSection = {
  id: 'search', title: '', enabled: true, type: '', genres: [], sort: 'title',
};

export function useCatalogHome(enabled: boolean) {
  const installed = useCatalogStore(s => s.installed);
  const generation = useCatalogStore(s => s.generation);
  const preferences = useCatalogStore(s => s.preferences);
  const [activated, setActivated] = useState<string[]>([]);
  const sections = useMemo(() => preferences.sections.filter(s => s.enabled), [preferences.sections]);
  const heroSection = sections.find(s => s.id === preferences.heroSection) || sections[0];
  const [heroDay, setHeroDay] = useState(cinemaHeroDay);
  useEffect(() => {
    if (!enabled || !installed?.format) {return;}
    const sync = () => setHeroDay(cinemaHeroDay());
    sync();
    const timer = setInterval(sync, 15000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {sync();}
    });
    return () => {clearInterval(timer); subscription.remove();};
  }, [enabled, installed?.format]);
  const rotation = useQuery({
    queryKey: ['cinema-hero-rotation', installed?.revision, generation, heroDay],
    enabled: enabled && !!installed?.format,
    queryFn: () => loadCinemaHeroRotation(new Date(), installed!.revision, generation),
    staleTime: Infinity,
  });
  const queries = useQueries({queries: sections.map((section, index) => ({
    queryKey: ['catalog-home-posts', installed?.revision, generation, section],
    enabled: enabled && !!installed && (index < 4 || (!installed.format && section === heroSection) || activated.includes(section.id)),
    queryFn: async () => loadCatalogPosts(await catalogList(section)),
    staleTime: Infinity,
  }))});
  const refresh = useRef<() => Promise<unknown>>(async () => {});
  refresh.current = () => Promise.all(queries.filter((_, index) =>
    index < 4 || (!installed?.format && sections[index] === heroSection) || activated.includes(sections[index].id),
  ).map(query => query.refetch()));
  const refetch = useCallback(() => refresh.current(), []);
  const activateCategories = useCallback((ids: string[]) => {
    setActivated(previous => ids.every(id => previous.includes(id)) ? previous : [...new Set([...previous, ...ids])]);
  }, []);
  const data: HomePageData[] = sections.map((section, index) => ({
    title: section.title,
    titleKey: section.title ? undefined : `catalog.section.${section.id}`,
    filter: section.id,
    catalogSection: section,
    Posts: queries[index].data || [],
    isLoading: queries[index].isPending,
    error: queries[index].error?.message,
  }));
  return {
    data,
    heroPosts: installed?.format ? rotation.data ?? [] : data.find(section => section.filter === heroSection?.id)?.Posts || [],
    heroDay: installed?.format ? heroDay : '',
    isLoading: queries.some(q => q.isLoading),
    isRefetching: queries.some(q => q.isRefetching),
    error: queries.find(q => q.error)?.error,
    activateCategories,
    refetch,
  };
}

export function useCatalogHero(ref?: CatalogRef) {
  const installed = useCatalogStore(s => s.installed);
  const generation = useCatalogStore(s => s.generation);
  return useQuery({
    queryKey: ['catalog-hero', installed?.revision, generation, ref?.workId],
    enabled: !!ref && !!installed,
    queryFn: async () => {
      const work = await catalogWork(ref!.workId);
      const [poster, background, logo] = await Promise.all(
        (['poster', 'background', 'logo'] as const).map(field => workImages(work, field)),
      );
      const info = work.payload.info;
      const tags = Array.isArray(info.genres) ? info.genres.flatMap(value => {
        const label = typeof value === 'string' ? value : value?.name;
        return typeof label === 'string' ? [label] : [];
      }) : [];
      return {
        title: workTitle(work.payload),
        name: workTitle(work.payload),
        synopsis: String(info.synopsis || ''),
        type: info.type === 'movie' ? 'movie' : 'series',
        image: poster[0], poster: poster[0], background: background[0], logo: logo[0],
        tags,
        artworkCandidates: {poster, background, logo},
      };
    },
    staleTime: Infinity,
  });
}
