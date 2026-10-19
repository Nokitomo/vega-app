import {describe, expect, it} from '@jest/globals';
import type {Info} from '../src/lib/providers/types';
import {
  episodeIdentity,
  getMetadataSourceProvider,
  resolveSavedStreamCenterLink,
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

  it('reuses saved StreamCenter links across provider domain changes', () => {
    const animeOld = 'https://www.animeunity.so/anime/42-example';
    const animeMirror =
      'streamcenter:v1:meta:animeunity:%7B%22url%22%3A%22https%3A%2F%2Fmirror.example%2Fanime%2F42-example%22%7D';
    const streamingOld = 'https://streamingunity.vip/it/titles/75-example';
    const streamingMirror =
      'streamcenter:v1:meta:streamingunity:%7B%22url%22%3A%22https%3A%2F%2Fmirror.example%2Fit%2Ftitles%2F75-example%22%7D';
    const saved = [
      {provider: 'streamcenter', link: animeOld},
      {provider: 'streamcenter', link: streamingOld},
      {provider: 'animeunity', link: 'https://www.animeunity.so/anime/76-other'},
    ];
    expect(resolveSavedStreamCenterLink('streamcenter', animeMirror, saved))
      .toBe(animeOld);
    expect(resolveSavedStreamCenterLink('streamcenter', streamingMirror, saved))
      .toBe(streamingOld);
    expect(resolveSavedStreamCenterLink('streamcenter', animeMirror, [
      {provider: 'streamcenter', link: animeMirror}, ...saved,
    ])).toBe(animeMirror);
    expect(resolveSavedStreamCenterLink('streamcenter', animeMirror, [
      {provider: 'animeunity', link: animeOld},
    ])).toBe(animeMirror);
    expect(resolveSavedStreamCenterLink('animeunity', animeMirror, saved))
      .toBe(animeMirror);
    expect(resolveSavedStreamCenterLink(
      'streamcenter',
      'streamcenter:v1:meta:streamingunity:%7B%22url%22%3A%22https%3A%2F%2Fmirror.example%2Fit%2Ftitles%2F76-other%22%7D',
      saved,
    )).not.toBe(streamingOld);
    expect(resolveSavedStreamCenterLink(
      'streamcenter',
      'streamcenter:v1:meta:animeunity:%7B%22url%22%3A%22https%3A%2F%2Fmirror.example%2Funknown%22%7D',
      saved,
    )).not.toBe(animeOld);
  });

  it('can identify a source from a StreamCenter link', () => {
    expect(
      streamCenterMetaOrigin('https://www.animeunity.so/anime/20-test')
        ?.source,
    ).toBe('animeunity');
    expect(getMetadataSourceProvider(
      'streamcenter',
      'https://www.animeunity.so/anime/20-test',
    )).toBe('animeunity');
    expect(getMetadataSourceProvider(
      'streamcenter',
      'https://streamingunity.vip/it/titles/42-test',
    )).toBe('streamingunity');
    expect(getMetadataSourceProvider(
      'streamcenter',
      'streamcenter:v1:meta:animeunity:%7B%22url%22%3A%2220%22%7D',
    )).toBe('animeunity');
    expect(getMetadataSourceProvider('streamcenter', 'unknown-link'))
      .toBe('streamcenter');
    expect(getMetadataSourceProvider(
      'animeunity',
      'https://streamingunity.vip/it/titles/42-test',
    )).toBe('animeunity');
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
