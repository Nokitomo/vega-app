import React from 'react';
import {StyleSheet, Text, TouchableOpacity} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import useThemeStore from '../../lib/zustand/themeStore';
import {HOME_FONT} from '../homePresentation';
export const catalogStyles = StyleSheet.create({
  page: {flex: 1, backgroundColor: 'black'},
  text: {color: '#ddd', fontFamily: HOME_FONT.regular, fontSize: 16},
  title: {
    color: 'white',
    fontFamily: HOME_FONT.heading,
    fontSize: 22,
    marginVertical: 12,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#35363b',
    backgroundColor: '#23252b',
    marginRight: 8,
    marginBottom: 8,
  },
  row: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center'},
});
export function CatalogButton({
  label,
  onPress,
  disabled = false,
  icon,
  selected,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: 'arrow-up' | 'arrow-down' | 'close';
  selected?: boolean;
  destructive?: boolean;
}) {
  const primary = useThemeStore(s => s.primary);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled, selected}}
      disabled={disabled}
      onPress={onPress}
      style={[
        catalogStyles.button,
        {
          opacity: disabled ? 0.4 : 1,
          minWidth: 48,
          alignItems: 'center',
          borderColor: selected ? primary : '#35363b',
        },
      ]}>
      {icon ? (
        <Ionicons name={icon} size={20} color={destructive ? '#ff8d88' : selected ? primary : '#ddd'} />
      ) : (
        <Text style={[catalogStyles.text, {color: destructive ? '#ff8d88' : selected ? primary : 'white', fontFamily: HOME_FONT.medium}]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
