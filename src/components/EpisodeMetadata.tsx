import Ionicons from '@expo/vector-icons/Ionicons';
import React, {memo, useEffect, useMemo, useState} from 'react';
import {Image, Text, View} from 'react-native';
import {HOME_FONT} from './homePresentation';

interface EpisodeMetadataProps {
  title: string;
  label?: string;
  fillerLabel?: string;
  synopsis?: string;
  thumbnail?: string;
  fallbackThumbnail?: string;
  reserveThumbnail?: boolean;
  accentColor: string;
}

const normalizeOptionalText = (value?: string) => {
  const normalized = value?.trim();
  return normalized || undefined;
};

const EpisodeMetadata = ({
  title,
  label,
  fillerLabel,
  synopsis,
  thumbnail,
  fallbackThumbnail,
  reserveThumbnail = false,
  accentColor,
}: EpisodeMetadataProps): React.JSX.Element => {
  const [failedThumbnails, setFailedThumbnails] = useState<string[]>([]);
  const normalizedThumbnail = useMemo(
    () => normalizeOptionalText(thumbnail),
    [thumbnail],
  );
  const normalizedSynopsis = useMemo(
    () => normalizeOptionalText(synopsis),
    [synopsis],
  );
  const normalizedLabel = useMemo(() => normalizeOptionalText(label), [label]);
  const normalizedFillerLabel = useMemo(
    () => normalizeOptionalText(fillerLabel),
    [fillerLabel],
  );

  useEffect(() => {
    setFailedThumbnails([]);
  }, [normalizedThumbnail, fallbackThumbnail]);

  const displayedThumbnail = [normalizedThumbnail, normalizeOptionalText(fallbackThumbnail)]
    .find(uri => uri && !failedThumbnails.includes(uri));
  const showThumbnail = !!displayedThumbnail;

  return (
    <>
      {showThumbnail || reserveThumbnail ? (
        <View style={{position: 'relative', width: '44%', maxWidth: 160, aspectRatio: 16 / 9, overflow: 'hidden', alignSelf: 'flex-start', backgroundColor: '#23252b'}}>
          {showThumbnail && <Image
            source={{uri: displayedThumbnail}}
            className="h-full w-full"
            resizeMode="cover"
            onError={() => {if (displayedThumbnail) {setFailedThumbnails(previous => [...previous, displayedThumbnail]);}}}
          />}
          <View style={{position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)'}}>
            <Ionicons name="play-circle" size={30} color={accentColor} />
          </View>
        </View>
      ) : (
        <View className="w-8 items-center justify-center">
          <Ionicons name="play-circle" size={28} color={accentColor} />
        </View>
      )}

      <View style={{flex: 1, minWidth: 0}}>
        {normalizedLabel || normalizedFillerLabel ? (
          <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4}}>
            {normalizedFillerLabel ? (
              <View className="h-6 justify-center rounded-full bg-white px-2.5">
                <Text className="text-xs font-semibold text-black">
                  {normalizedFillerLabel}
                </Text>
              </View>
            ) : null}
            {normalizedLabel ? (
              <Text
                style={{flexShrink: 1, color: '#a0a0a8', fontFamily: HOME_FONT.regular, fontSize: 12, lineHeight: 18}}
                numberOfLines={1}>
                {normalizedLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Text style={{color: 'white', fontFamily: HOME_FONT.medium, fontSize: 14, lineHeight: 20}} numberOfLines={3}>
          {title}
        </Text>
        {normalizedSynopsis ? (
          <Text style={{marginTop: 4, color: '#a0a0a8', fontFamily: HOME_FONT.regular, fontSize: 12, lineHeight: 17}} numberOfLines={2}>
            {normalizedSynopsis}
          </Text>
        ) : null}
      </View>
    </>
  );
};

export default memo(EpisodeMetadata);
