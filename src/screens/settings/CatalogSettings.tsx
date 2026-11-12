import React, {useEffect, useState} from 'react';
import {Alert, ScrollView, Switch, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {useCatalogStore} from '../../lib/catalog/store';
import {catalogNative} from '../../lib/catalog/native';
import {
  configureCatalogTransfer,
  resumeCatalogPreparation,
  pauseCatalogPreparation,
  discardCatalogDownload,
  isCatalogPreparationPaused,
  removeCatalog,
  startCatalogDownload,
} from '../../lib/catalog/installer';
import {catalogImageRules} from '../../lib/catalog/reader';
import {
  defaultCatalogPreferences,
  imageFields,
  tmdbSizes,
} from '../../lib/catalog/preferences';
import type {CatalogSection, ImageField} from '../../lib/catalog/types';
import {
  CatalogButton,
  catalogStyles,
} from '../../components/catalog/CatalogViews';
import useThemeStore from '../../lib/zustand/themeStore';
import {CATALOG_MANIFEST_URL, parseManifest} from '../../lib/catalog/manifest';

const size = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
export default function CatalogSettings() {
  const {t} = useTranslation();
  const {
    preferences: prefs,
    installed,
    transfer,
    setPreferences,
    setTransfer,
  } = useCatalogStore();
  const primary = useThemeStore(s => s.primary);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [field, setField] = useState<ImageField>('poster');
  const [edit, setEdit] = useState<CatalogSection>();
  const rules = useQuery({
    queryKey: ['catalog-image-rules', installed?.revision],
    enabled: !!installed,
    queryFn: catalogImageRules,
    staleTime: Infinity,
  });
  const publication = useQuery({
    queryKey: ['catalog-publication'],
    staleTime: 120000,
    retry: 1,
    queryFn: async ({signal}) => {
      const response = await fetch(CATALOG_MANIFEST_URL, {signal});
      if (!response.ok) {
        throw new Error('catalog.transferFailed');
      }
      return parseManifest(await response.json());
    },
  });
  useEffect(() => {
    let alive = true;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (busy || useCatalogStore.getState().transfer.status === 'installing') {
        return;
      }
      try {
        catalogNative()
          .pending()
          .then(value => {
            if (alive) {
              setPending(!!value);
            }
          })
          .catch(() => {});
      } catch {}
      if (busy || useCatalogStore.getState().transfer.status === 'installing') {
        return;
      }
      try {
        catalogNative()
          .status()
          .then(value => {
            const current = useCatalogStore.getState().transfer;
            if (
              alive &&
              current.status !== 'installing' &&
              !isCatalogPreparationPaused() &&
              !(current.status === 'error' && value.status === 'downloaded')
            ) {
              setTransfer(value);
            }
          })
          .catch(() => {});
      } catch {
        /* Older native client: action displays rebuild guidance. */
      }
    }, 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [setTransfer, busy]);
  const run = async (action: () => Promise<unknown>) => {
    if (busy || useCatalogStore.getState().transfer.status === 'installing') {
      return;
    }
    setBusy(true);
    try {
      await action();
    } catch (e) {
      const message =
        e instanceof Error && /^catalog\.[a-zA-Z]+$/.test(e.message)
          ? e.message
          : 'catalog.transferFailed';
      Alert.alert(t('catalog.title'), t(message));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (
    key: 'selected' | 'automatic' | 'cellular',
    value: boolean,
  ) => {
    setPreferences({...prefs, [key]: value});
    run(configureCatalogTransfer);
  };
  const reorder = (rule: string, offset: number) => {
    const order = [...prefs.order[field]];
    const from = order.indexOf(rule),
      to = from + offset;
    if (to < 0 || to >= order.length) {
      return;
    }
    [order[from], order[to]] = [order[to], order[from]];
    setPreferences({...prefs, order: {...prefs.order, [field]: order}});
  };
  const changeSection = (section: CatalogSection) =>
    setPreferences({
      ...prefs,
      sections: prefs.sections.map(s => (s.id === section.id ? section : s)),
    });
  const languageLabel = (rule: string) => {
    const [source, lang] = rule.split(':');
    return `${source === 'tmdb' ? 'TMDB' : source === 'tvdb' ? 'TVDB' : source === 'streamingunity' ? 'StreamingUnity' : source} · ${t(`catalog.language.${lang}`, {defaultValue: lang})}`;
  };
  const input = {
    color: 'white',
    borderColor: '#555',
    borderWidth: 1,
    padding: 12,
    minHeight: 48,
    marginVertical: 6,
  };
  return (
    <SafeAreaView style={catalogStyles.page}>
      <ScrollView contentContainerStyle={{padding: 16, paddingBottom: 100}}>
        <Text style={catalogStyles.title}>
          {t('catalog.title')} · {t('catalog.cinema')}
        </Text>
        <Text style={catalogStyles.text}>
          {t(
            transfer.status === 'paused' &&
              transfer.error === 'catalog.preparationPaused'
              ? 'catalog.preparationPausedTitle'
              : `catalog.status.${transfer.status}`,
          )}
        </Text>
        {transfer.status === 'installing' && transfer.phase && (
          <Text accessibilityLiveRegion="polite" style={catalogStyles.text}>
            {t(`catalog.phase.${transfer.phase}`)}
            {transfer.startedAt
              ? ` · ${t('catalog.elapsed', {seconds: Math.max(0, Math.floor((now - transfer.startedAt) / 1000))})}`
              : ''}
          </Text>
        )}
        {!!transfer.total && (
          <Text style={catalogStyles.text}>
            {transfer.phase === 'index'
              ? `${Math.floor((100 * transfer.bytes) / transfer.total)}%`
              : transfer.phase === 'verifyRevision'
                ? t('catalog.recordsVerified', {
                    count: transfer.bytes,
                    total: transfer.total,
                  })
                : `${size(transfer.bytes)} / ${size(transfer.total)}`}
          </Text>
        )}
        {!!transfer.error && (
          <Text accessibilityLiveRegion="polite" style={catalogStyles.text}>
            {t(transfer.error)}
          </Text>
        )}
        {installed && (
          <Text style={catalogStyles.text}>
            {t('catalog.installedSize', {size: size(installed.bytes)})}
          </Text>
        )}
        {!!publication.data && (
          <Text style={catalogStyles.text}>
            {t('catalog.downloadSize', {
              download: size(publication.data.snapshot.bytes),
              installed: size(publication.data.snapshot.uncompressedBytes),
            })}
          </Text>
        )}
        <Text style={catalogStyles.text}>
          {t('catalog.storageExplanation')}
        </Text>
        <View style={catalogStyles.row}>
          {transfer.status === 'installing' ? (
            <CatalogButton
              label={t('catalog.stopPreparation')}
              disabled={
                transfer.phase === 'stopping' || transfer.phase === 'activate'
              }
              onPress={() => {
                pauseCatalogPreparation().catch(() =>
                  Alert.alert(t('catalog.title'), t('catalog.transferFailed')),
                );
              }}
            />
          ) : (
            <>
              {!pending &&
                !['downloading', 'queued', 'paused'].includes(
                  transfer.status,
                ) && (
                  <CatalogButton
                    label={t(installed ? 'catalog.check' : 'catalog.install')}
                    disabled={busy}
                    onPress={() => {
                      run(startCatalogDownload);
                    }}
                  />
                )}
              {['downloading', 'queued'].includes(transfer.status) && (
                <CatalogButton
                  label={t('catalog.pause')}
                  disabled={busy}
                  onPress={() => {
                    run(() => catalogNative().pause());
                  }}
                />
              )}
              {transfer.status === 'paused' && !pending && (
                <CatalogButton
                  label={t('catalog.resume')}
                  disabled={busy}
                  onPress={() => {
                    run(startCatalogDownload);
                  }}
                />
              )}
              {(pending ||
                ['paused', 'downloading', 'queued', 'error'].includes(
                  transfer.status,
                )) && (
                <CatalogButton
                  label={t('catalog.cancel')}
                  disabled={busy}
                  onPress={() => {
                    run(discardCatalogDownload);
                  }}
                />
              )}
              {pending && (
                <CatalogButton
                  label={t('catalog.activate')}
                  disabled={busy}
                  onPress={() => {
                    run(resumeCatalogPreparation);
                  }}
                />
              )}
            </>
          )}
          {!!installed && (
            <CatalogButton
              label={t('catalog.remove')}
              disabled={busy}
              onPress={() =>
                Alert.alert(t('catalog.remove'), t('catalog.removeConfirm'), [
                  {text: t('Cancel'), style: 'cancel'},
                  {
                    text: t('catalog.remove'),
                    style: 'destructive',
                    onPress: () => {
                      run(removeCatalog);
                    },
                  },
                ])
              }
            />
          )}
        </View>
        {(['selected', 'automatic', 'cellular'] as const).map(key => (
          <View
            key={key}
            style={[catalogStyles.row, {justifyContent: 'space-between'}]}>
            <Text style={[catalogStyles.text, {flex: 1}]}>
              {t(`catalog.${key}`)}
            </Text>
            <Switch
              accessibilityLabel={t(`catalog.${key}`)}
              trackColor={{true: primary}}
              disabled={busy || (key === 'selected' && !installed)}
              value={prefs[key]}
              onValueChange={v => toggle(key, v)}
            />
          </View>
        ))}
        <Text style={catalogStyles.text}>
          {t('catalog.backgroundExplanation')}
        </Text>
        <Text style={catalogStyles.title}>{t('catalog.images')}</Text>
        <View style={catalogStyles.row}>
          {imageFields.map(f => (
            <CatalogButton
              key={f}
              label={t(`catalog.field.${f}`) + (field === f ? ' ✓' : '')}
              onPress={() => setField(f)}
            />
          ))}
        </View>
        <Text style={catalogStyles.text}>{t('catalog.imageExplanation')}</Text>
        {prefs.order[field].map((rule, index) => (
          <View key={rule} style={catalogStyles.row}>
            <Text style={[catalogStyles.text, {flex: 1}]}>
              {index + 1}. {languageLabel(rule)}
            </Text>
            <CatalogButton
              icon="arrow-up"
              label={t('catalog.up')}
              onPress={() => reorder(rule, -1)}
              disabled={!index}
            />
            <CatalogButton
              icon="arrow-down"
              label={t('catalog.down')}
              onPress={() => reorder(rule, 1)}
              disabled={index === prefs.order[field].length - 1}
            />
            <CatalogButton
              icon="close"
              label={t('catalog.disable')}
              onPress={() =>
                setPreferences({
                  ...prefs,
                  order: {
                    ...prefs.order,
                    [field]: prefs.order[field].filter(r => r !== rule),
                  },
                })
              }
            />
          </View>
        ))}
        {(rules.data?.[field] || [])
          .filter(rule => !prefs.order[field].includes(rule))
          .map(rule => (
            <CatalogButton
              key={rule}
              label={t('catalog.addRule', {rule: languageLabel(rule)})}
              onPress={() =>
                setPreferences({
                  ...prefs,
                  order: {
                    ...prefs.order,
                    [field]: [...prefs.order[field], rule],
                  },
                })
              }
            />
          ))}
        <Text style={catalogStyles.title}>{t('catalog.quality')}</Text>
        <View style={catalogStyles.row}>
          {tmdbSizes[field].map(q => (
            <CatalogButton
              key={q}
              label={
                (q === 'original' ? t('catalog.originalQuality') : q) +
                (prefs.quality[field] === q ? ' ✓' : '')
              }
              onPress={() =>
                setPreferences({
                  ...prefs,
                  quality: {...prefs.quality, [field]: q},
                })
              }
            />
          ))}
        </View>
        <CatalogButton
          label={t('catalog.resetImages')}
          onPress={() => {
            const defaults = defaultCatalogPreferences();
            setPreferences({
              ...prefs,
              order: defaults.order,
              quality: defaults.quality,
            });
          }}
        />
        <Text style={catalogStyles.title}>{t('catalog.home')}</Text>
        {prefs.sections.map((s, index) => (
          <View key={s.id}>
            <View style={catalogStyles.row}>
              <Text style={[catalogStyles.text, {flex: 1}]}>
                {s.title || t(`catalog.section.${s.id}`)}
              </Text>
              <Switch
                accessibilityLabel={s.title || t(`catalog.section.${s.id}`)}
                value={s.enabled}
                onValueChange={enabled => changeSection({...s, enabled})}
              />
            </View>
            <View style={catalogStyles.row}>
              <CatalogButton
                label={t('catalog.edit')}
                onPress={() => setEdit({...s})}
              />
              <CatalogButton
                label={t('catalog.up')}
                disabled={!index}
                onPress={() => {
                  const sections = [...prefs.sections];
                  [sections[index - 1], sections[index]] = [
                    sections[index],
                    sections[index - 1],
                  ];
                  setPreferences({...prefs, sections});
                }}
              />
              <CatalogButton
                label={
                  t('catalog.hero') + (prefs.heroSection === s.id ? ' ✓' : '')
                }
                onPress={() => setPreferences({...prefs, heroSection: s.id})}
              />
              <CatalogButton
                label={t('catalog.deleteSection')}
                onPress={() =>
                  setPreferences({
                    ...prefs,
                    sections: prefs.sections.filter(row => row.id !== s.id),
                  })
                }
              />
            </View>
          </View>
        ))}
        <CatalogButton
          label={t('catalog.addSection')}
          disabled={prefs.sections.length >= 30}
          onPress={() =>
            setEdit({
              id: `custom-${Date.now()}`,
              title: '',
              enabled: true,
              type: '',
              genres: [],
              sort: 'title',
            })
          }
        />
        {edit && (
          <View>
            <TextInput
              accessibilityLabel={t('catalog.sectionTitle')}
              placeholder={t('catalog.sectionTitle')}
              placeholderTextColor="#999"
              style={input}
              value={edit.title}
              onChangeText={title => setEdit({...edit, title})}
            />
            <View style={catalogStyles.row}>
              {(['', 'movie', 'tv'] as const).map(type => (
                <CatalogButton
                  key={type}
                  label={
                    t(`catalog.type.${type || 'all'}`) +
                    (edit.type === type ? ' ✓' : '')
                  }
                  onPress={() => setEdit({...edit, type})}
                />
              ))}
            </View>
            <TextInput
              key={edit.id}
              accessibilityLabel={t('catalog.genres')}
              placeholder={t('catalog.genres')}
              placeholderTextColor="#999"
              style={input}
              defaultValue={edit.genres.join(', ')}
              onChangeText={v =>
                setEdit({
                  ...edit,
                  genres: v
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean),
                })
              }
            />
            {(['fromYear', 'toYear'] as const).map(key => (
              <TextInput
                key={key}
                accessibilityLabel={t(`catalog.${key}`)}
                placeholder={t(`catalog.${key}`)}
                placeholderTextColor="#999"
                style={input}
                keyboardType="number-pad"
                value={edit[key] === undefined ? '' : String(edit[key])}
                onChangeText={v =>
                  setEdit({
                    ...edit,
                    [key]: /^\d{1,4}$/.test(v) ? Number(v) : undefined,
                  })
                }
              />
            ))}
            <View style={catalogStyles.row}>
              {(['title', 'year', 'added', 'views'] as const).map(sort => (
                <CatalogButton
                  key={sort}
                  label={
                    t(`catalog.sort.${sort}`) + (edit.sort === sort ? ' ✓' : '')
                  }
                  onPress={() => setEdit({...edit, sort})}
                />
              ))}
            </View>
            <CatalogButton
              label={t('catalog.saveSection')}
              disabled={
                !edit.title.trim() ||
                !!(edit.fromYear && edit.toYear && edit.fromYear > edit.toYear)
              }
              onPress={() => {
                setPreferences({
                  ...prefs,
                  sections: prefs.sections.some(s => s.id === edit.id)
                    ? prefs.sections.map(s => (s.id === edit.id ? edit : s))
                    : [...prefs.sections, edit],
                });
                setEdit(undefined);
              }}
            />
            <CatalogButton
              label={t('Cancel')}
              onPress={() => setEdit(undefined)}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
