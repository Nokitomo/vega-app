import {describe, expect, it} from '@jest/globals';
import {
  pickInitialAudioTrack,
  pickItalianForcedSubtitle,
  mergeSubtitleTracks,
} from '../src/lib/services/playerTrackSelection';

describe('player track defaults', () => {
  it('keeps exact native indices and avoids duplicate side-loaded subtitles', () => {
    const external = [
      {
        title: 'Italian',
        language: 'it',
        uri: 'file:///one.srt',
        type: 'application/x-subrip',
      },
      {title: 'Italian', language: 'it', uri: 'file:///two.srt'},
    ];
    const tracks = mergeSubtitleTracks(
      [
        {index: 0, title: 'Italian', language: 'it'},
        {
          index: 1,
          title: 'Italian',
          language: 'it',
          sourceId: '1:external-subtitle-0',
          type: 'application/x-media3-cues',
        },
        {
          index: 2,
          title: 'Italian',
          language: 'it',
          sourceId: '2:external-subtitle-1',
        },
      ],
      external,
    );
    expect(tracks).toHaveLength(3);
    expect(tracks[0].source).toBe('internal');
    expect(tracks[1]).toMatchObject({
      index: 1,
      source: 'external',
      uri: 'file:///one.srt',
      type: 'application/x-subrip',
    });
    expect(tracks[2]).toMatchObject({
      index: 2,
      source: 'external',
      uri: 'file:///two.srt',
    });
    expect(
      mergeSubtitleTracks([{index: 4, title: 'Embedded'}], external).map(
        t => t.index,
      ),
    ).toEqual([4, 5, 6]);
  });
  it('matches each AVPlayer external label once when Android IDs are unavailable', () => {
    const track = {title: 'Italian', language: 'it'};
    expect(
      mergeSubtitleTracks([track], [{...track, uri: 'file:///one.srt'}], true),
    ).toEqual([
      {...track, uri: 'file:///one.srt', index: 0, source: 'external'},
    ]);
  });
  it('prefers Italian audio and uses the native track index', () => {
    expect(
      pickInitialAudioTrack([
        {index: 4, language: 'en', title: 'English'},
        {index: 8, language: 'it-IT', title: 'Italiano'},
      ]),
    ).toEqual({listIndex: 1, nativeIndex: 8});
  });

  it('prefers English when Italian audio is unavailable', () => {
    expect(
      pickInitialAudioTrack([
        {language: 'ja'},
        {language: 'eng', title: 'English'},
      ]),
    ).toEqual({listIndex: 1, nativeIndex: 1});
  });

  it('selects only forced Italian subtitles', () => {
    const tracks = [
      {index: 2, language: 'it', title: 'Italiano'},
      {index: 7, language: 'it-forced', title: 'Italiano'},
      {index: 9, language: 'en', title: 'English Forced'},
    ];
    expect(pickItalianForcedSubtitle(tracks)).toEqual({
      listIndex: 1,
      nativeIndex: 7,
    });
    expect(
      pickItalianForcedSubtitle([{language: 'it', title: 'Italiano'}]),
    ).toBeUndefined();
  });
});
