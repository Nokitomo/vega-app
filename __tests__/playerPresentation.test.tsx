import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {FlatList, Text, TouchableOpacity} from 'react-native';
import {describe, it, expect, jest} from '@jest/globals';
import Sidebar from '../src/components/PlayerEpisodeSidebar';
import {
  getPlayerEpisodeNumber,
  playerEpisodeTitle,
} from '../src/lib/utils/playerEpisodePresentation';
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
const episodes = [
  {title: 'Il ritorno', link: 'ep12', episodeNumber: 12},
  {title: 'Episodio 13', link: 'ep13'},
  {title: 'Speciale', link: 'special', episodeNumber: 0},
];
const props = {
  visible: true,
  groups: [
    {title: 'Stagione 1', directLinks: []},
    {title: 'Stagione 2', directLinks: []},
  ],
  selectedGroupIndex: 0,
  episodes,
  activeEpisodeLink: 'ep12',
  loading: false,
  error: null,
  primaryColor: '#ff640a',
  labels: {
    episodes: 'Episodi',
    lists: 'Liste',
    loading: 'Caricamento',
    empty: 'Vuoto',
    close: 'Chiudi',
    episode: (n: number) => `Episodio ${n}`,
    shortEpisode: (n: number) => `EP ${n}`,
  },
  resolveTitle: (e: any) => e?.title || '',
  onClose: jest.fn(),
  onSelectGroup: jest.fn(),
  onSelectEpisode: jest.fn(),
};
describe('Player episode presentation', () => {
  it('uses metadata before title and position, including specials and decimals', () => {
    expect(
      getPlayerEpisodeNumber({episodeNumber: 12, title: 'Episode 1'}, 0),
    ).toBe(12);
    expect(getPlayerEpisodeNumber({episodeNumber: 0}, 4)).toBe(0);
    expect(getPlayerEpisodeNumber({episodeNumber: 12.5}, 4)).toBe(12.5);
    expect(getPlayerEpisodeNumber({title: 'Episodio 23 - Finale'}, 0)).toBe(23);
    expect(getPlayerEpisodeNumber({title: '2024'}, 2)).toBe(3);
    expect(getPlayerEpisodeNumber({episodeNumber: NaN, title: 'Nome'}, 3)).toBe(
      4,
    );
  });
  it('keeps the title without repeating a generic episode label', () => {
    expect(playerEpisodeTitle('Il ritorno', 'Episodio 12')).toBe(
      'Episodio 12 \u00b7 Il ritorno',
    );
    expect(playerEpisodeTitle('Episode 12', 'Episodio 12')).toBe('Episodio 12');
    expect(playerEpisodeTitle('', 'Episode 12')).toBe('Episode 12');
  });
  it('shows the real episode number and preserves episode/group/close callbacks', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<Sidebar {...props} />);
    });
    const list = tree.root.findByType(FlatList);
    let row!: renderer.ReactTestRenderer;
    await act(async () => {
      row = renderer.create(
        list.props.renderItem({item: episodes[0], index: 0}),
      );
    });
    expect(
      row.root
        .findAllByType(Text)
        .some(n => n.props.children === 'Episodio 12'),
    ).toBe(true);
    expect(
      row.root.findAllByType(Text).some(n => n.props.children === 'Il ritorno'),
    ).toBe(true);
    await act(async () =>
      row.root.findByType(TouchableOpacity).props.onPress(),
    );
    expect(props.onSelectEpisode).toHaveBeenCalledWith(episodes[0], 0);
    const close = tree.root
      .findAllByProps({accessibilityLabel: 'Chiudi'})
      .find(n => n.props.onPress);
    await act(async () => close!.props.onPress());
    expect(props.onClose).toHaveBeenCalled();
    const group = tree.root
      .findAllByType(TouchableOpacity)
      .find(n =>
        n.findAllByType(Text).some(t => t.props.children === 'Stagione 2'),
      );
    await act(async () => group!.props.onPress());
    expect(props.onSelectGroup).toHaveBeenCalledWith(1);
    await act(async () => {
      row.unmount();
      tree.unmount();
    });
  });
});
