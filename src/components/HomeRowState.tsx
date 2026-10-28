import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {HOME_ACCENT, HOME_FONT} from './homePresentation';

export default function HomeRowState({
  error,
  onRetry,
  retrying = false,
}: {
  error?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const {t} = useTranslation();
  return (
    <View
      style={{
        marginHorizontal: 8,
        padding: 20,
        minHeight: 144,
        backgroundColor: '#141519',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}>
      <Ionicons
        name={error ? 'cloud-offline-outline' : 'albums-outline'}
        size={28}
        color="#A0A0A0"
      />
      <Text
        accessibilityLiveRegion="polite"
        style={{
          color: '#DADADA',
          textAlign: 'center',
          fontSize: 14,
          fontFamily: HOME_FONT.regular,
          lineHeight: 20,
        }}>
        {t(error ? 'Failed to load content' : 'No Content Found')}
      </Text>
      {error && onRetry ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={retrying}
          accessibilityState={{disabled: retrying, busy: retrying}}
          onPress={onRetry}
          style={{
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: 24,
            opacity: retrying ? 0.5 : 1,
          }}>
          <Text style={{color: HOME_ACCENT, fontFamily: HOME_FONT.bold}}>
            {t('Retry')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
