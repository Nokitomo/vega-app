import {describe, expect, it} from '@jest/globals';
import {
  isSvgArtworkUri,
  selectArtworkCandidates,
} from '../src/lib/services/artworkSelection';
import type {Info} from '../src/lib/providers/types';

const infoWithArtwork = (
  source: NonNullable<Info['extra']>['artworkSources'] = {},
): Info => ({
  title: 'Title',
  synopsis: '',
  image: 'https://provider.test/image.jpg',
  poster: 'https://provider.test/poster.jpg',
  background: 'https://provider.test/background.jpg',
  logo: 'https://provider.test/logo.svg',
  imdbId: 'tt1',
  type: 'series',
  linkList: [],
  extra: {artworkSources: source},
});

describe('artwork selection', () => {
  it.each(['provider', 'tmdb', 'tvdb'] as const)(
    'keeps a %s-selected poster and background ahead of Cinemeta',
    source => {
      const candidates = selectArtworkCandidates({
        providerValue: 'streamingunity',
        info: infoWithArtwork({poster: source, background: source}),
        enhanced: {
          poster: 'https://cinemeta.test/poster.jpg',
          background: 'https://cinemeta.test/background.jpg',
        },
      });

      expect(candidates.poster[0]).toBe('https://provider.test/poster.jpg');
      expect(candidates.background.slice(0, 2)).toEqual([
        'https://provider.test/background.jpg',
        'https://cinemeta.test/background.jpg',
      ]);
    },
  );

  it('keeps the complete provider, TMDB, TVDB, Cinemeta background chain', () => {
    const info = infoWithArtwork({background: 'provider'});
    info.extra = {
      ...info.extra,
      artworkCandidates: {
        background: [
          {source: 'provider', url: 'https://provider.test/background.jpg'},
          {source: 'tmdb', url: 'https://tmdb.test/background.jpg'},
          {source: 'tvdb', url: 'https://tvdb.test/background.jpg'},
        ],
      },
    };

    const candidates = selectArtworkCandidates({
      providerValue: 'streamingunity',
      info,
      enhanced: {background: 'https://cinemeta.test/background.jpg'},
    });

    expect(candidates.background.slice(0, 4)).toEqual([
      'https://provider.test/background.jpg',
      'https://tmdb.test/background.jpg',
      'https://tvdb.test/background.jpg',
      'https://cinemeta.test/background.jpg',
    ]);
  });

  it.each(['tmdb', 'tvdb'] as const)(
    'keeps a %s-selected logo ahead of Cinemeta',
    source => {
      const candidates = selectArtworkCandidates({
        providerValue: 'streamingunity',
        info: infoWithArtwork({logo: source}),
        enhanced: {logo: 'https://cinemeta.test/logo.png'},
      });

      expect(candidates.logo).toEqual([
        'https://provider.test/logo.svg',
        'https://cinemeta.test/logo.png',
      ]);
    },
  );

  it('puts Cinemeta ahead of a provider logo', () => {
    const candidates = selectArtworkCandidates({
      providerValue: 'streamingunity',
      info: infoWithArtwork({logo: 'provider'}),
      enhanced: {logo: 'https://cinemeta.test/logo.png'},
    });

    expect(candidates.logo).toEqual([
      'https://cinemeta.test/logo.png',
      'https://provider.test/logo.svg',
    ]);
  });

  it('keeps the complete TMDB, TVDB, Cinemeta, provider logo chain', () => {
    const info = infoWithArtwork({logo: 'tmdb'});
    info.extra = {
      ...info.extra,
      artworkCandidates: {
        logo: [
          {source: 'tmdb', url: 'https://tmdb.test/logo.png'},
          {source: 'tvdb', url: 'https://tvdb.test/logo.png'},
          {source: 'provider', url: 'https://provider.test/logo.svg'},
        ],
      },
    };

    const candidates = selectArtworkCandidates({
      providerValue: 'streamingunity',
      info,
      enhanced: {logo: 'https://cinemeta.test/logo.png'},
    });

    expect(candidates.logo).toEqual([
      'https://tmdb.test/logo.png',
      'https://tvdb.test/logo.png',
      'https://cinemeta.test/logo.png',
      'https://provider.test/logo.svg',
    ]);
  });

  it('does not change AnimeUnity logo priority', () => {
    const candidates = selectArtworkCandidates({
      providerValue: 'animeunity',
      info: infoWithArtwork({logo: 'provider'}),
      enhanced: {logo: 'https://cinemeta.test/logo.png'},
    });

    expect(candidates.logo).toEqual(['https://provider.test/logo.svg']);
  });

  it('deduplicates fallback URLs and detects remote SVG logos', () => {
    const candidates = selectArtworkCandidates({
      providerValue: 'streamingunity',
      info: infoWithArtwork({background: 'provider'}),
      enhanced: {background: 'https://provider.test/background.jpg'},
    });

    expect(candidates.background[0]).toBe(
      'https://provider.test/background.jpg',
    );
    expect(
      candidates.background.filter(
        item => item === 'https://provider.test/background.jpg',
      ),
    ).toHaveLength(1);
    expect(isSvgArtworkUri('https://provider.test/logo.svg?cache=1')).toBe(
      true,
    );
    expect(isSvgArtworkUri('https://provider.test/logo.png')).toBe(false);
  });
});
