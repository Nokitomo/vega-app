import {needsPrePlayRefresh, resolvePrePlayEpisodes} from '../prePlayEpisodes';
import {describe, expect, it} from '@jest/globals';
import type {EpisodeLink} from '../../providers/types';

const episode = (number: number): EpisodeLink => ({
  title: `Episode ${number}`,
  link: `episode-${number}`,
  episodeNumber: number,
});

describe('resolvePrePlayEpisodes', () => {
  it('checks StreamCenter as well as its two source providers', () => {
    expect(needsPrePlayRefresh('streamcenter')).toBe(true);
    expect(needsPrePlayRefresh('animeunity')).toBe(true);
    expect(needsPrePlayRefresh('streamingunity')).toBe(true);
    expect(needsPrePlayRefresh('other')).toBe(false);
  });
  it('adds newly published episodes to a full ascending queue', () => {
    const current = [episode(1), episode(2)];
    const result = resolvePrePlayEpisodes(current, 1, current, [...current, episode(3)]);
    expect(result.episodes.map(item => item.link)).toEqual(['episode-1', 'episode-2', 'episode-3']);
    expect(result.episodes[result.index].link).toBe('episode-2');
  });

  it('keeps descending order and the tapped episode', () => {
    const current = [episode(1), episode(2)];
    const result = resolvePrePlayEpisodes([...current].reverse(), 0, current, [...current, episode(3)], true);
    expect(result.episodes.map(item => item.link)).toEqual(['episode-3', 'episode-2', 'episode-1']);
    expect(result.index).toBe(1);
  });

  it('keeps a filtered queue filtered while refreshing its entries', () => {
    const current = [episode(1), episode(2)];
    const result = resolvePrePlayEpisodes([current[1]], 0, current, [episode(1), {...episode(2), title: 'Updated'}, episode(3)]);
    expect(result.episodes).toHaveLength(1);
    expect(result.episodes[0].title).toBe('Updated');
  });

  it('retains the old queue if the selected episode is missing in the refresh', () => {
    const current = [episode(1), episode(2)];
    const result = resolvePrePlayEpisodes(current, 1, current, [episode(1)]);
    expect(result).toEqual({episodes: current, index: 1});
  });
});
