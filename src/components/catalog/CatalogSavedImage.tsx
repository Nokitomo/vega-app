import React from 'react';
import {Image, type ImageProps} from 'react-native';
import {useQuery} from '@tanstack/react-query';
import {useCatalogStore} from '../../lib/catalog/store';
import {catalogWork} from '../../lib/catalog/reader';
import {workImages} from '../../lib/catalog/content';
import type {CatalogRef} from '../../lib/catalog/types';

export default function CatalogSavedImage({
  catalogRef,
  ...props
}: ImageProps & {catalogRef?: CatalogRef}) {
  return catalogRef ? (
    <ConnectedCatalogImage {...props} catalogRef={catalogRef} />
  ) : (
    <Image {...props} />
  );
}
function ConnectedCatalogImage({
  catalogRef,
  ...props
}: ImageProps & {catalogRef: CatalogRef}) {
  const {generation, installed} = useCatalogStore();
  const [failed, setFailed] = React.useState<string[]>([]);
  const query = useQuery({
    queryKey: ['catalog', generation, 'saved-poster', catalogRef?.workId],
    enabled: !!catalogRef && !!installed,
    queryFn: async () =>
      workImages(await catalogWork(catalogRef!.workId), 'poster'),
  });
  const uri = query.data?.find(url => !failed.includes(url));
  return (
    <Image
      {...props}
      source={uri ? {uri} : query.isSuccess ? undefined : props.source}
      onError={event => {
        if (uri) {
          setFailed(rows => [...rows, uri]);
        }
        props.onError?.(event);
      }}
    />
  );
}
