import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import Slider from '../Slider';
import {catalogList} from '../../lib/catalog/reader';
import {loadCatalogPosts} from '../../lib/catalog/presentation';
import {useCatalogStore} from '../../lib/catalog/store';
import {catalogSearchSection} from '../../lib/catalog/useCatalogPresentation';

export default function CatalogSearchRow({search}: {search: string}) {
  const selected = useCatalogStore(s => !!s.installed && s.preferences.selected);
  return selected ? <InstalledCatalogSearchRow search={search} /> : null;
}

function InstalledCatalogSearchRow({search}: {search: string}) {
  const {t} = useTranslation();
  const installed = useCatalogStore(s => s.installed);
  const preferences = useCatalogStore(s => s.preferences);
  const generation = useCatalogStore(s => s.generation);
  const selected = !!installed && preferences.selected;
  const query = useQuery({
    queryKey: ['catalog-search-posts', installed?.revision, generation, search],
    enabled: selected,
    queryFn: async () => loadCatalogPosts(await catalogList(catalogSearchSection, 0, search)),
    staleTime: Infinity,
  });
  if (!selected) {return null;}
  return <Slider isSearch isLoading={query.isLoading} title={t('catalog.localResults')}
    posts={query.data || []} filter={search} catalogSection={catalogSearchSection}
    catalogSearch={search} error={query.error?.message} retrying={query.isFetching}
    onRetry={() => {query.refetch();}} />;
}
