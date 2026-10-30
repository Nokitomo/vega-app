import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {TouchableOpacity} from 'react-native';
import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import SearchResults from '../src/screens/SearchResults';
import useSearchCacheStore from '../src/lib/zustand/searchCacheStore';
import {providerManager} from '../src/lib/services/ProviderManager';

const mockProviders = [{value: 'animeunity', display_name: 'AnimeUnity'}, {value: 'streamingunity', display_name: 'StreamingUnity'}];
jest.mock('../src/lib/zustand/contentStore', () => ({__esModule: true, default: (select: any) => select({installedProviders: mockProviders})}));
jest.mock('../src/lib/services/ProviderManager', () => ({providerManager: {getSearchPosts: jest.fn()}}));
jest.mock('../src/components/Slider', () => ({__esModule: true, default: (props: any) => require('react').createElement('Slider', props)}));
jest.mock('react-native-safe-area-context', () => ({SafeAreaView: 'SafeAreaView'}));
jest.mock('react-i18next', () => ({useTranslation: () => ({t: (key: string) => key})}));
const search = jest.mocked(providerManager.getSearchPosts);
const post = {title: 'Result', link: '/result', image: '/poster'};
const props = {route: {params: {filter: 'test'}}} as any;

describe('Global search provider isolation', () => {
  beforeEach(() => {jest.clearAllMocks(); useSearchCacheStore.getState().clearCache();});
  it('shows a failed provider, keeps successful cards and retries only the failure before caching', async () => {
    search.mockImplementation(async ({providerValue}) => {
      if (providerValue === 'streamingunity') {throw new Error('network');}
      return [post];
    });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {tree = renderer.create(<SearchResults {...props} />);});
    expect(search).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(tree.toJSON())).toContain('Failed to search');
    expect(tree.root.findAllByType('Slider' as any)).toHaveLength(1);
    expect(Object.keys(useSearchCacheStore.getState().cache)).toHaveLength(0);
    search.mockResolvedValueOnce([]);
    await act(async () => {tree.root.findByType(TouchableOpacity).props.onPress();});
    expect(search).toHaveBeenCalledTimes(3);
    expect(search.mock.calls[2][0].providerValue).toBe('streamingunity');
    expect(JSON.stringify(tree.toJSON())).toContain('No Content Found');
    expect(Object.keys(useSearchCacheStore.getState().cache)).toHaveLength(1);
    await act(async () => {tree.unmount();});
    await act(async () => {tree = renderer.create(<SearchResults {...props} />);});
    expect(search).toHaveBeenCalledTimes(3);
    await act(async () => {tree.unmount();});
  });
  it('keeps provider order despite completion order and ignores responses after unmount', async () => {
    let resolveFirst!: (value: any) => void;
    search.mockImplementation(({providerValue}) => providerValue === 'animeunity' ? new Promise(resolve => {resolveFirst = resolve;}) : Promise.resolve([post]));
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {tree = renderer.create(<SearchResults {...props} />);});
    expect(tree.root.findAllByProps({testID: 'search-provider-animeunity'})).not.toHaveLength(0);
    await act(async () => {resolveFirst([post]);});
    expect(tree.root.findAllByType('Slider' as any).map(node => node.props.providerValue)).toEqual(['animeunity', 'streamingunity']);
    await act(async () => {tree.unmount();});
    useSearchCacheStore.getState().clearCache();
    await act(async () => {tree = renderer.create(<SearchResults {...props} />);});
    await act(async () => {tree.unmount();});
    await act(async () => {resolveFirst([post]);});
    expect(Object.keys(useSearchCacheStore.getState().cache)).toHaveLength(0);
  });
});
