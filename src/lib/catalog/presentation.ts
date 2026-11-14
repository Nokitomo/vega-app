import type {Post} from '../providers/types';
import type {CatalogRecord, Work} from './types';
import {catalogLitePosters} from './reader';
import {selectCardPoster} from './artwork';
import {useCatalogStore} from './store';
import {workImages, workTitle} from './content';

/** Keep catalog identity separate from provider playback coordinates. */
export function catalogPost(
  work: CatalogRecord<Work>,
  posters: readonly string[],
): Post {
  return {
    catalogRef: {catalogId: 'cinema', workId: work.id},
    link: work.id,
    title: workTitle(work.payload),
    image: posters[0] || '',
    imageCandidates: [...posters],
  };
}

/** Resolve artwork through the same preference/override policy used by Info. */
export async function loadCatalogPosts(
  works: readonly CatalogRecord<Work>[],
): Promise<Post[]> {
  const {installed, preferences} = useCatalogStore.getState();
  if (installed?.format) {
    const posters = await catalogLitePosters(works.map(work => work.id));
    return works.map(work => ({
      catalogRef: {catalogId: 'cinema', workId: work.id},
      link: work.id,
      title: workTitle(work.payload),
      ...selectCardPoster(
        posters.get(work.id) ?? [],
        preferences,
        String(work.payload.info.original_language || ''),
      ),
    }));
  }
  const posts: Post[] = [];
  // Bound concurrent SQLite reads when filling several Home sections.
  for (let offset = 0; offset < works.length; offset += 4) {
    posts.push(
      ...(await Promise.all(
        works.slice(offset, offset + 4).map(async work =>
          catalogPost(work, await workImages(work, 'poster')),
        ),
      )),
    );
  }
  return posts;
}
