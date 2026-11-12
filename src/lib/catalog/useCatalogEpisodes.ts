import {useQuery} from '@tanstack/react-query';
import type {Link} from '../providers/types';
import {loadCatalogSeason} from './content';
import {useCatalogStore} from './store';

export function useCatalogEpisodes(ref?: Link['catalogSeasonRef']) {
  const installed = useCatalogStore(s => s.installed);
  const generation = useCatalogStore(s => s.generation);
  return useQuery({
    queryKey: ['catalog-episodes', installed?.revision, generation, ref],
    enabled: !!ref && !!installed,
    queryFn: () => loadCatalogSeason(ref!, true),
    staleTime: Infinity,
  });
}
