import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import {HOME_FONT} from './homePresentation';
import {Text, TouchableOpacity, View} from 'react-native';

type Props = {
  title: string;
  detail?: string;
  quality?: string;
  tags?: string[];
  selected?: boolean;
  accentColor: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
};

const PlayerMenuRow = ({
  title,
  detail,
  quality,
  tags,
  selected = false,
  accentColor,
  icon,
  onPress,
}: Props): React.JSX.Element => {
  const allTags = [
    ...(quality?.trim() ? [quality.trim()] : []),
    ...(tags || []),
  ];

  return (
    <TouchableOpacity
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityState={{selected}}
      className="mx-1 my-1 min-h-12 flex-row items-center px-3 py-2.5"
      style={{
        backgroundColor: selected ? 'rgba(255,255,255,0.11)' : '#23252b',
        borderWidth: 1,
        borderColor: selected ? accentColor : 'rgba(255,255,255,0.07)',
      }}
      onPress={onPress}>
      {icon && (
        <MaterialIcons
          name={icon}
          size={21}
          color={selected ? accentColor : 'rgba(255,255,255,0.78)'}
          style={{marginRight: 12}}
        />
      )}
      <View className="min-w-0 flex-1">
        <Text
          style={{fontFamily: HOME_FONT.medium}}
          className="text-base font-semibold text-white"
          numberOfLines={1}>
          {title}
        </Text>
        {allTags.length > 0 && (
          <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
            {allTags.map((tag, index) => (
              <View
                key={`${tag}-${index}`}
                className="rounded-md px-2 py-0.5"
                style={{backgroundColor: 'rgba(255,255,255,0.12)'}}>
                <Text
                  style={{fontFamily: HOME_FONT.bold}}
                  className="text-[10px] font-bold uppercase tracking-wider text-white">
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}
        {Boolean(detail) && (
          <Text
            style={{fontFamily: HOME_FONT.regular}}
            className="mt-0.5 text-xs text-white/55"
            numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
      {selected && (
        <MaterialIcons
          name="check-circle"
          size={22}
          color={accentColor}
          style={{marginLeft: 12}}
        />
      )}
    </TouchableOpacity>
  );
};

export default React.memo(PlayerMenuRow);
