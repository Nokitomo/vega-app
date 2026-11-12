import {describe, expect, jest, test} from '@jest/globals';
import {catalogPost, loadCatalogPosts} from '../presentation';
import {workImages} from '../content';
import type {CatalogRecord, Work} from '../types';

jest.mock('../content', () => ({
  workTitle: (work: Work) => String(work.info.title || work.info.name || ''),
  workImages: jest.fn(),
}));

const work: CatalogRecord<Work> = {
  id: 'cinema:canonical',
  payload: {active: true, info: {title: 'Canonical title'}},
};

describe('catalog posts for shared presentation', () => {
  test('keeps catalog identity without inventing a provider or playback URL', () => {
    expect(catalogPost(work, ['preferred', 'fallback'])).toEqual({
      catalogRef: {catalogId: 'cinema', workId: work.id},
      link: work.id,
      title: 'Canonical title',
      image: 'preferred',
      imageCandidates: ['preferred', 'fallback'],
    });
  });

  test('does not restore excluded images from raw metadata', () => {
    expect(catalogPost({
      ...work,
      payload: {...work.payload, info: {poster: 'excluded'}},
    }, []).image).toBe('');
  });

  test('preserves section order and uses resolved poster preferences', async () => {
    const resolve = workImages as jest.MockedFunction<typeof workImages>;
    resolve.mockImplementation(async row => [`preferred:${row.id}`]);
    const works = Array.from({length: 9}, (_, index) => ({...work, id: String(index)}));
    const posts = await loadCatalogPosts(works);
    expect(posts.map(post => post.catalogRef?.workId)).toEqual(works.map(row => row.id));
    expect(posts.map(post => post.image)).toEqual(works.map(row => `preferred:${row.id}`));
    expect(resolve.mock.calls.every(([, field]) => field === 'poster')).toBe(true);
  });
});
