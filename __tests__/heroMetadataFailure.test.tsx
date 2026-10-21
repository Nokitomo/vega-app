import 'react-native';
import React, {act} from 'react';
import {Image} from 'react-native';
import {describe, expect, it, jest} from '@jest/globals';
import renderer from 'react-test-renderer';
import Hero from '../src/components/Hero';
import {useHeroMetadata} from '../src/lib/hooks/useHomePageData';
import useContentStore from '../src/lib/zustand/contentStore';
import useHeroStore from '../src/lib/zustand/herostore';
import useUiSettingsStore from '../src/lib/zustand/uiSettingsStore';

jest.mock('../src/lib/hooks/useHomePageData', () => ({
  useHeroMetadata: jest.fn(),
}));
jest.mock('../src/lib/zustand/contentStore', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../src/lib/zustand/herostore', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../src/lib/zustand/uiSettingsStore', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn()}),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (value: string) => value}),
}));
jest.mock('react-native-linear-gradient', () => () => null);
jest.mock('../src/components/RemoteLogo', () => () => null);
jest.mock('../src/components/SearchSuggestions', () => () => null);
jest.mock('../src/lib/hooks/useSearchSuggestions', () => ({
  useSearchSuggestions: () => ({suggestions: []}),
}));
jest.mock('../src/lib/hooks/useLogoFallback', () => ({
  useLogoFallback: () => ({uri: null, onError: jest.fn(), onLoad: jest.fn()}),
}));
jest.mock('../src/lib/utils/perfTrace', () => ({
  startPerfNavigation: jest.fn(),
}));
jest.mock('../src/lib/services/streamCenterMetadata', () => ({
  getMetadataSourceProvider: (providerValue: string) => providerValue,
}));

const metadataMock = jest.mocked(useHeroMetadata);
const contentStoreMock = jest.mocked(useContentStore);
const heroStoreMock = jest.mocked(useHeroStore);
const uiSettingsStoreMock = jest.mocked(useUiSettingsStore);
const selectorStoreMock = <State,>(state: State) =>
  (selector: (current: State) => unknown) => selector(state);

const renderHero = (onImageError: (link?: string) => void) => (
  <Hero isDrawerOpen={false} onOpenDrawer={() => undefined} onImageError={onImageError} />
);

describe('Hero metadata failure', () => {
  it('requests another work once after metadata retries fail', async () => {
    const onImageError = jest.fn<(link?: string) => void>();
    contentStoreMock.mockImplementation(selectorStoreMock({
      provider: {value: 'streamingunity', display_name: 'StreamingUnity'},
    }) as unknown as typeof useContentStore);
    uiSettingsStoreMock.mockImplementation(selectorStoreMock({
      showHamburgerMenu: true,
      disableDrawer: false,
    }) as unknown as typeof useUiSettingsStore);
    heroStoreMock.mockImplementation(selectorStoreMock({
      hero: {link: 'https://example.com/first', title: 'First'},
    }) as unknown as typeof useHeroStore);
    metadataMock.mockReturnValue({isLoading: false, error: new Error('failed'), data: undefined} as ReturnType<typeof useHeroMetadata>);

    let component!: renderer.ReactTestRenderer;
    await act(async () => {
      component = renderer.create(renderHero(onImageError));
    });
    expect(onImageError).toHaveBeenCalledWith('https://example.com/first');
    expect(onImageError).toHaveBeenCalledTimes(1);

    await act(async () => {
      component.update(renderHero(onImageError));
    });
    expect(onImageError).toHaveBeenCalledTimes(1);

    await act(async () => {
      component.root.findByType(Image).props.onError();
    });
    expect(onImageError).toHaveBeenCalledTimes(1);

    heroStoreMock.mockImplementation(selectorStoreMock({
      hero: {link: 'https://example.com/second', title: 'Second'},
    }) as unknown as typeof useHeroStore);
    metadataMock.mockReturnValue({
      isLoading: false,
      error: new Error('background refresh failed'),
      data: {title: 'Second', background: 'https://example.com/second.jpg'},
    } as ReturnType<typeof useHeroMetadata>);
    await act(async () => {
      component.update(renderHero(onImageError));
    });
    expect(onImageError).toHaveBeenCalledTimes(1);

    heroStoreMock.mockImplementation(selectorStoreMock({
      hero: {link: 'https://example.com/third', title: 'Third'},
    }) as unknown as typeof useHeroStore);
    metadataMock.mockReturnValue({isLoading: false, error: new Error('failed'), data: undefined} as ReturnType<typeof useHeroMetadata>);
    await act(async () => {
      component.update(renderHero(onImageError));
    });
    expect(onImageError).toHaveBeenNthCalledWith(2, 'https://example.com/third');

    await act(async () => component.unmount());
  });
});
