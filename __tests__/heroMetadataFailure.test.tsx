import 'react-native';
import React, {act} from 'react';
import {AppState, Image} from 'react-native';
import {beforeEach, afterEach, describe, expect, it, jest} from '@jest/globals';
import renderer from 'react-test-renderer';
import Hero from '../src/components/Hero';
import {useHeroMetadata} from '../src/lib/hooks/useHomePageData';
import useContentStore from '../src/lib/zustand/contentStore';
import useHeroStore from '../src/lib/zustand/herostore';
import useUiSettingsStore from '../src/lib/zustand/uiSettingsStore';

jest.mock('../src/lib/utils/providerCacheScope', () => ({
  getProviderCacheScope: (value: string) => value,
}));

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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('../src/lib/zustand/watchListStore', () => ({
  __esModule: true,
  default: () => ({watchList: [], addItem: jest.fn(), removeItem: jest.fn()}),
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
const selectorStoreMock =
  <State,>(state: State) =>
  (selector: (current: State) => unknown) =>
    selector(state);

const renderHero = (onImageError: (link?: string) => void) => (
  <Hero posts={[]} isDrawerOpen={false} onImageError={onImageError} />
);

describe('Hero metadata failure', () => {
  it('requests another work once after metadata retries fail', async () => {
    const onImageError = jest.fn<(link?: string) => void>();
    contentStoreMock.mockImplementation(
      selectorStoreMock({
        provider: {value: 'streamingunity', display_name: 'StreamingUnity'},
      }) as unknown as typeof useContentStore,
    );
    uiSettingsStoreMock.mockImplementation(
      selectorStoreMock({
        showHamburgerMenu: true,
        disableDrawer: false,
      }) as unknown as typeof useUiSettingsStore,
    );
    heroStoreMock.mockImplementation(
      selectorStoreMock({
        providerScope: 'streamingunity',
        hero: {link: 'https://example.com/first', title: 'First'},
      }) as unknown as typeof useHeroStore,
    );
    metadataMock.mockReturnValue({
      isLoading: false,
      error: new Error('failed'),
      data: undefined,
    } as ReturnType<typeof useHeroMetadata>);

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

    expect(component.root.findAllByType(Image)).toHaveLength(0);

    heroStoreMock.mockImplementation(
      selectorStoreMock({
        providerScope: 'streamingunity',
        hero: {link: 'https://example.com/second', title: 'Second'},
      }) as unknown as typeof useHeroStore,
    );
    metadataMock.mockReturnValue({
      isLoading: false,
      error: new Error('background refresh failed'),
      data: {title: 'Second', background: 'https://example.com/second.jpg'},
    } as ReturnType<typeof useHeroMetadata>);
    await act(async () => {
      component.update(renderHero(onImageError));
    });
    expect(onImageError).toHaveBeenCalledTimes(1);

    heroStoreMock.mockImplementation(
      selectorStoreMock({
        providerScope: 'streamingunity',
        hero: {link: 'https://example.com/third', title: 'Third'},
      }) as unknown as typeof useHeroStore,
    );
    metadataMock.mockReturnValue({
      isLoading: false,
      error: new Error('failed'),
      data: undefined,
    } as ReturnType<typeof useHeroMetadata>);
    await act(async () => {
      component.update(renderHero(onImageError));
    });
    expect(onImageError).toHaveBeenNthCalledWith(
      2,
      'https://example.com/third',
    );

    await act(async () => component.unmount());
  });
});

describe('Hero carousel resilience', () => {
  const first = {link: 'first', title: 'First', image: 'first.jpg'};
  const second = {link: 'second', title: 'Second', image: 'second.jpg'};
  const third = {link: 'third', title: 'Third', image: 'third.jpg'};
  let changeAppState: (state: 'active' | 'background') => void;
  let tree: renderer.ReactTestRenderer;
  const onError = jest.fn();
  const slides = () =>
    tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Home slide' &&
        typeof node.props.onPress === 'function',
    );
  const currentImage = () => tree.root.findByType(Image);
  const metadata = (link: string) =>
    ({
      isLoading: false,
      error: null,
      data: {title: link, background: `${link}.jpg`},
    }) as ReturnType<typeof useHeroMetadata>;
  const render = async (posts = [second, third], extra = {}) => {
    await act(async () => {
      const element = (
        <Hero
          posts={posts}
          isDrawerOpen={false}
          onImageError={onError}
          {...extra}
        />
      );
      if (tree) {
        tree.update(element);
      } else {
        tree = renderer.create(element);
      }
    });
  };
  beforeEach(() => {
    jest.useFakeTimers();
    tree = undefined as unknown as renderer.ReactTestRenderer;
    onError.mockClear();
    contentStoreMock.mockImplementation(
      selectorStoreMock({
        provider: {value: 'streamingunity'},
      }) as unknown as typeof useContentStore,
    );
    heroStoreMock.mockImplementation(
      selectorStoreMock({
        hero: first,
        providerScope: 'streamingunity',
      }) as unknown as typeof useHeroStore,
    );
    metadataMock.mockImplementation(metadata);
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        changeAppState = listener;
        return {remove: jest.fn()};
      });
  });
  afterEach(async () => {
    if (tree) {
      await act(async () => tree.unmount());
    }
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('keeps the selected work when sections reorder, and selects a valid slide when it disappears', async () => {
    await render();
    await act(async () => slides()[2].props.onPress());
    expect(currentImage().props.source.uri).toBe('third.jpg');
    await render([third, second]);
    expect(currentImage().props.source.uri).toBe('third.jpg');
    expect(slides()[1].props.accessibilityState.selected).toBe(true);
    await render([second]);
    expect(currentImage().props.source.uri).toBe('first.jpg');
    expect(slides()[0].props.accessibilityState.selected).toBe(true);
  });

  it('skips a failed secondary slide without replacing the primary work', async () => {
    metadataMock.mockImplementation(link =>
      link === 'second'
        ? ({
            isLoading: false,
            error: new Error('unavailable'),
            data: undefined,
          } as ReturnType<typeof useHeroMetadata>)
        : metadata(link),
    );
    await render();
    await act(async () => slides()[1].props.onPress());
    expect(onError).not.toHaveBeenCalled();
    expect(slides()).toHaveLength(2);
    expect(currentImage().props.source.uri).toBe('first.jpg');
  });

  it('tries the provider poster after artwork fails and ignores late errors from another slide', async () => {
    metadataMock.mockImplementation(
      link =>
        ({
          ...metadata(link),
          data: {background: `${link}-banner.jpg`},
        }) as ReturnType<typeof useHeroMetadata>,
    );
    await render();
    const lateError = currentImage().props.onError;
    await act(async () => currentImage().props.onError());
    expect(currentImage().props.source.uri).toBe('first.jpg');
    expect(onError).not.toHaveBeenCalled();
    await act(async () => slides()[1].props.onPress());
    await act(async () => lateError());
    expect(currentImage().props.source.uri).toBe('second-banner.jpg');
    expect(onError).not.toHaveBeenCalled();
  });

  it('waits for metadata when the preliminary poster fails', async () => {
    metadataMock.mockReturnValue({
      isLoading: true,
      error: null,
      data: undefined,
    } as unknown as ReturnType<typeof useHeroMetadata>);
    await render();
    await act(async () => currentImage().props.onError());
    expect(onError).not.toHaveBeenCalled();
    metadataMock.mockImplementation(metadata);
    // A different, successfully resolved artwork becomes available.
    metadataMock.mockImplementation(
      link =>
        ({
          ...metadata(link),
          data: {background: `${link}-banner.jpg`},
        }) as ReturnType<typeof useHeroMetadata>,
    );
    await render();
    expect(currentImage().props.source.uri).toBe('first-banner.jpg');
    expect(onError).not.toHaveBeenCalled();
  });

  it('stops automatic progression in background, during search and while loading', async () => {
    await render();
    await act(async () => changeAppState('active'));
    await act(async () => jest.advanceTimersByTime(10500));
    expect(currentImage().props.source.uri).toBe('second.jpg');
    await act(async () => changeAppState('background'));
    await act(async () => jest.advanceTimersByTime(60000));
    expect(currentImage().props.source.uri).toBe('second.jpg');
    await act(async () => changeAppState('active'));
    await render([second, third], {searchActive: true});
    await act(async () => jest.advanceTimersByTime(60000));
    expect(currentImage().props.source.uri).toBe('second.jpg');
    metadataMock.mockReturnValue({
      isLoading: true,
      error: null,
      data: undefined,
    } as unknown as ReturnType<typeof useHeroMetadata>);
    await render();
    await act(async () => jest.advanceTimersByTime(60000));
    expect(currentImage().props.source.uri).toBe('second.jpg');
    metadataMock.mockImplementation(metadata);
    await render();
    await act(async () => jest.advanceTimersByTime(10500));
    expect(currentImage().props.source.uri).toBe('third.jpg');
  });

  it('bounds failures when every slide fails and retries them after an explicit refresh remount', async () => {
    metadataMock.mockReturnValue({
      isLoading: false,
      error: new Error('offline'),
      data: undefined,
    } as ReturnType<typeof useHeroMetadata>);
    await render();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('first');
    expect(slides()).toHaveLength(0);
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    metadataMock.mockImplementation(metadata);
    await render([second, third], {key: 'refreshed'});
    expect(currentImage().props.source.uri).toBe('first.jpg');
    expect(slides()).toHaveLength(3);
  });

  it('does not request metadata for a hero belonging to the previous provider', async () => {
    contentStoreMock.mockImplementation(
      selectorStoreMock({
        provider: {value: 'new-provider'},
      }) as unknown as typeof useContentStore,
    );
    metadataMock.mockClear();
    await render([]);
    expect(metadataMock).toHaveBeenLastCalledWith('', 'new-provider');
    expect(onError).not.toHaveBeenCalled();
  });
});
