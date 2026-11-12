import React from 'react';
import {StyleSheet, Text, TouchableOpacity} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import useThemeStore from '../../lib/zustand/themeStore';
import {HOME_FONT} from '../homePresentation';
export const catalogStyles = StyleSheet.create({
  page: {flex: 1, backgroundColor: '#0b0b0d'},
  text: {color: '#ddd', fontFamily: HOME_FONT.regular, fontSize: 16},
  title: {
    color: 'white',
    fontFamily: HOME_FONT.bold,
    fontSize: 22,
    marginVertical: 12,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  row: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center'},
});
export function CatalogButton({
  label,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: 'arrow-up' | 'arrow-down' | 'close';
}) {
  const primary = useThemeStore(s => s.primary);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        catalogStyles.button,
        {opacity: disabled ? 0.4 : 1, minWidth: 48, alignItems: 'center'},
      ]}>
      {icon ? (
        <Ionicons name={icon} size={20} color={primary} />
      ) : (
        <Text style={[catalogStyles.text, {color: primary}]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
