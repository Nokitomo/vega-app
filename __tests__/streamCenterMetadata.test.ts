import {describe, expect, it} from '@jest/globals';
import type {Info} from '../src/lib/providers/types';
import {
  episodeIdentity,
  streamCenterEpisodesOrigin,
  streamCenterMetaOrigin,
  unwrapStreamCenterEpisodes,
  unwrapStreamCenterInfo,
  wrapStreamCenterEpisodes,
  wrapStreamCenterInfo,
} from '../src/lib/services/streamCenterMetadata';

const sourceInfo: Info = {
  title: 'Test anime',
  image: '',
  synopsis: '',
  imdbId: '',
  type: 'series',
  linkList: [
    {
      title: 'Episodes 1-2',
      episodesLink: '20|1|2',
      availabilityStatus: 'available',
    },
  ],
  extra: {ids: {anilistId: 42}},
};

describe('StreamCenter shares source metadata without durable stream links', () => {
  it('wraps and unwraps content Info', () => {
    const wrapped = wrapStreamCenterInfo(sourceInfo, 'animeunity');
    const route = streamCenterEpisodesOrigin(
      wrapped.linkList[0].episodesLink || '',
    );
    expect(route?.source).toBe('animeunity');
    expect(route?.data.url).toBe('20|1|2');
    expect(unwrapStreamCenterInfo(wrapped)).toEqual(sourceInfo);
  });

  it('can identify a source from a StreamCenter link', () => {
    expect(
      streamCenterMetaOrigin('https://www.animeunity.so/anime/20-test')
        ?.source,
    ).toBe('animeunity');
  });

  it('rebuilds episode playback routes from stable source links', () => {
    const route = streamCenterEpisodesOrigin(
      wrapStreamCenterInfo(sourceInfo, 'animeunity').linkList[0]
        .episodesLink || '',
    );
    const sourceEpisodes = [{link: '101', title: 'Episode 1', episodeNumber: 1}];
    const wrapped = wrapStreamCenterEpisodes(sourceEpisodes, route!);
    expect(episodeIdentity(wrapped[0].link)).toBe('101');
    expect(unwrapStreamCenterEpisodes(wrapped)).toEqual(sourceEpisodes);
  });
});
