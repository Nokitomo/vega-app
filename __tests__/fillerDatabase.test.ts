import {describe, expect, it} from '@jest/globals';
import {
  findFillerEpisodes,
  parseFillerDatabase,
} from '../src/lib/services/fillerDatabase';

const database = parseFillerDatabase(
  JSON.stringify([
    {
      mapping: {
        mal_id: 21,
        anilist_id: 30013,
        imdb_id: 'tt0388629',
        themoviedb_id: 37854,
      },
      show: {title: 'One Piece', filler: [54, 55], mixedCanon: []},
    },
  ]),
);

describe('filler database', () => {
  it('matches identifiers in Cloudstream priority order', () => {
    expect(
      [...findFillerEpisodes(database, {title: 'Other', malId: 21})],
    ).toEqual([54, 55]);
  });

  it('falls back to a normalized title', () => {
    expect(
      [...findFillerEpisodes(database, {title: 'One-Piece!'})],
    ).toEqual([54, 55]);
  });

  it('matches the TMDB identifier used at the root of current records', () => {
    expect(
      [...findFillerEpisodes(database, {title: 'Other', tmdbId: 37854})],
    ).toEqual([54, 55]);
  });

  it('rejects malformed database payloads', () => {
    expect(() => parseFillerDatabase('{"not":"an array"}')).toThrow();
  });
});
