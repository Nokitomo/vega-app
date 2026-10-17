import {describe, expect, it} from '@jest/globals';
import {
  getMetadataCheckInterval,
  hasContentInventoryChanged,
} from '../src/lib/services/metadataRefreshPolicy';
import {reconcileEpisodes} from '../src/lib/services/episodeReconciliation';
import type {Info} from '../src/lib/providers/types';

const info = (status: string, type = 'series'): Info => ({
  title: 'Test',
  image: '',
  synopsis: '',
  imdbId: '',
  type,
  linkList: [],
  episodesCount: 3,
  extra: {meta: {status}},
});

describe('incremental metadata policy', () => {
  it('never schedules concluded AnimeUnity checks', () => {
    expect(getMetadataCheckInterval('animeunity', info('Terminato'))).toBe(
      Infinity,
    );
    expect(getMetadataCheckInterval('animeunity', info('Droppato'))).toBe(
      Infinity,
    );
    expect(getMetadataCheckInterval('animeunity', info('In Corso'))).toBe(
      4 * 60 * 60 * 1000,
    );
  });

  it('checks ended StreamingUnity series weekly', () => {
    expect(getMetadataCheckInterval('streamingunity', info('Canceled'))).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
    expect(getMetadataCheckInterval('streamingunity', info('Returning Series'))).toBe(
      6 * 60 * 60 * 1000,
    );
  });

  it('detects status and season changes without relying only on count', () => {
    const current = info('Returning Series');
    const previous = {
      complete: true as const,
      status: 'Returning Series',
      episodesCount: 3,
      seasonsSignature: '[{"number":1,"count":3}]',
    };
    expect(hasContentInventoryChanged(current, previous, previous)).toBe(
      false,
    );
    expect(
      hasContentInventoryChanged(
        current,
        {...previous, seasonsSignature: '[{"number":2,"count":3}]'},
        previous,
      ),
    ).toBe(true);
  });

  it('refreshes cached series metadata when season zero appears', () => {
    const current = {...info('Returning Series'), linkList: [
      {title: 'Season 1', seasonNumber: 1},
    ]};
    expect(hasContentInventoryChanged(current, {
      complete: true,
      status: 'Returning Series',
      episodesCount: 3,
      seasonsSignature: '[{"number":0,"count":1},{"number":1,"count":2}]',
    })).toBe(true);
  });

  it('preserves removed episodes until a second matching complete inventory', () => {
    const stored = [
      {link: '1', title: 'One', thumbnail: 'https://image/1'},
      {link: '2', title: 'Two', thumbnail: 'https://image/2'},
    ];
    const live = [{link: '1', title: 'Episode 1'}];
    const first = reconcileEpisodes(stored, live);
    expect(first.episodes).toHaveLength(2);
    expect(first.missing).toEqual(['2']);
    const second = reconcileEpisodes(stored, live, first.missing);
    expect(second.confirmedRemoved).toEqual(['2']);
    expect(second.episodes).toHaveLength(1);
    expect(second.episodes[0].thumbnail).toBe('https://image/1');
  });

  it('adds only new episode identities', () => {
    const result = reconcileEpisodes(
      [{link: '1', title: 'Old', episodeNumber: 1}],
      [
        {link: '1', title: 'Provider', episodeNumber: 1},
        {link: '2', title: 'New', episodeNumber: 2},
      ],
    );
    expect(result.added).toEqual(['2']);
    expect(result.episodes.map(episode => episode.title)).toEqual([
      'Old',
      'New',
    ]);
  });
});
