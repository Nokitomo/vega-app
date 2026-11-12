import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type StyleProp,
  type ImageStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {useNavigation, useIsFocused} from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import type {HomeStackParamList, RootStackParamList} from '../../App';
import {useCatalogStore} from '../../lib/catalog/store';
import {
  catalogChildren,
  catalogList,
  catalogWork,
} from '../../lib/catalog/reader';
import {
  playbackEpisodes,
  sourceLink,
  workImages,
  workTitle,
  syncCatalogSeries,
  type CatalogSource,
  type CatalogEpisode,
} from '../../lib/catalog/content';
import type {
  CatalogRecord,
  CatalogSection,
  Work,
} from '../../lib/catalog/types';
import {defaultCatalogPreferences} from '../../lib/catalog/preferences';
import useContentStore from '../../lib/zustand/contentStore';
import useThemeStore from '../../lib/zustand/themeStore';
import useWatchListStore from '../../lib/zustand/watchListStore';
import useWatchHistoryStore from '../../lib/zustand/watchHistrory';
import ContinueWatching from '../ContinueWatching';
import InfoSeasonPicker from '../InfoSeasonPicker';
import RemoteLogo from '../RemoteLogo';
import {HOME_FONT} from '../homePresentation';
import type {EpisodeLink} from '../../lib/providers/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  registerCatalogIdentity,
  sourceIdentity,
} from '../../lib/catalog/identity';
import {
  sameWatchContent,
  sameWatchEpisode,
} from '../../lib/storage/SharedAnimeWatchIdentity';
import type {ContinueWatchingTarget} from '../../lib/utils/continueWatching';

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
export function CatalogImage({
  urls,
  style,
  logo = false,
}: {
  urls: string[];
  style?: StyleProp<ImageStyle>;
  logo?: boolean;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const uri = urls.find(u => !failed.includes(u));
  if (!uri) {
    return <View style={[{backgroundColor: '#23252b'}, style]} />;
  }
  const fail = () => setFailed(v => [...v, uri]);
  return logo ? (
    <RemoteLogo uri={uri} width={260} height={90} onError={fail} />
  ) : (
    <Image source={{uri}} style={style} resizeMode="cover" onError={fail} />
  );
}
function CatalogFailure({retry}: {retry: () => void}) {
  const {t} = useTranslation();
  return (
    <View>
      <Text style={catalogStyles.text}>{t('catalog.readFailed')}</Text>
      <CatalogButton label={t('Retry')} onPress={retry} />
    </View>
  );
}
function useWorkArt(work: CatalogRecord<Work>) {
  const generation = useCatalogStore(s => s.generation);
  return useQuery({
    queryKey: ['catalog', generation, work.id, 'images'],
    queryFn: async () => {
      const [poster, background, logo] = await Promise.all([
        workImages(work, 'poster'),
        workImages(work, 'background'),
        workImages(work, 'logo'),
      ]);
      return {poster, background, logo};
    },
  });
}
function CatalogCard({
  work,
  width = 136,
}: {
  work: CatalogRecord<Work>;
  width?: number;
}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const art = useWorkArt(work);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={workTitle(work.payload)}
      style={{width, marginRight: 12, marginBottom: 16}}
      onPress={() =>
        navigation.navigate('Info', {
          link: work.id,
          catalogRef: {catalogId: 'cinema', workId: work.id},
        })
      }>
      <CatalogImage
        urls={art.data?.poster || []}
        style={{width, height: width * 1.5}}
      />
      <Text numberOfLines={3} style={[catalogStyles.text, {marginTop: 8}]}>
        {workTitle(work.payload)}
      </Text>
    </TouchableOpacity>
  );
}
export function CatalogRow({
  section,
  search,
}: {
  section: CatalogSection;
  search?: string;
}) {
  const {t} = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const generation = useCatalogStore(s => s.generation);
  const installed = useCatalogStore(s => s.installed);
  const query = useInfiniteQuery({
    queryKey: ['catalog', generation, 'list', section, search],
    enabled: !!installed,
    initialPageParam: 0,
    queryFn: ({pageParam}) => catalogList(section, pageParam, search),
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  return (
    <View style={{paddingVertical: 12}}>
      <View style={[catalogStyles.row, {justifyContent: 'space-between'}]}>
        <Text style={catalogStyles.title}>
          {search !== undefined
            ? t('catalog.localResults')
            : section.title || t(`catalog.section.${section.id}`)}
        </Text>
        <CatalogButton
          label={t('catalog.browse')}
          onPress={() =>
            navigation.navigate('ScrollList', {
              filter: '',
              isSearch: false,
              catalogSection: section,
              catalogSearch: search,
            })
          }
        />
      </View>
      {query.isPending ? (
        <ActivityIndicator />
      ) : query.isError ? (
        <CatalogFailure
          retry={() => {
            query.refetch();
          }}
        />
      ) : (
        <FlatList
          horizontal
          data={query.data?.pages.flat()}
          keyExtractor={w => w.id}
          renderItem={({item}) => <CatalogCard work={item} />}
          ListEmptyComponent={
            <Text style={catalogStyles.text}>{t('No Content Found')}</Text>
          }
          ListFooterComponent={
            query.hasNextPage ? (
              <CatalogButton
                label={t('catalog.more')}
                disabled={query.isFetchingNextPage}
                onPress={() => {
                  query.fetchNextPage();
                }}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}
export function CatalogBrowse({
  section,
  search,
}: {
  section: CatalogSection;
  search?: string;
}) {
  const {t} = useTranslation();
  const generation = useCatalogStore(s => s.generation);
  const [filter, setFilter] = useState(section);
  const {width} = useWindowDimensions();
  const columns = Math.max(2, Math.floor((width - 32) / 140));
  const cardWidth = (width - 32) / columns - 12;
  const query = useInfiniteQuery({
    queryKey: ['catalog', generation, 'browse', filter, search],
    initialPageParam: 0,
    queryFn: ({pageParam}) => catalogList(filter, pageParam, search),
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  return (
    <SafeAreaView style={catalogStyles.page}>
      <FlatList
        key={columns}
        numColumns={columns}
        contentContainerStyle={{padding: 16, paddingBottom: 100}}
        data={query.data?.pages.flat() || []}
        keyExtractor={w => w.id}
        renderItem={({item}) => <CatalogCard work={item} width={cardWidth} />}
        ListHeaderComponent={
          <View>
            <Text style={catalogStyles.title}>
              {section.title ||
                (search !== undefined
                  ? t('catalog.localResults')
                  : t(`catalog.section.${section.id}`))}
            </Text>
            <View style={catalogStyles.row}>
              {(['', 'movie', 'tv'] as const).map(type => (
                <CatalogButton
                  key={type}
                  label={
                    t(`catalog.type.${type || 'all'}`) +
                    (filter.type === type ? ' ✓' : '')
                  }
                  onPress={() => setFilter({...filter, type})}
                />
              ))}
            </View>
            <View style={catalogStyles.row}>
              {(['title', 'year', 'added', 'views'] as const).map(sort => (
                <CatalogButton
                  key={sort}
                  label={
                    t(`catalog.sort.${sort}`) +
                    (filter.sort === sort ? ' ✓' : '')
                  }
                  onPress={() => setFilter({...filter, sort})}
                />
              ))}
            </View>
            {query.isError && (
              <CatalogFailure
                retry={() => {
                  query.refetch();
                }}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          query.isPending ? (
            <ActivityIndicator />
          ) : (
            <Text style={catalogStyles.text}>{t('No Content Found')}</Text>
          )
        }
        ListFooterComponent={
          query.hasNextPage ? (
            <CatalogButton
              label={t('catalog.more')}
              disabled={query.isFetchingNextPage}
              onPress={() => {
                query.fetchNextPage();
              }}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
function CatalogHeroCard({work}: {work: CatalogRecord<Work>}) {
  const art = useWorkArt(work);
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const {t} = useTranslation();
  return (
    <View>
      <CatalogImage
        urls={art.data?.background || []}
        style={{width: '100%', height: 250}}
      />
      {!!art.data?.logo.length && <CatalogImage urls={art.data.logo} logo />}
      <Text style={catalogStyles.title}>{workTitle(work.payload)}</Text>
      <Text numberOfLines={3} style={catalogStyles.text}>
        {String(work.payload.info.synopsis || '')}
      </Text>
      <CatalogButton
        label={t('catalog.details')}
        onPress={() =>
          navigation.navigate('Info', {
            link: work.id,
            catalogRef: {catalogId: 'cinema', workId: work.id},
          })
        }
      />
    </View>
  );
}
export function CatalogHome() {
  const {t} = useTranslation();
  const {preferences, generation, installed, setPreferences} =
    useCatalogStore();
  const focused = useIsFocused();
  const [heroIndex, setHeroIndex] = useState(0);
  const section =
    preferences.sections.find(s => s.id === preferences.heroSection) ||
    defaultCatalogPreferences().sections[2];
  const hero = useQuery({
    queryKey: ['catalog', generation, 'hero', section],
    enabled: !!installed,
    queryFn: () => catalogList(section),
  });
  const heroes = hero.data?.slice(0, 6) || [];
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const items = useWatchHistoryStore
        .getState()
        .history.filter(item => item.catalogRef && item.isSeries)
        .slice(0, 12);
      for (const item of items) {
        if (cancelled) {
          break;
        }
        try {
          const work = await catalogWork(item.catalogRef!.workId);
          const sources = await catalogChildren<CatalogSource>(
            'source',
            work.id,
          );
          const source = sources.find(
            s =>
              s.payload.provider === item.provider &&
              sourceIdentity(sourceLink(s.payload)) ===
                sourceIdentity(item.link) &&
              !!sourceIdentity(item.link),
          );
          if (source) {
            await syncCatalogSeries(work, source);
          }
        } catch {
          /* Preserve the last known progress if the catalog is unavailable. */
        }
      }
      if (!cancelled) {
        useWatchHistoryStore.getState().refreshHistory();
      }
    };
    refresh();
    return () => {
      cancelled = true;
    };
  }, [installed?.revision]);
  useEffect(() => {
    if (!focused || heroes.length < 2) {
      return;
    }
    const timer = setInterval(
      () => setHeroIndex(i => (i + 1) % heroes.length),
      10500,
    );
    return () => clearInterval(timer);
  }, [focused, heroes.length]);
  return (
    <SafeAreaView style={catalogStyles.page}>
      <ScrollView contentContainerStyle={{padding: 16, paddingBottom: 100}}>
        <View style={catalogStyles.row}>
          <Text style={catalogStyles.title}>{t('catalog.cinema')}</Text>
          <CatalogButton
            label={t('catalog.online')}
            onPress={() => setPreferences({...preferences, selected: false})}
          />
        </View>
        {heroes.length > 0 && (
          <CatalogHeroCard work={heroes[heroIndex % heroes.length]} />
        )}
        <ContinueWatching />
        {preferences.sections
          .filter(s => s.enabled)
          .map(s => (
            <CatalogRow key={s.id} section={s} />
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}
export function CatalogSearchResults({search}: {search: string}) {
  const {installed, preferences} = useCatalogStore();
  if (!installed || !preferences.selected) {
    return null;
  }
  return (
    <CatalogRow
      section={{
        id: 'search',
        title: '',
        enabled: true,
        type: '',
        genres: [],
        sort: 'title',
      }}
      search={search}
    />
  );
}
export function CatalogInfo({
  route,
}: NativeStackScreenProps<HomeStackParamList, 'Info'>) {
  const {t} = useTranslation();
  const generation = useCatalogStore(s => s.generation);
  const query = useQuery({
    queryKey: ['catalog', generation, 'work', route.params.catalogRef?.workId],
    queryFn: () => catalogWork(route.params.catalogRef!.workId),
  });
  return (
    <SafeAreaView style={catalogStyles.page}>
      {query.isPending ? (
        <ActivityIndicator />
      ) : query.isError || !query.data ? (
        <View style={{padding: 16}}>
          <Text style={catalogStyles.text}>{t('catalog.unavailable')}</Text>
          <CatalogFailure
            retry={() => {
              query.refetch();
            }}
          />
        </View>
      ) : (
        <CatalogDetails
          work={query.data}
          target={route.params.continueWatchingTarget}
          sourceHint={route.params.link}
        />
      )}
    </SafeAreaView>
  );
}
function CatalogDetails({
  work,
  target,
  sourceHint,
}: {
  work: CatalogRecord<Work>;
  target?: ContinueWatchingTarget;
  sourceHint: string;
}) {
  const {t} = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const generation = useCatalogStore(s => s.generation);
  const installedProviders = useContentStore(s => s.installedProviders);
  const {watchList, addItem, removeItem} = useWatchListStore();
  const historyAdd = useWatchHistoryStore(s => s.addItem);
  const art = useWorkArt(work);
  const [seasonId, setSeasonId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [playing, setPlaying] = useState(false);
  const data = useQuery({
    queryKey: ['catalog', generation, work.id, 'details'],
    queryFn: async () => {
      const [seasons, sources] = await Promise.all([
        catalogChildren<{number: number}>('season', work.id),
        catalogChildren<CatalogSource>('source', work.id),
      ]);
      const compatible = sources.filter(
        s =>
          s.payload.provider === 'streamingunity' &&
          s.payload.availability === 'present',
      );
      registerCatalogIdentity(
        {catalogId: 'cinema', workId: work.id},
        compatible.map(s => sourceLink(s.payload)),
        compatible.map(s => `streamingunity:${s.payload.id}`),
      );
      return {seasons, sources};
    },
  });
  const sources =
    data.data?.sources.filter(
      s =>
        s.payload.availability === 'present' &&
        s.payload.provider === 'streamingunity' &&
        installedProviders.some(p => p.value === s.payload.provider),
    ) || [];
  const source =
    sources.find(s => s.id === sourceId) ||
    (target && sourceIdentity(sourceHint)
      ? sources.find(
          s =>
            sourceIdentity(sourceLink(s.payload)) ===
            sourceIdentity(sourceHint),
        )
      : undefined) ||
    (sources.length === 1 ? sources[0] : undefined);
  const seasons = data.data?.seasons || [];
  const season =
    seasons.find(s => s.id === seasonId) ||
    seasons.find(
      s =>
        target?.seasonNumber !== undefined &&
        s.payload.number === target.seasonNumber,
    ) ||
    seasons[0];
  useEffect(() => {
    if (source && work.payload.info.type !== 'movie') {
      syncCatalogSeries(work, source).catch(() => {});
    }
  }, [work, source, generation]);
  const episodes = useQuery({
    queryKey: [
      'catalog',
      generation,
      work.id,
      source?.id,
      season?.id,
      'playback',
    ],
    enabled: !!source && !!season,
    queryFn: () => playbackEpisodes(work, source!, season!, false),
  });
  const canonical = useQuery({
    queryKey: ['catalog', generation, work.id, season?.id, 'canonicalEpisodes'],
    enabled: !!season,
    queryFn: () =>
      catalogChildren<CatalogEpisode>('episode', work.id, season!.id),
  });
  const ref = {catalogId: 'cinema' as const, workId: work.id};
  const resumeEpisode = target
    ? episodes.data?.find(ep => sameWatchEpisode(work.id, ep.link, target.link))
    : undefined;
  const saved = watchList.find(
    w =>
      w.catalogRef?.workId === work.id ||
      (source && sameWatchContent(w.link, sourceLink(source.payload))),
  );
  const play = async (episode?: EpisodeLink) => {
    if (!source || playing) {
      return;
    }
    setPlaying(true);
    try {
      const groups = seasons.map(s => ({
        title: t('catalog.season', {number: s.payload.number}),
        seasonNumber: s.payload.number,
        catalogSeasonRef: {
          workId: work.id,
          sourceId: source.id,
          seasonId: s.id,
        },
        directLinks: s.id === season?.id ? episodes.data : undefined,
      }));
      const list = episode
        ? episodes.data || []
        : [{title: workTitle(work.payload), link: sourceLink(source.payload)}];
      const index = episode ? list.findIndex(e => e.link === episode.link) : 0;
      if (index < 0) {
        throw new Error();
      }
      const infoUrl = sourceLink(source.payload);
      historyAdd({
        id: infoUrl,
        link: infoUrl,
        title: workTitle(work.payload),
        provider: source.payload.provider,
        catalogRef: ref,
        poster: art.data?.poster[0],
        isSeries: !!episode,
        seasonNumber: season?.payload.number,
        episodeNumber: episode?.episodeNumber,
        lastPlayed: Date.now(),
      });
      navigation.navigate('Player', {
        linkIndex: index,
        episodeList: list,
        type: episode ? 'series' : 'movie',
        primaryTitle: workTitle(work.payload),
        providerValue: source.payload.provider,
        infoUrl,
        catalogRef: ref,
        episodeNumber: episode?.episodeNumber,
        seasonNumber: season?.payload.number,
        seasons: groups,
        seasonIndex: seasons.findIndex(s => s.id === season?.id),
        poster: {
          poster: art.data?.poster[0],
          background: art.data?.background[0],
          logo: art.data?.logo[0],
        },
      });
    } catch {
      Alert.alert(t('catalog.title'), t('catalog.playbackFailed'));
    } finally {
      setPlaying(false);
    }
  };
  return (
    <FlatList
      contentContainerStyle={{padding: 16, paddingBottom: 100}}
      data={work.payload.info.type === 'movie' ? [] : canonical.data || []}
      keyExtractor={ep => ep.id}
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      renderItem={({item}) => (
        <CatalogEpisodeCard
          work={work}
          episode={item.payload}
          season={season!.payload.number}
          playable={episodes.data?.find(
            ep => ep.episodeNumber === item.payload.number,
          )}
          playing={playing}
          onPlay={play}
        />
      )}
      ListHeaderComponent={
        <View>
          <CatalogImage
            urls={art.data?.background || []}
            style={{width: '100%', height: 240}}
          />
          {!!art.data?.logo.length && (
            <CatalogImage urls={art.data.logo} logo />
          )}
          <Text style={catalogStyles.title}>{workTitle(work.payload)}</Text>
          <Text style={catalogStyles.text}>
            {String(work.payload.info.synopsis || '')}
          </Text>
          <CatalogButton
            label={t(saved ? 'catalog.removeSaved' : 'catalog.save')}
            onPress={() =>
              saved
                ? removeItem(saved.link)
                : addItem({
                    title: workTitle(work.payload),
                    poster: art.data?.poster[0] || '',
                    link: source ? sourceLink(source.payload) : work.id,
                    provider: source?.payload.provider || '',
                    catalogRef: ref,
                  })
            }
          />
          {data.isError && (
            <CatalogFailure
              retry={() => {
                data.refetch();
              }}
            />
          )}
          {sources.length > 1 && (
            <>
              <Text style={catalogStyles.title}>
                {t('catalog.chooseSource')}
              </Text>
              {sources.map(s => (
                <CatalogButton
                  key={s.id}
                  label={`${s.payload.provider} · ${String(s.payload.info.name || s.payload.id)}${sourceId === s.id ? ' ✓' : ''}`}
                  onPress={() => setSourceId(s.id)}
                />
              ))}
            </>
          )}
          {!sources.length && !data.isPending && (
            <Text style={catalogStyles.text}>{t('catalog.noSource')}</Text>
          )}
          {work.payload.info.type === 'movie' ? (
            <CatalogButton
              label={t('catalog.play')}
              disabled={!source || playing}
              onPress={() => {
                play();
              }}
            />
          ) : (
            <>
              {!!resumeEpisode && (
                <CatalogButton
                  label={t('catalog.resumeEpisode', {
                    title: resumeEpisode.title,
                  })}
                  disabled={playing}
                  onPress={() => {
                    play(resumeEpisode);
                  }}
                />
              )}
              <InfoSeasonPicker
                items={seasons.map(s => ({
                  seasonValue: s.id,
                  displayTitle: t('catalog.season', {number: s.payload.number}),
                }))}
                selected={
                  season
                    ? {
                        seasonValue: season.id,
                        displayTitle: t('catalog.season', {
                          number: season.payload.number,
                        }),
                      }
                    : undefined
                }
                onSelect={s => setSeasonId(s.seasonValue)}
              />
              {episodes.isError && (
                <CatalogFailure
                  retry={() => {
                    episodes.refetch();
                  }}
                />
              )}
              {canonical.isError && (
                <CatalogFailure
                  retry={() => {
                    canonical.refetch();
                  }}
                />
              )}
              {source && episodes.isPending && <ActivityIndicator />}
            </>
          )}
        </View>
      }
    />
  );
}

function CatalogEpisodeCard({
  work,
  episode,
  season,
  playable,
  playing,
  onPlay,
}: {
  work: CatalogRecord<Work>;
  episode: CatalogEpisode;
  season: number;
  playable?: EpisodeLink;
  playing: boolean;
  onPlay: (episode: EpisodeLink) => Promise<void>;
}) {
  const {t} = useTranslation();
  const generation = useCatalogStore(s => s.generation);
  const override = episode.metadataSources?.verifiedOverride;
  const blocked =
    !!override &&
    Object.prototype.hasOwnProperty.call(override, 'thumbnail') &&
    override.thumbnail === null;
  const images = useQuery({
    queryKey: [
      'catalog',
      generation,
      work.id,
      season,
      episode.number,
      'thumbnail',
    ],
    queryFn: () =>
      workImages(work, 'episodeThumbnail', season, episode.number, blocked),
  });
  return (
    <View style={{marginBottom: 20}}>
      <CatalogImage
        urls={images.data || []}
        style={{width: '100%', height: 180}}
      />
      <Text style={catalogStyles.title}>
        {episode.number}. {episode.title}
      </Text>
      <Text style={catalogStyles.text}>{episode.synopsis}</Text>
      <CatalogButton
        label={t('catalog.play')}
        disabled={playing || !playable}
        onPress={() => {
          if (playable) {
            onPlay(playable);
          }
        }}
      />
    </View>
  );
}
