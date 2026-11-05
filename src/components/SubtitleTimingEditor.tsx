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
  trackLabel?: string;
  onApply: (value: number) => void;
  onCancel: () => void;
};

export default function SubtitleTimingEditor({
  value,
  accentColor,
  trackLabel,
  onApply,
  onCancel,
}: Props) {
  const {t, i18n} = useTranslation();
  const [draft, setDraft] = useState(String(value / 1000));
  const [editing, setEditing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
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
    caption = label,
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
      <Text style={[styles.text, primary && {color: accentColor}]}>
        {caption}
      </Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.heading}>{t('subtitleTimingTitle')}</Text>
          {!!trackLabel && (
            <Text numberOfLines={1} style={styles.track}>
              {trackLabel}
            </Text>
          )}
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('subtitleTimingHelpToggle')}
          accessibilityState={{expanded: showHelp}}
          onPress={() => setShowHelp(previous => !previous)}
          style={styles.helpButton}>
          <Text style={styles.helpIcon}>?</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {showHelp && <Text style={styles.help}>{t('subtitleTimingHelp')}</Text>}
        {editing ? (
          <TextInput
            accessibilityLabel={t('subtitleTimingSeconds')}
            value={draft}
            onChangeText={setDraft}
            keyboardType="numeric"
            selectTextOnFocus
            maxLength={12}
            style={styles.input}
            placeholderTextColor="#aaa"
            autoFocus
            onSubmitEditing={() => parsed !== null && setEditing(false)}
          />
        ) : (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('subtitleTimingEditValue')}
            onPress={() => setEditing(true)}
            style={styles.valueButton}>
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.value, {color: accentColor}]}>
              {parsed === null
                ? '—'
                : `${parsed > 0 ? '+' : parsed < 0 ? '−' : ''}${(Math.abs(parsed) / 1000).toLocaleString(i18n.language, {maximumFractionDigits: 3})} s`}
            </Text>
            <Text style={styles.hint}>{t('subtitleTimingEditHint')}</Text>
          </TouchableOpacity>
        )}
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {parsed === null ? t('subtitleTimingInvalid') : describe(parsed)}
        </Text>
        <View style={styles.row}>
          {[-1000, -100, 100, 1000].map(step => {
            const seconds = (Math.abs(step) / 1000).toLocaleString(
              i18n.language,
            );
            return (
              <React.Fragment key={step}>
                {button(
                  t(
                    step < 0 ? 'subtitleTimingEarlier' : 'subtitleTimingLater',
                    {seconds},
                  ),
                  () => adjust(step),
                  false,
                  false,
                  `${step < 0 ? '−' : '+'}${seconds} s`,
                )}
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {button(t('subtitleTimingCancel'), onCancel)}
        {button(t('subtitleTimingReset'), () => onApply(0))}
        {button(
          t('subtitleTimingApply'),
          () => parsed !== null && onApply(parsed),
          parsed === null,
          true,
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, paddingHorizontal: 8},
  header: {flexDirection: 'row', alignItems: 'center', gap: 8},
  titleBlock: {flex: 1},
  heading: {fontFamily: HOME_FONT.bold, color: '#fff', fontSize: 18},
  track: {
    fontFamily: HOME_FONT.regular,
    color: '#aeb1b8',
    fontSize: 12,
    marginTop: 3,
  },
  helpButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpIcon: {fontFamily: HOME_FONT.bold, color: '#aeb1b8', fontSize: 20},
  body: {flex: 1},
  content: {gap: 6, paddingVertical: 6},
  text: {
    fontFamily: HOME_FONT.medium,
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  help: {fontFamily: HOME_FONT.regular, color: '#aeb1b8', fontSize: 13},
  valueButton: {alignItems: 'center', minHeight: 64, justifyContent: 'center'},
  value: {fontFamily: HOME_FONT.bold, fontSize: 30, textAlign: 'center'},
  hint: {fontFamily: HOME_FONT.regular, color: '#aeb1b8', fontSize: 11},
  status: {
    fontFamily: HOME_FONT.medium,
    fontSize: 13,
    color: '#d6d8dd',
    textAlign: 'center',
  },
  input: {
    fontFamily: HOME_FONT.regular,
    color: '#fff',
    backgroundColor: '#23252b',
    padding: 10,
    borderWidth: 1,
    borderColor: '#555',
    minHeight: 48,
  },
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  button: {
    minHeight: 48,
    flexGrow: 1,
    flexBasis: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#23252b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
});
