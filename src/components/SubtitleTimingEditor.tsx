import React, {useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {HOME_FONT} from './homePresentation';
import {
  MAX_SUBTITLE_DELAY_MS,
  parseSubtitleDelay,
} from '../lib/utils/subtitleTiming';

type Props = {
  value: number;
  accentColor: string;
  onApply: (value: number) => void;
  onCancel: () => void;
};

export default function SubtitleTimingEditor({
  value,
  accentColor,
  onApply,
  onCancel,
}: Props) {
  const {t, i18n} = useTranslation();
  const [draft, setDraft] = useState(String(value / 1000));
  const parsed = parseSubtitleDelay(draft);
  const describe = (ms: number) =>
    t(
      ms === 0
        ? 'subtitleTimingOriginal'
        : ms > 0
          ? 'subtitleTimingDelayed'
          : 'subtitleTimingAdvanced',
      {
        seconds: (Math.abs(ms) / 1000).toLocaleString(i18n.language, {
          maximumFractionDigits: 3,
        }),
      },
    );
  const adjust = (step: number) => {
    const next = Math.max(
      -MAX_SUBTITLE_DELAY_MS,
      Math.min(MAX_SUBTITLE_DELAY_MS, (parsed ?? value) + step),
    );
    setDraft(String(next / 1000));
  };
  const button = (
    label: string,
    onPress: () => void,
    disabled = false,
    primary = false,
  ) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        primary && {borderColor: accentColor},
        disabled && {opacity: 0.4},
      ]}>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{t('subtitleTimingTitle')}</Text>
      <Text style={styles.text}>{t('subtitleTimingHelp')}</Text>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.status, {color: accentColor}]}>
        {parsed === null ? t('subtitleTimingInvalid') : describe(parsed)}
      </Text>
      <Text style={styles.text}>{t('subtitleTimingSeconds')}</Text>
      <TextInput
        accessibilityLabel={t('subtitleTimingSeconds')}
        value={draft}
        onChangeText={setDraft}
        keyboardType="numeric"
        selectTextOnFocus
        maxLength={12}
        style={styles.input}
        placeholderTextColor="#aaa"
      />
      <View style={styles.row}>
        {button(t('subtitleTimingEarlier', {seconds: '1'}), () =>
          adjust(-1000),
        )}
        {button(
          t('subtitleTimingEarlier', {
            seconds: (0.1).toLocaleString(i18n.language),
          }),
          () => adjust(-100),
        )}
      </View>
      <View style={styles.row}>
        {button(
          t('subtitleTimingLater', {
            seconds: (0.1).toLocaleString(i18n.language),
          }),
          () => adjust(100),
        )}
        {button(t('subtitleTimingLater', {seconds: '1'}), () => adjust(1000))}
      </View>
      <View style={styles.row}>
        {button(t('subtitleTimingCancel'), onCancel)}
        {button(t('subtitleTimingReset'), () => onApply(0))}
        {button(
          t('subtitleTimingApply'),
          () => parsed !== null && onApply(parsed),
          parsed === null,
          true,
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  content: {padding: 12, gap: 10},
  heading: {fontFamily: HOME_FONT.bold, color: '#fff', fontSize: 20},
  text: {fontFamily: HOME_FONT.regular, color: '#fff', fontSize: 14},
  status: {fontFamily: HOME_FONT.medium, fontSize: 16},
  input: {
    fontFamily: HOME_FONT.regular,
    color: '#fff',
    backgroundColor: '#23252b',
    padding: 10,
    borderWidth: 1,
    borderColor: '#555',
    minHeight: 48,
  },
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  button: {
    minHeight: 48,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#23252b',
    borderWidth: 1,
    borderColor: '#444',
  },
});
