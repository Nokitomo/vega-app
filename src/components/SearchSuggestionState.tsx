import React from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import useThemeStore from '../lib/zustand/themeStore';
import {HOME_FONT} from './homePresentation';

export default function SearchSuggestionState({
  status,
}: {
  status: 'idle' | 'loading' | 'ready' | 'error';
}) {
  const {t} = useTranslation();
  const primary = useThemeStore(state => state.primary);
  return (
    <View
      style={{padding: 24, alignItems: 'center'}}
      accessibilityLiveRegion="polite">
      {status === 'loading' && <ActivityIndicator color={primary} />}
      <Text
        style={{
          color: '#a0a0a0',
          fontFamily: HOME_FONT.regular,
          fontSize: 16,
          textAlign: 'center',
          marginTop: 12,
        }}>
        {t(
          status === 'loading'
            ? 'Searching suggestions'
            : status === 'error'
              ? 'Suggestions unavailable; submit to search'
              : status === 'ready'
                ? 'No suggestions; submit to search'
                : 'Type at least two characters for suggestions',
        )}
      </Text>
    </View>
  );
}
