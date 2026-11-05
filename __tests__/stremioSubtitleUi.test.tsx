import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {Text, TextInput, TouchableOpacity, Switch} from 'react-native';
import {beforeEach, describe, expect, it, jest} from '@jest/globals';
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('../src/lib/zustand/themeStore', () => ({
  __esModule: true,
  default: (select: any) => select({primary: '#12ffaa'}),
}));
jest.mock('react-native-element-dropdown', () => ({Dropdown: 'Dropdown'}));
jest.mock('../src/lib/services/stremioAddons', () => ({
  getStremioAddons: jest.fn(() => []),
  subscribeStremioAddons: () => () => {},
  supportsSubtitles: (a: any) =>
    a.resources.some((r: any) => r.name === 'subtitles'),
  inspectStremioAddon: jest.fn(),
  installStremioAddon: jest.fn(),
  getSubtitleLanguage: () => 'it',
  setSubtitleLanguage: jest.fn(),
  searchStremioSubtitles: jest.fn(),
}));
jest.mock('../src/lib/services/addonSubtitleFile', () => ({
  downloadAddonSubtitle: jest.fn(),
}));
jest.mock('../src/lib/services/openSubtitles', () => ({
  getOpenSubtitlesApiKey: () => '',
  searchOpenSubtitles: jest.fn(),
}));
import StremioAddons from '../src/screens/settings/StremioAddons';
import SearchSubtitles from '../src/components/SearchSubtitles';
import {
  getStremioAddons,
  inspectStremioAddon,
  installStremioAddon,
  searchStremioSubtitles,
} from '../src/lib/services/stremioAddons';
const button = (tree: renderer.ReactTestRenderer, key: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find(
      x =>
        x.props.accessibilityLabel === key ||
        x.findAllByType(Text).some(t => t.props.children === key),
    )!;
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Stremio addon UI', () => {
  it('keeps unsupported addons inactive and exposes manifest inspection', async () => {
    (getStremioAddons as jest.Mock).mockReturnValue([
      {
        url: 'https://example.org/manifest.json',
        name: 'Catalog',
        version: '1',
        resources: [{name: 'catalog'}],
        enabled: false,
      },
    ]);
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <StremioAddons
          navigation={{goBack: jest.fn()} as any}
          route={{} as any}
        />,
      );
    });
    expect(tree.root.findByType(Switch).props.disabled).toBe(true);
    expect(button(tree, 'addon.inspect')).toBeTruthy();
    await act(async () => tree.unmount());
  });
  it('shows failed inspection without offering installation', async () => {
    (getStremioAddons as jest.Mock).mockReturnValue([]);
    (
      inspectStremioAddon as jest.MockedFunction<typeof inspectStremioAddon>
    ).mockRejectedValue(new Error('Invalid manifest'));
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <StremioAddons
          navigation={{goBack: jest.fn()} as any}
          route={{} as any}
        />,
      );
    });
    await act(async () =>
      tree.root
        .findByType(TextInput)
        .props.onChangeText('https://example.org/manifest.json'),
    );
    await act(async () => button(tree, 'addon.inspect').props.onPress());
    expect(installStremioAddon).not.toHaveBeenCalled();
    expect(
      tree.root
        .findAllByType(Text)
        .some(x => x.props.children === 'Invalid manifest'),
    ).toBe(true);
    await act(async () => tree.unmount());
  });
  it('searches the exact episode automatically in the preferred language without an API key', async () => {
    (
      searchStremioSubtitles as jest.MockedFunction<
        typeof searchStremioSubtitles
      >
    ).mockResolvedValue({results: [], failed: []});
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SearchSubtitles
          searchQuery="Sherlock"
          setSearchQuery={jest.fn()}
          setExternalSubs={jest.fn()}
          imdbId="tt1475582"
          seasonNumber={1}
          episodeNumber={2}
          contentKey="episode2"
        />,
      );
    });
    await act(async () =>
      button(tree, 'Search subtitles online').props.onPress(),
    );
    await act(async () => button(tree, 'Search').props.onPress());
    expect(searchStremioSubtitles).toHaveBeenCalledWith(
      expect.objectContaining({
        imdb: 'tt1475582',
        type: 'series',
        season: '1',
        episode: '2',
        language: 'it',
      }),
    );
    await act(async () => tree.unmount());
  });
  it('does not display a stale search after changing episode', async () => {
    let resolve!: (value: any) => void;
    (
      searchStremioSubtitles as jest.MockedFunction<
        typeof searchStremioSubtitles
      >
    ).mockImplementation(
      () =>
        new Promise(r => {
          resolve = r;
        }),
    );
    const props = {
      searchQuery: 'Show',
      setSearchQuery: jest.fn(),
      setExternalSubs: jest.fn(),
      imdbId: 'tt1',
      seasonNumber: 1,
    };
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SearchSubtitles {...props} episodeNumber={1} contentKey="one" />,
      );
    });
    await act(async () =>
      button(tree, 'Search subtitles online').props.onPress(),
    );
    await act(async () => {
      button(tree, 'Search').props.onPress();
    });
    await act(async () =>
      tree.update(
        <SearchSubtitles {...props} episodeNumber={2} contentKey="two" />,
      ),
    );
    await act(async () =>
      resolve({
        results: [
          {
            id: '1',
            url: 'https://example.org/sub.srt',
            language: 'it',
            label: 'Stale result',
            source: 'Test',
          },
        ],
        failed: [],
      }),
    );
    expect(
      tree.root
        .findAllByType(Text)
        .some(x => x.props.children === 'Stale result'),
    ).toBe(false);
    expect(props.setExternalSubs).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });
});
