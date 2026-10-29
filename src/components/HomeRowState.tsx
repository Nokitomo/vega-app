import {foregroundOnPrimary} from '../lib/utils/themeColors';
import useThemeStore from '../lib/zustand/themeStore';
import React from 'react';
import {ActivityIndicator, Text, TouchableOpacity, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {HOME_FONT} from './homePresentation';

export default function HomeRowState({
  error,
  onRetry,
  retrying = false,
  messageKey,
  retryTestID,
}: {
  error?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  messageKey?: string;
  retryTestID?: string;
}) {
  const {t} = useTranslation();
  const primary = useThemeStore(state => state.primary);
  const onPrimary = foregroundOnPrimary(primary);
  return (
    <View
      style={{
        marginHorizontal: 8,
        padding: 20,
        minHeight: 144,
        backgroundColor: 'black',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}>
      <Ionicons
        name={error ? 'cloud-offline-outline' : 'albums-outline'}
        size={40}
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
        {t(messageKey || (error ? 'Failed to load content' : 'No Content Found'))}
      </Text>
      {error && onRetry ? (
        <TouchableOpacity
          testID={retryTestID}
          accessibilityRole="button"
          accessibilityLabel={t('Retry')}
          disabled={retrying}
          accessibilityState={{disabled: retrying, busy: retrying}}
          onPress={onRetry}
          style={{
            minHeight: 48,
            justifyContent: 'center',
            paddingHorizontal: 24,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderRadius: 24,
            backgroundColor: primary,
            opacity: retrying ? 0.5 : 1,
          }}>
          {retrying && <ActivityIndicator color={onPrimary} size="small" />}
          <Text style={{color: onPrimary, fontFamily: HOME_FONT.bold}}>
            {t('Retry')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
