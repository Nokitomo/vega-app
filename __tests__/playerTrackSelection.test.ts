import {describe, expect, it} from '@jest/globals';
import {
  pickInitialAudioTrack,
  pickItalianForcedSubtitle,
} from '../src/lib/services/playerTrackSelection';

describe('player track defaults', () => {
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
