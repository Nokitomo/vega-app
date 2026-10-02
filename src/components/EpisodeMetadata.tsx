import Ionicons from '@expo/vector-icons/Ionicons';
import React, {memo, useEffect, useMemo, useState} from 'react';
import {Image, Text, View} from 'react-native';

interface EpisodeMetadataProps {
  title: string;
  label?: string;
  fillerLabel?: string;
  synopsis?: string;
  thumbnail?: string;
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
  accentColor,
}: EpisodeMetadataProps): React.JSX.Element => {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
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
    setThumbnailFailed(false);
  }, [normalizedThumbnail]);

  const showThumbnail = !!normalizedThumbnail && !thumbnailFailed;

  return (
    <>
      {showThumbnail ? (
        <View className="relative h-16 w-24 overflow-hidden rounded">
          <Image
            source={{uri: normalizedThumbnail}}
            className="h-full w-full"
            resizeMode="cover"
            onError={() => setThumbnailFailed(true)}
          />
          <View className="absolute inset-0 items-center justify-center bg-black/25">
            <Ionicons name="play-circle" size={30} color={accentColor} />
          </View>
        </View>
      ) : (
        <View className="w-8 items-center justify-center">
          <Ionicons name="play-circle" size={28} color={accentColor} />
        </View>
      )}

      <View className="min-w-0 flex-1 justify-center">
        {normalizedLabel || normalizedFillerLabel ? (
          <View className="mb-0.5 flex-row items-center gap-2">
            {normalizedFillerLabel ? (
              <View className="h-6 justify-center rounded-full bg-white px-2.5">
                <Text className="text-xs font-semibold text-black">
                  {normalizedFillerLabel}
                </Text>
              </View>
            ) : null}
            {normalizedLabel ? (
              <Text
                className="min-w-0 flex-1 text-[10px] font-medium text-white/60"
                numberOfLines={1}>
                {normalizedLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Text className="text-white" numberOfLines={1}>
          {title}
        </Text>
        {normalizedSynopsis ? (
          <Text className="mt-0.5 text-xs text-white/70" numberOfLines={2}>
            {normalizedSynopsis}
          </Text>
        ) : null}
      </View>
    </>
  );
};

export default memo(EpisodeMetadata);
