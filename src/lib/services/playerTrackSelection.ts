export type PlayerTrackLike = {
  index?: number;
  language?: string;
  title?: string;
  label?: string;
  type?: string;
  selected?: boolean;
};

export type InitialTrackSelection = {
  listIndex: number;
  nativeIndex: number;
};

const normalizedTrackText = (track: PlayerTrackLike): string =>
  [track.language, track.title, track.label, track.type]
    .filter(value => typeof value === 'string')
    .join(' ')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');

const hasLanguage = (
  track: PlayerTrackLike,
  language: 'it' | 'en',
): boolean => {
  const code = String(track.language || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (code === language || code.startsWith(`${language}-`)) {
    return true;
  }

  const text = normalizedTrackText(track);
  const aliases =
    language === 'it'
      ? /(?:^|[\s[(,;:/-])(it|ita|italian|italiano)(?:$|[\s\]),;:/-])/
      : /(?:^|[\s[(,;:/-])(en|eng|english|inglese)(?:$|[\s\]),;:/-])/;
  return aliases.test(text);
};

const toSelection = (
  tracks: PlayerTrackLike[],
  listIndex: number,
): InitialTrackSelection => ({
  listIndex,
  nativeIndex:
    typeof tracks[listIndex]?.index === 'number'
      ? Number(tracks[listIndex].index)
      : listIndex,
});

export const pickInitialAudioTrack = (
  tracks: PlayerTrackLike[],
): InitialTrackSelection | undefined => {
  if (tracks.length === 0) {
    return undefined;
  }
  const italian = tracks.findIndex(track => hasLanguage(track, 'it'));
  if (italian >= 0) {
    return toSelection(tracks, italian);
  }
  const english = tracks.findIndex(track => hasLanguage(track, 'en'));
  if (english >= 0) {
    return toSelection(tracks, english);
  }
  const selected = tracks.findIndex(track => track.selected);
  return toSelection(tracks, selected >= 0 ? selected : 0);
};

export const pickItalianForcedSubtitle = (
  tracks: PlayerTrackLike[],
): InitialTrackSelection | undefined => {
  const forcedItalian = tracks.findIndex(track => {
    const text = normalizedTrackText(track);
    return (
      hasLanguage(track, 'it') &&
      /(?:^|[\s[(,;:/-])(forced|force|forzati|forzato|forzata)(?:$|[\s\]),;:/-])/.test(
        text,
      )
    );
  });
  return forcedItalian >= 0 ? toSelection(tracks, forcedItalian) : undefined;
};
