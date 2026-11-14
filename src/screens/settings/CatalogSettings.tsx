import React, {useEffect, useRef, useState} from 'react';
import {Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {useCatalogStore} from '../../lib/catalog/store';
import {trimCatalogDetailCache} from '../../lib/catalog/detailCache';
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
import {catalogGenres, catalogImageRules} from '../../lib/catalog/reader';
import {
  catalogSortDirection,
  defaultCatalogPreferences,
  MAX_CATALOG_SECTIONS,
  imageFields,
  isDetailCacheLimit,
  tmdbSizes,
} from '../../lib/catalog/preferences';
import type {CatalogSection, ImageField} from '../../lib/catalog/types';
import {
  CatalogButton,
  catalogStyles,
} from '../../components/catalog/CatalogViews';
import useThemeStore from '../../lib/zustand/themeStore';
import {CATALOG_MANIFEST_URL, parseManifest} from '../../lib/catalog/manifest';
import {HOME_FONT} from '../../components/homePresentation';

const size = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
export default function CatalogSettings() {
  const {t} = useTranslation();
  const navigation = useNavigation();
  const {
    preferences: prefs,
    installed,
    transfer,
    setPreferences,
    setTransfer,
  } = useCatalogStore();
  const primary = useThemeStore(s => s.primary);
  const [busy, setBusy] = useState(false);
  const [cacheLimit, setCacheLimit] = useState(String(prefs.detailCacheMb));
  useEffect(() => {
    setCacheLimit(String(prefs.detailCacheMb));
  }, [prefs.detailCacheMb]);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [field, setField] = useState<ImageField>('poster');
  const [edit, setEdit] = useState<CatalogSection>();
  const [editInitial, setEditInitial] = useState('');
  const [pane, setPane] = useState<'database' | 'images' | 'home'>('database');
  const paneScroll = useRef<ScrollView>(null);
  const cacheInput = useRef<TextInput>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (pane !== 'database') {
      return;
    }
    const show = Keyboard.addListener('keyboardDidShow', event => {
      if (cacheInput.current?.isFocused()) {
        setKeyboardHeight(event.endCoordinates.height);
      }
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [pane]);
  const [showAvailable, setShowAvailable] = useState(false);
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
  const genres = useQuery({
    queryKey: ['catalog-genres', installed?.revision, edit?.type],
    enabled: !!installed && !!edit,
    queryFn: () => catalogGenres(edit?.type),
    staleTime: Infinity,
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
      heroSection: !section.enabled && prefs.heroSection === section.id
        ? prefs.sections.find(s => s.id !== section.id && s.enabled)?.id || section.id
        : prefs.heroSection,
    });
  const openEditor = (section: CatalogSection) => {
    setEditInitial(JSON.stringify(section));
    setEdit({...section});
  };
  const closeEditor = () => {
    if (edit && JSON.stringify(edit) !== editInitial) {
      Alert.alert(t('catalog.discardChanges'), t('catalog.discardChangesConfirm'), [
        {text: t('Cancel'), style: 'cancel'},
        {text: t('catalog.discardChanges'), style: 'destructive', onPress: () => setEdit(undefined)},
      ]);
      return;
    }
    setEdit(undefined);
  };
  const removeSection = (section: CatalogSection) => {
    if (prefs.sections.length <= 1) {
      Alert.alert(t('catalog.home'), t('catalog.keepOneSection'));
      return;
    }
    Alert.alert(t('catalog.deleteSection'), t('catalog.deleteSectionConfirm', {title: section.title || t(`catalog.section.${section.id}`)}), [
      {text: t('Cancel'), style: 'cancel'},
      {text: t('catalog.deleteSection'), style: 'destructive', onPress: () => {
        const sections = useCatalogStore.getState().preferences.sections.filter(s => s.id !== section.id);
        const current = useCatalogStore.getState().preferences;
        setPreferences({...current, sections,
          heroSection: current.heroSection === section.id
            ? sections.find(s => s.enabled)?.id || sections[0].id : current.heroSection});
      }},
    ]);
  };
  const languageLabel = (rule: string) => {
    const [source, lang] = rule.split(':');
    return `${source === 'tmdb' ? 'TMDB' : source === 'tvdb' ? 'TVDB' : source === 'streamingunity' ? 'StreamingUnity' : source} · ${t(`catalog.language.${lang}`, {defaultValue: lang})}`;
  };
  const input = {
    color: 'white',
    borderColor: '#35363b',
    borderWidth: 1,
    padding: 12,
    minHeight: 48,
    marginVertical: 6,
    backgroundColor: '#23252b',
    fontFamily: HOME_FONT.regular,
  };
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={catalogStyles.page}>
      <View style={{paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#23252b'}}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Back')} onPress={() => navigation.goBack()}
            style={{minWidth: 48, minHeight: 48, justifyContent: 'center'}}>
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>
          <Text style={[catalogStyles.title, {marginVertical: 0, flex: 1}]}>{t('catalog.title')} · {t('catalog.cinema')}</Text>
        </View>
        <View style={{flexDirection: 'row', gap: 8}}>
          {(['database', 'images', 'home'] as const).map(value => (
            <TouchableOpacity key={value} accessibilityRole="tab" accessibilityState={{selected: pane === value}}
              onPress={() => {
                if (value !== pane) {
                  Keyboard.dismiss();
                  setKeyboardHeight(0);
                  setPane(value);
                }
              }}
              style={{flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2,
                borderColor: pane === value ? primary : 'transparent'}}>
              <Text style={{color: pane === value ? primary : '#aaa', fontFamily: HOME_FONT.medium, fontSize: 15}}>
                {t(`catalog.pane.${value}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <ScrollView
        key={pane}
        ref={paneScroll}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (keyboardHeight > 0) {
            paneScroll.current?.scrollToEnd({animated: true});
          }
        }}
        contentContainerStyle={{padding: 20, paddingBottom: 20 + keyboardHeight}}>
        {pane === 'database' && <>
        <View style={{backgroundColor: '#141519', padding: 16, marginBottom: 16}}>
        <Text style={[catalogStyles.text, {color: 'white', fontFamily: HOME_FONT.medium, fontSize: 18}]}>
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
            {transfer.phase === 'index' || transfer.phase === 'prepareRevision'
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
        {!!publication.data && !installed && (
          <Text style={[catalogStyles.text, {color: '#aaa', fontSize: 14}]}>
            {t('catalog.downloadSizeEstimate', {
              download: size(publication.data.snapshot.bytes),
              installed: size(publication.data.snapshot.uncompressedBytes),
            })}
          </Text>
        )}
        <Text style={catalogStyles.text}>
          {t('catalog.storageExplanation')}
        </Text>
        </View>
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
                  label={t(pending ? 'catalog.discardDownload' : 'catalog.cancel')}
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
              destructive
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
        <Text style={catalogStyles.title}>{t('catalog.options')}</Text>
        {(['selected', 'automatic', 'cellular'] as const).map(key => (
          <View
            key={key}
            style={[catalogStyles.row, {justifyContent: 'space-between', minHeight: 62, paddingHorizontal: 16, backgroundColor: '#141519', borderBottomWidth: 1, borderColor: '#23252b'}]}>
            <Text style={[catalogStyles.text, {flex: 1}]}>
              {t(`catalog.${key}`)}
            </Text>
            <Switch
              accessibilityLabel={t(`catalog.${key}`)}
              trackColor={{true: primary}}
              thumbColor="white"
              disabled={busy || (key === 'selected' && !installed)}
              value={prefs[key]}
              onValueChange={v => toggle(key, v)}
            />
          </View>
        ))}
        <Text style={catalogStyles.text}>
          {t('catalog.backgroundExplanation')}
        </Text>
        <Text style={catalogStyles.title}>{t('catalog.detailCache')}</Text>
        <Text style={catalogStyles.text}>{t('catalog.detailCacheExplanation')}</Text>
        <View style={catalogStyles.row}>
          <TextInput
            ref={cacheInput}
            accessibilityLabel={t('catalog.detailCache')}
            keyboardType="number-pad"
            value={cacheLimit}
            onChangeText={setCacheLimit}
            selectTextOnFocus
            style={[catalogStyles.text, {minWidth: 96, padding: 12, backgroundColor: '#141519'}]}
          />
          <Text style={catalogStyles.text}>{t('catalog.cacheMegabytes')}</Text>
          <CatalogButton
            label={t('catalog.saveCacheLimit')}
            disabled={!/^\d+$/.test(cacheLimit) ||
              !isDetailCacheLimit(Number(cacheLimit)) ||
              Number(cacheLimit) === prefs.detailCacheMb}
            onPress={() => {
              Keyboard.dismiss();
              setPreferences({...prefs, detailCacheMb: Number(cacheLimit)});
              run(trimCatalogDetailCache);
            }}
          />
        </View>
        </>}
        {pane === 'images' && <>
        <Text style={catalogStyles.title}>{t('catalog.images')}</Text>
        <View style={catalogStyles.row}>
          {imageFields.map(f => (
            <CatalogButton
              key={f}
              label={t(`catalog.field.${f}`)}
              selected={field === f}
              onPress={() => {setField(f); setShowAvailable(false);}}
            />
          ))}
        </View>
        <Text style={catalogStyles.text}>{t('catalog.imageExplanation')}</Text>
        {prefs.order[field].map((rule, index) => (
          <View key={rule} style={[catalogStyles.row, {backgroundColor: '#141519', paddingLeft: 12, paddingTop: 8, marginBottom: 4}]}>
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
        <CatalogButton
          label={t('catalog.availableRules', {count: (rules.data?.[field] || []).filter(rule => !prefs.order[field].includes(rule)).length})}
          onPress={() => setShowAvailable(value => !value)}
        />
        {showAvailable && (rules.data?.[field] || [])
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
                q === 'original' ? t('catalog.originalQuality') : q
              }
              selected={prefs.quality[field] === q}
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
        </>}
        {pane === 'home' && <>
        <Text style={catalogStyles.title}>{t('catalog.home')}</Text>
        <Text style={[catalogStyles.text, {color: '#aaa', fontSize: 14, marginBottom: 18}]}>{t('catalog.homeExplanation')}</Text>
        {prefs.sections.map((s, index) => (
          <View key={s.id} style={{backgroundColor: '#141519', padding: 14, marginBottom: 12, borderLeftWidth: 3,
            borderLeftColor: prefs.heroSection === s.id ? primary : '#23252b'}}>
            <View style={[catalogStyles.row, {justifyContent: 'space-between', marginBottom: 8}]}>
              <View style={{flex: 1}}>
                <Text style={[catalogStyles.text, {color: 'white', fontFamily: HOME_FONT.medium}]}>
                  {s.title || t(`catalog.section.${s.id}`)}
                </Text>
                <Text style={[catalogStyles.text, {color: '#999', fontSize: 13}]}>
                  {t(`catalog.type.${s.type || 'all'}`)} · {t(`catalog.sort.${s.sort}`)}
                </Text>
              </View>
              <Switch
                accessibilityLabel={s.title || t(`catalog.section.${s.id}`)}
                value={s.enabled}
                trackColor={{true: primary}}
                thumbColor="white"
                disabled={s.enabled && prefs.sections.filter(row => row.enabled).length <= 1}
                onValueChange={enabled => changeSection({...s, enabled})}
              />
            </View>
            <View style={catalogStyles.row}>
              <CatalogButton
                label={t('catalog.hero')}
                selected={prefs.heroSection === s.id}
                onPress={() => setPreferences({...prefs, heroSection: s.id,
                  sections: prefs.sections.map(row => row.id === s.id ? {...row, enabled: true} : row)})}
              />
            </View>
            <View style={catalogStyles.row}>
              <CatalogButton
                label={t('catalog.edit')}
                onPress={() => openEditor(s)}
              />
              <CatalogButton
                icon="arrow-up"
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
                icon="arrow-down"
                label={t('catalog.down')}
                disabled={index === prefs.sections.length - 1}
                onPress={() => {
                  const sections = [...prefs.sections];
                  [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
                  setPreferences({...prefs, sections});
                }}
              />
              <CatalogButton
                icon="close"
                label={t('catalog.deleteSection')}
                destructive
                disabled={prefs.sections.length <= 1}
                onPress={() => removeSection(s)}
              />
            </View>
          </View>
        ))}
        <CatalogButton
          label={t('catalog.addSection')}
          disabled={prefs.sections.length >= MAX_CATALOG_SECTIONS}
          onPress={() =>
            openEditor({
              id: `custom-${Date.now()}`,
              title: '',
              enabled: true,
              type: '',
              genres: [],
              sort: 'title',
            })
          }
        />
        </>}
      </ScrollView>
      <Modal visible={!!edit} animationType="slide" onRequestClose={closeEditor}>
        <SafeAreaView style={catalogStyles.page}>
          <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, minHeight: 62, borderBottomWidth: 1, borderColor: '#23252b'}}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Cancel')} onPress={closeEditor}
                style={{minWidth: 48, minHeight: 48, justifyContent: 'center'}}>
                <Ionicons name="close" color="white" size={26} />
              </TouchableOpacity>
              <Text style={[catalogStyles.title, {flex: 1, marginVertical: 0}]}>{t('catalog.editSection')}</Text>
            </View>
          <ScrollView
            key={edit?.id}
            style={{flex: 1}}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{padding: 20}}>
          {edit && <>
            <Text style={catalogStyles.text}>{t('catalog.sectionTitle')}</Text>
            <TextInput
              accessibilityLabel={t('catalog.sectionTitle')}
              placeholder={t('catalog.sectionTitle')}
              placeholderTextColor="#999"
              style={input}
              value={edit.title}
              onChangeText={title => setEdit({...edit, title})}
            />
            <Text style={[catalogStyles.text, {marginTop: 16}]}>{t('catalog.contentType')}</Text>
            <View style={catalogStyles.row}>
              {(['', 'movie', 'tv'] as const).map(type => (
                <CatalogButton
                  key={type}
                  label={t(`catalog.type.${type || 'all'}`)}
                  selected={edit.type === type}
                  onPress={() => setEdit({...edit, type})}
                />
              ))}
            </View>
            <Text style={[catalogStyles.text, {marginTop: 16}]}>{t('catalog.genres')}</Text>
            <View style={catalogStyles.row}>
              <CatalogButton
                label={t('catalog.allGenres')}
                selected={!edit.genres.length}
                onPress={() => setEdit({...edit, genres: []})}
              />
              {[...new Set([...(genres.data ?? []), ...edit.genres])].map(genre => (
                <CatalogButton
                  key={genre}
                  label={genre}
                  selected={edit.genres.includes(genre)}
                  onPress={() => setEdit({...edit, genres: edit.genres.includes(genre)
                    ? edit.genres.filter(value => value !== genre)
                    : [...edit.genres, genre]})}
                />
              ))}
            </View>
            {genres.isLoading && <Text style={catalogStyles.text}>{t('catalog.genreValidationPending')}</Text>}
            {genres.isError && <CatalogButton label={t('Retry')} onPress={() => {genres.refetch();}} />}
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
            <Text style={[catalogStyles.text, {marginTop: 16}]}>{t('catalog.sortLabel')}</Text>
            <View style={catalogStyles.row}>
              {(['title', 'year', 'added', 'views'] as const).map(sort => (
                <CatalogButton
                  key={sort}
                  label={t(`catalog.sort.${sort}`)}
                  selected={edit.sort === sort}
                  onPress={() => setEdit({...edit, sort})}
                />
              ))}
            </View>
            <Text style={[catalogStyles.text, {marginTop: 16}]}>{t('catalog.sortDirection')}</Text>
            <View style={catalogStyles.row}>
              {(['asc', 'desc'] as const).map(direction => (
                <CatalogButton
                  key={direction}
                  label={t(`catalog.direction.${direction}`)}
                  selected={catalogSortDirection(edit) === direction}
                  onPress={() => setEdit({...edit, direction})}
                />
              ))}
            </View>
          </>}
          </ScrollView>
          {edit && <View style={{paddingHorizontal: 20, paddingTop: 8, borderTopWidth: 1, borderColor: '#23252b'}}>
            <CatalogButton
              label={t('catalog.saveSection')}
              disabled={
                (!prefs.sections.some(s => s.id === edit.id) && !edit.title.trim()) ||
                !!(edit.fromYear && edit.toYear && edit.fromYear > edit.toYear)
              }
              onPress={() => {
                const normalized = {...edit, title: edit.title.trim()};
                setPreferences({
                  ...prefs,
                  sections: prefs.sections.some(s => s.id === edit.id)
                    ? prefs.sections.map(s => (s.id === edit.id ? normalized : s))
                    : [...prefs.sections, normalized],
                });
                setEdit(undefined);
              }}
            />
            <CatalogButton
              label={t('Cancel')}
              onPress={closeEditor}
            />
          </View>}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
