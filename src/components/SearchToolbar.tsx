import React from 'react';
import {Pressable, StyleSheet, TextInput, View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import useThemeStore from '../lib/zustand/themeStore';
import {HOME_FONT} from './homePresentation';

export default function SearchToolbar({
  value,
  onChangeText,
  onSubmit,
  onBack,
  placeholder,
  autoFocus = false,
  testID,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (text: string) => void;
  onBack?: () => void;
  placeholder: string;
  autoFocus?: boolean;
  testID?: string;
}) {
  const {t} = useTranslation();
  const primary = useThemeStore(state => state.primary);
  return (
    <View style={styles.bar}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('Close search')}
          style={styles.button}>
          <Feather name="arrow-left" size={26} color="white" />
        </Pressable>
      ) : (
        <View style={styles.button}>
          <Feather name="search" size={24} color="white" />
        </View>
      )}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={event => onSubmit(event.nativeEvent.text)}
        autoFocus={autoFocus}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        placeholderTextColor="#a0a0a0"
        selectionColor={primary}
        returnKeyType="search"
        style={styles.input}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel={t('Clear search')}
          style={styles.button}>
          <Feather name="x" size={28} color="white" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#23252b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minHeight: 56,
  },
  button: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 4,
    color: 'white',
    fontFamily: HOME_FONT.heading,
    fontSize: 22,
  },
});
