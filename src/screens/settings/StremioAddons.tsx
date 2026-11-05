import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {MaterialIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {SettingsStackParamList} from '../../App';
import {settingsPresentation} from '../../components/settingsPresentation';
import useThemeStore from '../../lib/zustand/themeStore';
import {
  addonConfigurationUrl,
  getStremioAddons,
  inspectStremioAddon,
  installStremioAddon,
  refreshStremioAddon,
  removeStremioAddon,
  subscribeStremioAddons,
  supportsSubtitles,
  toggleStremioAddon,
  type StremioAddon,
} from '../../lib/services/stremioAddons';

export default function StremioAddons({
  navigation,
}: NativeStackScreenProps<SettingsStackParamList, 'StremioAddons'>) {
  const {t} = useTranslation();
  const primary = useThemeStore(s => s.primary);
  const [addons, setAddons] = useState(getStremioAddons);
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<StremioAddon | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeStremioAddons(() =>
      setAddons(getStremioAddons()),
    );
    return () => {
      mounted.current = false;
      request.current?.abort();
      unsubscribe();
    };
  }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (e) {
      if (mounted.current) {
        setMessage(e instanceof Error ? e.message : t('addon.unavailable'));
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
      }
    }
  };
  const status = (addon: StremioAddon) =>
    addon.configurationRequired
      ? t('addon.configurationRequired')
      : !supportsSubtitles(addon)
        ? t('addon.unsupported')
        : addon.resources.some(r => r.name !== 'subtitles')
          ? t('addon.partial')
          : t('addon.compatible');
  const button = (
    label: string,
    action: () => void,
    icon: React.ComponentProps<typeof MaterialIcons>['name'],
  ) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={action}
      style={styles.action}>
      <MaterialIcons name={icon} size={19} color={primary} />
      <Text style={[styles.actionText, {color: primary}]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <SafeAreaView style={settingsPresentation.page}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('Back')}
          onPress={() => navigation.goBack()}
          style={styles.back}>
          <MaterialIcons name="arrow-back" color="white" size={24} />
        </TouchableOpacity>
        <Text style={settingsPresentation.title}>{t('addon.title')}</Text>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        <Text style={styles.muted}>{t('addon.intro')}</Text>
        <View style={styles.card}>
          <Text style={styles.heading}>{t('addon.add')}</Text>
          <TextInput
            accessibilityLabel={t('addon.manifestUrl')}
            placeholder={t('addon.manifestUrl')}
            placeholderTextColor="#999"
            value={url}
            editable={!busy}
            onChangeText={value => {
              setUrl(value);
              setPreview(null);
              setMessage('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          {button(
            t('addon.inspect'),
            () => {
              run(async () => {
                request.current?.abort();
                request.current = new AbortController();
                const value = await inspectStremioAddon(
                  url,
                  request.current.signal,
                );
                if (mounted.current) {
                  setPreview(value);
                }
              });
            },
            'search',
          )}
          {preview && (
            <View style={styles.preview}>
              <Text style={styles.heading}>{preview.name}</Text>
              <Text style={styles.muted}>{status(preview)}</Text>
              <Text style={styles.muted}>{preview.description}</Text>
              {button(
                t('addon.install'),
                () => {
                  try {
                    installStremioAddon(preview);
                    setPreview(null);
                    setUrl('');
                    setMessage(t('addon.installed'));
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                },
                'add-circle-outline',
              )}
              {preview.configurable &&
                button(
                  t('addon.configure'),
                  () => {
                    run(async () => {
                      await Linking.openURL(
                        addonConfigurationUrl(preview),
                      ).catch(() => {
                        throw new Error(t('addon.unavailable'));
                      });
                    });
                  },
                  'open-in-new',
                )}
            </View>
          )}
        </View>
        {busy && <ActivityIndicator color={primary} />}
        {!!message && (
          <Text accessibilityRole="alert" style={styles.message}>
            {message}
          </Text>
        )}
        <Text style={styles.heading}>
          {t('addon.installedCount', {count: addons.length})}
        </Text>
        {!addons.length && <Text style={styles.muted}>{t('addon.empty')}</Text>}
        {addons.map(addon => (
          <View key={addon.url} style={styles.card}>
            <View style={styles.row}>
              <MaterialIcons name="extension" color={primary} size={27} />
              <View style={styles.details}>
                <Text style={styles.heading}>{addon.name}</Text>
                <Text style={styles.muted}>
                  {new URL(addon.url).hostname} · {addon.version}
                </Text>
              </View>
              <Switch
                accessibilityLabel={t('addon.enable', {name: addon.name})}
                value={addon.enabled}
                disabled={busy || !supportsSubtitles(addon)}
                onValueChange={() => toggleStremioAddon(addon.url)}
                trackColor={{false: '#444', true: primary}}
                thumbColor={addon.enabled ? '#fff' : '#bbb'}
              />
            </View>
            <Text
              style={[
                styles.muted,
                {color: supportsSubtitles(addon) ? primary : '#d6b778'},
              ]}>
              {status(addon)}
            </Text>
            {!!addon.description && (
              <Text style={styles.muted}>{addon.description}</Text>
            )}
            <Text style={styles.muted}>
              {t('addon.resources', {
                resources: addon.resources
                  .map(r => (r.name === 'subtitles' ? t('Subtitles') : r.name))
                  .join(', '),
              })}
            </Text>
            <View style={styles.actions}>
              {button(
                t('addon.refresh'),
                () => {
                  run(async () => {
                    await refreshStremioAddon(addon.url);
                    if (mounted.current) {
                      setMessage(t('addon.refreshed'));
                    }
                  });
                },
                'refresh',
              )}
              {addon.configurable &&
                button(
                  t('addon.configure'),
                  () => {
                    run(async () => {
                      await Linking.openURL(addonConfigurationUrl(addon)).catch(
                        () => {
                          throw new Error(t('addon.unavailable'));
                        },
                      );
                    });
                  },
                  'open-in-new',
                )}
              {button(
                t('addon.remove'),
                () =>
                  Alert.alert(
                    t('addon.remove'),
                    t('addon.removeConfirm', {name: addon.name}),
                    [
                      {text: t('Cancel'), style: 'cancel'},
                      {
                        text: t('addon.remove'),
                        style: 'destructive',
                        onPress: () => removeStremioAddon(addon.url),
                      },
                    ],
                  ),
                'delete-outline',
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#252525',
  },
  back: {padding: 12},
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#303030',
    backgroundColor: '#141414',
  },
  heading: {
    ...settingsPresentation.bold,
    color: 'white',
    fontSize: 17,
    flexShrink: 1,
  },
  muted: {
    ...settingsPresentation.body,
    color: '#b6b6b6',
    fontSize: 13,
    lineHeight: 20,
  },
  input: {
    ...settingsPresentation.body,
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
    color: 'white',
  },
  action: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  actionText: {...settingsPresentation.medium, fontSize: 14, flexShrink: 1},
  row: {flexDirection: 'row', gap: 10, alignItems: 'center'},
  details: {flex: 1, gap: 3},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  preview: {gap: 10, borderTopWidth: 1, borderColor: '#333', paddingTop: 14},
  message: {...settingsPresentation.body, color: '#e5c58e', lineHeight: 21},
});
