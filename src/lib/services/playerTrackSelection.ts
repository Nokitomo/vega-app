export type PlayerTrackLike = {
  sourceId?: string | null;
  uri?: string;
  index?: number;
  language?: string;
  title?: string;
  label?: string;
  type?: string;
  selected?: boolean;
};

/** Native Android events include side-loaded tracks; preserve their real indices. */
export function mergeSubtitleTracks(
  nativeTracks: PlayerTrackLike[],
  externalTracks: PlayerTrackLike[],
  matchByLabel = false,
) {
  const used = new Set<number>();
  const native = nativeTracks.map((track, index) => {
    const match = /^(?:\d+:)*external-subtitle-(\d+)$/.exec(track.sourceId || '');
    let externalIndex = match ? Number(match[1]) : -1;
    // AVPlayer does not expose Android's source ID. Consume each label only once.
    if (externalIndex < 0 && matchByLabel && track.title) {
      externalIndex = externalTracks.findIndex(
        (item, i) =>
          !used.has(i) &&
          item.title === track.title &&
          item.language === track.language,
      );
    }
    const external = externalTracks[externalIndex];
    if (external && !used.has(externalIndex)) {
      used.add(externalIndex);
      return {
        ...external,
        ...track,
        uri: external.uri,
        type: external.type || track.type,
        index: track.index ?? index,
        source: 'external' as const,
      };
    }
    return {...track, index: track.index ?? index, source: 'internal' as const};
  });
  let nextIndex =
    native.reduce((max, track) => Math.max(max, track.index), -1) + 1;
  return [
    ...native,
    ...externalTracks.flatMap((track, i) =>
      used.has(i)
        ? []
        : [{...track, index: nextIndex++, source: 'external' as const}],
    ),
  ];
}

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
