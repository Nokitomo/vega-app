import {describe, expect, it} from '@jest/globals';
import {
  findFillerEpisodes,
  parseFillerDatabase,
} from '../src/lib/services/fillerDatabase';

const database = parseFillerDatabase(
  JSON.stringify([
    {
      mapping: null,
      show: {title: 'Black Butler OVAs', filler: [1, 2, 4, 5]},
    },
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

  it('does not match missing identifiers against records without mappings', () => {
    expect(
      [
        ...findFillerEpisodes(database, {
          title: 'From Old Country Bumpkin to Master Swordsman',
          malId: 59452,
          anilistId: 179955,
          tmdbId: 260823,
        }),
      ],
    ).toEqual([]);
  });

  it('does not treat a TMDB season number as a TMDB title identifier', () => {
    const seasonOnlyDatabase = parseFillerDatabase(
      JSON.stringify([
        {
          mapping: {season: {tmdb: 1}},
          show: {title: 'Unrelated', filler: [1]},
        },
      ]),
    );

    expect(
      [
        ...findFillerEpisodes(seasonOnlyDatabase, {
          title: 'Other',
          tmdbId: 1,
        }),
      ],
    ).toEqual([]);
  });

  it('rejects malformed database payloads', () => {
    expect(() => parseFillerDatabase('{"not":"an array"}')).toThrow();
  });
});
