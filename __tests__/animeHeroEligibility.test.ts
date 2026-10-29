import {describe, expect, it} from '@jest/globals';
import {buildHeroArtworkOrigins, hasMappedHeroIdentity, isHeroArtworkEligible} from '../src/lib/utils/animeHeroEligibility';
import type {AnimeHeroMetadata} from '../src/lib/utils/animeHeroEligibility';
import {selectArtworkCandidates} from '../src/lib/services/artworkSelection';
import type {Info} from '../src/lib/providers/types';

const info: AnimeHeroMetadata = {background: 'external-bg', image: 'provider-poster',
  extra: {ids: {tmdbShowIds: [123]}, artworkSources: {background: 'tmdb'}}};
const route = (source: string) => `streamcenter:v1:meta:${source}:${encodeURIComponent(JSON.stringify({url: 'https://example.test/anime/1'}))}`;

describe('anime hero eligibility', () => {
  it('requires mapped IDs, not merely an AniList/MAL catalog identity', () => {
    expect(hasMappedHeroIdentity(info)).toBe(true);
    expect(hasMappedHeroIdentity({extra: {ids: {anilistId: 1, malId: 2}}})).toBe(false);
    expect(hasMappedHeroIdentity({extra: {ids: {tvdbShowIds: [0, -1, NaN]}}})).toBe(false);
    expect(hasMappedHeroIdentity({extra: {ids: {tvdbMovieIds: [22]}}})).toBe(true);
    expect(hasMappedHeroIdentity({imdbId: 'tt123'})).toBe(true);
    expect(hasMappedHeroIdentity({imdbId: 'unknown'})).toBe(false);
  });
  it('accepts known external artwork from legacy caches and rejects provider/unknown images', () => {
    expect(isHeroArtworkEligible('animeunity', '/anime/1', info, 'external-bg')).toBe(true);
    expect(isHeroArtworkEligible('animeunity', '/anime/1', info, 'provider-poster')).toBe(false);
    expect(isHeroArtworkEligible('animeunity', '/anime/1', info, 'unknown')).toBe(false);
    expect(isHeroArtworkEligible('animeunity', '/anime/1', undefined, 'external-bg')).toBe(false);
  });
  it('scopes the rule to the anime source even through StreamCenter', () => {
    expect(isHeroArtworkEligible('streamcenter', route('animeunity'), undefined, 'provider')).toBe(false);
    expect(isHeroArtworkEligible('streamcenter', route('animeunity'), info, 'external-bg')).toBe(true);
    expect(isHeroArtworkEligible('streamcenter', route('streamingunity'), undefined, 'provider')).toBe(true);
    expect(isHeroArtworkEligible('streamingunity', '/titles/1', undefined, 'provider')).toBe(true);
  });
  it('records external fallback provenance without changing candidate order', () => {
    const data = {...info, background: undefined} as Info;
    const before = selectArtworkCandidates({providerValue: 'animeunity', info: data, enhanced: {banner: 'anilist-banner'}});
    const origins = buildHeroArtworkOrigins(data, 'anilist-banner');
    expect(before.background).toEqual(['anilist-banner', 'provider-poster']);
    expect(isHeroArtworkEligible('animeunity', '/anime/1', {...data, heroArtworkOrigins: origins}, before.background[0])).toBe(true);
    expect(isHeroArtworkEligible('animeunity', '/anime/1', {...data, heroArtworkOrigins: origins}, before.background[1])).toBe(false);
    expect(selectArtworkCandidates({providerValue: 'animeunity', info: data, enhanced: {banner: 'anilist-banner'}})).toEqual(before);
  });
  it('does not relabel a provider background as an external image', () => {
    const data: AnimeHeroMetadata = {...info, extra: {...info.extra, artworkSources: {background: 'provider'}}};
    expect(isHeroArtworkEligible('animeunity', '/anime/1', {...data,
      heroArtworkOrigins: buildHeroArtworkOrigins(data, 'external-bg')}, 'external-bg')).toBe(false);
  });
});
