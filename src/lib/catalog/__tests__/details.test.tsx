import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {beforeEach, expect, jest, test} from '@jest/globals';
import {useCatalogDetails} from '../useCatalogDetails';
import {useCatalogStore} from '../store';
import {catalogChildren, catalogWork} from '../reader';
import {workImages, syncCatalogSeries} from '../content';

jest.mock('../reader', () => ({catalogWork: jest.fn(), catalogChildren: jest.fn(), catalogEpisodeCount: jest.fn(() => Promise.resolve(62))}));
jest.mock('../content', () => ({
  workTitle: (work: any) => work.info.title,
  sourceLink: (source: any) => source.path,
  workImages: jest.fn(), syncCatalogSeries: jest.fn(() => Promise.resolve()),
}));
let mockInstalledProviders = [{value: 'streamingunity'}];
jest.mock('../../zustand/contentStore', () => ({
  __esModule: true,
  default: (select: any) => select({installedProviders: mockInstalledProviders}),
}));
const sources = [1, 2].map(id => ({id: `source-${id}`, payload: {
  id, provider: 'streamingunity', availability: 'present', path: `/it/titles/${id}-show`, info: {name: 'Show'},
}}));
const work = {id: 'work', payload: {active: true, sourceIds: {imdb: 'tt1234', tmdb: '42'}, info: {title: 'Correct title', type: 'tv', synopsis: 'Correct plot', genres: [{name: 'Drama'}]}}};
beforeEach(() => {
  jest.clearAllMocks();
  mockInstalledProviders = [{value: 'streamingunity'}];
  useCatalogStore.setState({installed: {revision: 'a'.repeat(64), file: 'catalog.sqlite', bytes: 1, installedAt: 1}});
  jest.mocked(catalogWork).mockResolvedValue(work);
  jest.mocked(catalogChildren).mockImplementation(async kind => (kind === 'source' ? sources : [{id: 'season-4', payload: {number: 4}}]) as any);
  jest.mocked(workImages).mockImplementation(async (_, field) => [`preferred-${field}`, `fallback-${field}`]);
});

async function mount(hint = 'work', resume = false) {
  let value!: ReturnType<typeof useCatalogDetails>;
  function Probe() {
    value = useCatalogDetails({catalogId: 'cinema', workId: 'work'}, hint, resume);
    return null;
  }
  const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {tree = renderer.create(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);});
  await act(async () => {await new Promise(resolve => setTimeout(resolve, 20));});
  return {value: () => value, close: async () => {await act(async () => tree.unmount()); client.clear();}};
}

test('requires explicit source choice and keeps corrected text and image order', async () => {
  const testView = await mount();
  expect(testView.value().source).toBeUndefined();
  expect(testView.value().info?.linkList).toEqual([]);
  expect(testView.value().info).toMatchObject({title: 'Correct title', synopsis: 'Correct plot', genres: ['Drama'], poster: 'preferred-poster', episodesCount: 62});
  expect(testView.value().info?.tags).toBeUndefined();
  expect(testView.value().artwork?.background).toEqual(['preferred-background', 'fallback-background']);
  await act(async () => testView.value().selectSource('source-2'));
  expect(testView.value().link).toBe('/it/titles/2-show');
  expect(testView.value().info?.linkList[0].catalogSeasonRef).toEqual({workId: 'work', sourceId: 'source-2', seasonId: 'season-4'});
  expect(syncCatalogSeries).toHaveBeenCalledWith(work, sources[1]);
  await testView.close();
});

test('restores the exact source for a continue-watching target', async () => {
  const testView = await mount('/it/titles/2-show', true);
  expect(testView.value().source?.id).toBe('source-2');
  await testView.close();
});

test('keeps details readable without an installed playback provider', async () => {
  mockInstalledProviders = [];
  const testView = await mount();
  expect(testView.value().info?.title).toBe('Correct title');
  expect(testView.value().sources).toEqual([]);
  expect(testView.value().info?.linkList).toEqual([]);
  expect(syncCatalogSeries).not.toHaveBeenCalled();
  await testView.close();
});
