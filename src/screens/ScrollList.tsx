import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import React, {useEffect, useMemo, useState, useRef} from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList, SearchStackParamList} from '../App';
import {Post} from '../lib/providers/types';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import useContentStore from '../lib/zustand/contentStore';
import {MaterialIcons} from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import {settingsStorage} from '../lib/storage';
import {FlashList} from '@shopify/flash-list';
import SkeletonLoader from '../components/Skeleton';
import useThemeStore from '../lib/zustand/themeStore';
import {providerManager} from '../lib/services/ProviderManager';
import ProviderImage from '../components/ProviderImage';
import {useTranslation} from 'react-i18next';
import PostBadges from '../components/PostBadges';
import {
  HOME_FONT,
  CATALOG_CARD_TITLE_STYLE,
  getHomeCardWidth,
} from '../components/homePresentation';
import ArchiveFilterModal from '../components/ArchiveFilterModal';
import {CatalogBrowse} from '../components/catalog/CatalogViews';
import {
  buildArchiveFilter,
  hasActiveArchiveFilters,
  parseArchiveFilterSelection,
} from '../lib/utils/archiveFilters';
type Props = NativeStackScreenProps<HomeStackParamList, 'ScrollList'>;
const CALENDAR_DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'undetermined',
] as const;
const CALENDAR_DAY_MAP: Record<string, (typeof CALENDAR_DAY_KEYS)[number]> = {
  lunedì: 'monday',
  martedì: 'tuesday',
  mercoledì: 'wednesday',
  giovedì: 'thursday',
  venerdì: 'friday',
  sabato: 'saturday',
  domenica: 'sunday',
  monday: 'monday',
  tuesday: 'tuesday',
  wednesday: 'wednesday',
  thursday: 'thursday',
  friday: 'friday',
  saturday: 'saturday',
  sunday: 'sunday',
  undetermined: 'undetermined',
};
const CALENDAR_DAY_LABEL_KEYS: Record<
  (typeof CALENDAR_DAY_KEYS)[number],
  string
> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
  undetermined: 'Undetermined',
};
const GRID_TITLE_LINES = 3;
const ScrollList = ({route}: Props): React.ReactElement => {
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const [posts, setPosts] = useState<Post[]>([]);
  const {filter: routeFilter, providerValue} = route.params;
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchError, setSearchError] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isEnd, setIsEnd] = useState<boolean>(false);
  const {provider} = useContentStore(state => state);
  const effectiveProviderValue = providerValue || provider.value;
  const [activeFilter, setActiveFilter] = useState(routeFilter);
  const [filterSelection, setFilterSelection] = useState(() =>
    parseArchiveFilterSelection(routeFilter),
  );
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const archiveFilters = useMemo(
    () =>
      effectiveProviderValue
        ? providerManager.getArchiveFilters({
            providerValue: effectiveProviderValue,
          })
        : {},
    [effectiveProviderValue, provider.version],
  );
  const isArchiveView =
    !route.params.isSearch &&
    ['archive', 'catalog/all'].includes(
      activeFilter
        .split('?', 1)[0]
        .replace(/^\/+|\/+$/g, '')
        .toLowerCase(),
    );
  const canFilterArchive =
    isArchiveView && Object.keys(archiveFilters).length > 0;
  const hasActiveFilters = hasActiveArchiveFilters(filterSelection);
  const {width: windowWidth} = useWindowDimensions();
  const [gridContainerWidth, setGridContainerWidth] = useState<number>(0);
  const [viewType, setViewType] = useState<number>(
    settingsStorage.getListViewType(),
  );
  const isCalendarView = activeFilter === 'calendar' && !route.params.isSearch;
  // Add abort controller to cancel API requests when unmounting
  const abortController = useRef<AbortController | null>(null);
  const isMounted = useRef(true);
  const isLoadingMore = useRef(false);
  const calendarDayOrder = CALENDAR_DAY_KEYS;
  const calendarSections = useMemo(() => {
    if (!isCalendarView) {
      return [];
    }
    const grouped = new Map<string, Post[]>();
    posts.forEach(post => {
      const rawDay = post.day?.trim().toLowerCase();
      if (!rawDay) {
        return;
      }
      const dayKey = CALENDAR_DAY_MAP[rawDay];
      if (!dayKey) {
        return;
      }
      const items = grouped.get(dayKey) || [];
      items.push(post);
      grouped.set(dayKey, items);
    });
    return calendarDayOrder
      .filter(dayKey => grouped.get(dayKey)?.length)
      .map(dayKey => ({
        title: t(CALENDAR_DAY_LABEL_KEYS[dayKey]),
        data: grouped.get(dayKey) || [],
      }));
  }, [calendarDayOrder, isCalendarView, posts, t]);
  const gridFallbackHorizontalPadding = 32;
  const gridMaxItemWidth = getHomeCardWidth(
    gridContainerWidth > 0 ? gridContainerWidth + 32 : windowWidth,
  );
  const gridBaseWidth =
    gridContainerWidth > 0
      ? gridContainerWidth
      : Math.max(0, windowWidth - gridFallbackHorizontalPadding);
  const gridAvailableWidth = Math.max(0, gridBaseWidth);
  const gridColumns =
    gridBaseWidth + 32 >= 600
      ? Math.max(3, Math.floor(gridAvailableWidth / (gridMaxItemWidth + 16)))
      : 3;
  const gridColumnWidth =
    gridAvailableWidth > 0
      ? Math.floor(gridAvailableWidth / gridColumns)
      : gridMaxItemWidth;
  const gridItemWidth = Math.min(
    gridMaxItemWidth,
    Math.max(1, gridColumnWidth - 12),
  );
  const gridItemHeight = Math.round(gridItemWidth * 1.5);
  const gridTitleWidth = gridItemWidth;
  const gridItemWrapperStyle: ViewStyle = {
    width: gridColumnWidth > 0 ? gridColumnWidth : gridMaxItemWidth,
    alignItems: 'center',
    marginVertical: 12,
  };
  const chunkPosts = (items: Post[], size: number) => {
    const rows: Post[][] = [];
    for (let i = 0; i < items.length; i += size) {
      rows.push(items.slice(i, i + size));
    }
    return rows;
  };

  // Set up cleanup effect that runs on component unmount
  useEffect(() => {
    setActiveFilter(routeFilter);
    setFilterSelection(parseArchiveFilterSelection(routeFilter));
    setPosts([]);
    setPage(1);
    setIsEnd(false);
  }, [routeFilter]);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);
  useEffect(() => {
    // Clean up the previous controller if it exists
    if (abortController.current) {
      abortController.current.abort();
    }

    // Create a new controller for this effect
    abortController.current = new AbortController();
    const controller = abortController.current;
    const signal = controller.signal;
    const fetchPosts = async () => {
      // Don't fetch if we're already at the end
      if (isEnd) {
        return;
      }
      try {
        // Prevent concurrent loading calls
        isLoadingMore.current = true;
        setIsLoading(true);
        setSearchError(false);

        // Simulate network delay to reduce rapid API calls
        // Remove this in production if not needed
        await new Promise(resolve => setTimeout(resolve, 300));

        // Skip if component unmounted or request was aborted
        if (!isMounted.current || signal.aborted) {
          return;
        }
        const getNewPosts = route.params.isSearch
          ? providerManager.getSearchPosts({
              searchQuery: routeFilter,
              page,
              providerValue: effectiveProviderValue,
              signal,
            })
          : providerManager.getPosts({
              filter: activeFilter,
              page,
              providerValue: effectiveProviderValue,
              signal,
            });
        const newPosts = await getNewPosts;

        // Skip if component unmounted or request was aborted
        if (!isMounted.current || signal.aborted) {
          return;
        }
        if (!newPosts || newPosts.length === 0) {
          console.log('end', page);
          setIsEnd(true);
          setIsLoading(false);
          isLoadingMore.current = false;
          return;
        }
        setPosts(prev => {
          const combined = page === 1 ? newPosts : [...prev, ...newPosts];
          const unique = new Map<string, Post>();
          combined.forEach(item => {
            const key = `${item.provider || effectiveProviderValue}:${item.link}:${item.episodeId ?? ''}`;
            if (!unique.has(key)) {
              unique.set(key, item);
            }
          });
          return Array.from(unique.values());
        });
        if (filterSelection.random) {
          setIsEnd(true);
        }
      } catch (error) {
        // Skip handling if component unmounted or request was aborted
        if (
          !isMounted.current ||
          signal.aborted ||
          (error as any)?.name === 'AbortError'
        ) {
          return;
        }
        setSearchError(true);
        console.error('Error fetching posts:', error);
      } finally {
        if (isMounted.current && !signal.aborted) {
          setIsLoading(false);
          isLoadingMore.current = false;
        }
      }
    };
    fetchPosts();
    return () => controller.abort();
  }, [
    activeFilter,
    effectiveProviderValue,
    filterSelection.random,
    page,
    route.params.isSearch,
    retryAttempt,
  ]);
  const applyArchiveFilters = (
    selection: ReturnType<typeof parseArchiveFilterSelection>,
  ) => {
    abortController.current?.abort();
    setFilterSelection(selection);
    setActiveFilter(buildArchiveFilter(routeFilter, selection));
    setPosts([]);
    setPage(1);
    setIsEnd(false);
    setIsLoading(true);
    isLoadingMore.current = false;
    setFilterModalVisible(false);
    setRetryAttempt(value => value + 1);
  };
  const onEndReached = async () => {
    // Don't trigger more loading if we're already loading or at the end
    if (isLoading || isEnd || isLoadingMore.current || searchError) {
      return;
    }
    isLoadingMore.current = true;
    setIsLoading(true);
    setPage(prevPage => prevPage + 1);
  };

  // Limit the number of skeletons to prevent unnecessary renders
  const renderSkeletons = () => {
    const skeletonCount =
      isCalendarView || viewType === 1 ? gridColumns * 2 : 3;
    const itemWrapperStyle =
      isCalendarView || viewType === 1
        ? gridItemWrapperStyle
        : {
            marginHorizontal: 12,
            marginVertical: 12,
          };
    const imageSize =
      isCalendarView || viewType === 1
        ? {
            width: gridItemWidth,
            height: gridItemHeight,
          }
        : {
            width: 70,
            height: 105,
          };
    const textWidth = isCalendarView || viewType === 1 ? gridTitleWidth : 97;
    return Array.from({
      length: skeletonCount,
    }).map((_, i) => (
      <View
        className={
          !isCalendarView && viewType !== 1
            ? 'flex-row items-center'
            : 'gap-0 flex justify-center items-center'
        }
        style={itemWrapperStyle}
        key={i}>
        <SkeletonLoader
          height={imageSize.height}
          width={imageSize.width}
          style={{
            borderRadius: 0,
          }}
        />
        <SkeletonLoader
          height={19}
          width={textWidth}
          style={
            !isCalendarView && viewType !== 1
              ? {
                  marginLeft: 12,
                }
              : undefined
          }
        />
      </View>
    ));
  };
  const renderError = () =>
    searchError &&
    !isLoading && (
      <View
        style={{
          padding: 24,
          alignItems: 'center',
        }}
        accessibilityLiveRegion="polite">
        <Text
          style={{
            color: '#a0a0a0',
          }}>
          {t(
            route.params.isSearch
              ? 'Failed to search'
              : 'Failed to load content',
          )}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            setSearchError(false);
            setIsLoading(true);
            setRetryAttempt(value => value + 1);
          }}
          style={{
            minHeight: 48,
            justifyContent: 'center',
            paddingHorizontal: 16,
          }}>
          <Text
            style={{
              color: primary,
            }}>
            {t('Retry')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{
        flex: 1,
        backgroundColor: 'black',
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: '#23252b',
        }}>
        <View
          className="flex-row items-center gap-2"
          style={{
            flex: 1,
            minWidth: 0,
          }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('Back')}
            style={{
              minWidth: 48,
              minHeight: 48,
              justifyContent: 'center',
            }}
            onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={26} color="white" />
          </TouchableOpacity>
          <Text
            numberOfLines={2}
            className="text-2xl font-bold"
            style={{
              flexShrink: 1,
              color: route.params.isSearch ? primary : 'white',
              fontFamily: HOME_FONT.heading,
              fontWeight: 'normal',
              fontSize: 22,
            }}>
            {route.params.title}
          </Text>
        </View>
        {!isCalendarView ? (
          <View className="flex-row items-center">
            {canFilterArchive ? (
              <TouchableOpacity
                onPress={() => setFilterModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={t('Filters')}
                style={{
                  minWidth: 48,
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <MaterialIcons name="tune" size={26} color="white" />
                {hasActiveFilters ? (
                  <View
                    className="absolute w-2.5 h-2.5 rounded-full"
                    style={{backgroundColor: primary, top: 6, right: 6}}
                  />
                ) : null}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t(viewType === 1 ? 'Show list' : 'Show grid')}
              style={{
                minWidth: 48,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => {
                const newViewType = viewType === 1 ? 2 : 1;
                setViewType(newViewType);
                settingsStorage.setListViewType(newViewType);
              }}>
              <MaterialIcons
                name={viewType === 1 ? 'view-module' : 'view-list'}
                size={27}
                color="white"
              />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      <View
        testID="catalog-viewport"
        style={{
          flex: 1,
          marginHorizontal: 16,
          paddingTop: 12,
        }}
        onLayout={event =>
          setGridContainerWidth(event.nativeEvent.layout.width)
        }>
        {isCalendarView ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 24,
              flexGrow: 1,
            }}>
            {isLoading ? (
              <View className="flex flex-row flex-wrap justify-center items-center mb-16">
                {renderSkeletons()}
              </View>
            ) : (
              calendarSections.map(section => (
                <View key={section.title} className="mb-6">
                  <Text
                    className="text-xl font-bold mb-2"
                    style={{
                      color: 'white',
                      fontFamily: HOME_FONT.heading,
                    }}>
                    {section.title}
                  </Text>
                  {chunkPosts(section.data, gridColumns).map(
                    (row, rowIndex) => (
                      <View
                        key={`${section.title}-${rowIndex}`}
                        className="flex flex-row"
                        style={{
                          width: gridAvailableWidth,
                        }}>
                        {row.map(item => (
                          <TouchableOpacity
                            key={item.link}
                            className="flex flex-col"
                            style={gridItemWrapperStyle}
                            onPress={() =>
                              navigation.navigate('Info', {
                                link: item.link,
                                provider:
                                  route.params.providerValue || provider.value,
                                poster: item?.image,
                                variants: item.variants,
                                dubStatus: item.dubStatus,
                                dubStatusKey: item.dubStatusKey,
                              })
                            }>
                            <View className="relative">
                              <ProviderImage
                                uri={item.image}
                                link={item.link}
                                providerValue={
                                  route.params.providerValue || provider.value
                                }
                                artworkHints={item.artworkHints}
                                style={{
                                  width: gridItemWidth,
                                  height: gridItemHeight,
                                }}
                              />
                              <PostBadges post={item} primary={primary} />
                            </View>
                            <Text
                              className="text-white text-center text-xs"
                              style={{
                                width: gridTitleWidth,
                                ...CATALOG_CARD_TITLE_STYLE,
                              }}
                              numberOfLines={GRID_TITLE_LINES}
                              ellipsizeMode="tail">
                              {item?.title}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ),
                  )}
                </View>
              ))
            )}
            {renderError()}
            {!isLoading && !searchError && calendarSections.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  padding: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text className="text-white text-center font-semibold text-lg">
                  {t('No Content Found')}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <FlashList
            estimatedItemSize={300}
            ListEmptyComponent={
              !isLoading && !searchError && posts.length === 0 ? (
                <View
                  style={{
                    flex: 1,
                    padding: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text className="text-white text-center font-semibold text-lg">
                    {t('No Content Found')}
                  </Text>
                </View>
              ) : null
            }
            ListFooterComponent={
              <>
                {isLoading && (
                  <View
                    className={`flex ${viewType === 1 ? 'flex-row flex-wrap' : 'flex-col'} justify-center items-center mb-16`}>
                    {renderSkeletons()}
                  </View>
                )}
                {renderError()}
                <View className="h-32" />
              </>
            }
            data={posts}
            numColumns={viewType === 1 ? gridColumns : 1}
            key={`view-type-${viewType}-${viewType === 1 ? gridColumns : 1}`}
            contentContainerStyle={{
              paddingBottom: 80,
            }}
            keyExtractor={(item, i) => `${item.title}-${i}`}
            renderItem={({item}) => (
              <TouchableOpacity
                className={
                  viewType === 1 ? 'flex flex-col' : 'flex-row m-3 items-center'
                }
                style={viewType === 1 ? gridItemWrapperStyle : undefined}
                onPress={() =>
                  navigation.navigate('Info', {
                    link: item.link,
                    provider: route.params.providerValue || provider.value,
                    poster: item?.image,
                    variants: item.variants,
                    dubStatus: item.dubStatus,
                    dubStatusKey: item.dubStatusKey,
                  })
                }>
                <View className="relative">
                  <ProviderImage
                    uri={item.image}
                    link={item.link}
                    providerValue={route.params.providerValue || provider.value}
                    artworkHints={item.artworkHints}
                    style={
                      viewType === 1
                        ? {
                            width: gridItemWidth,
                            height: gridItemHeight,
                          }
                        : {
                            width: 70,
                            height: 105,
                          }
                    }
                  />
                  <PostBadges post={item} primary={primary} />
                </View>
                <Text
                  className={
                    viewType === 1
                      ? 'text-white text-center text-xs'
                      : 'text-white ml-3'
                  }
                  style={
                    viewType === 1
                      ? {
                          width: gridTitleWidth,
                          ...CATALOG_CARD_TITLE_STYLE,
                        }
                      : {
                          ...CATALOG_CARD_TITLE_STYLE,
                          flex: 1,
                          minWidth: 0,
                          marginTop: 0,
                          minHeight: 0,
                        }
                  }
                  numberOfLines={viewType === 1 ? GRID_TITLE_LINES : 2}
                  ellipsizeMode="tail">
                  {item?.title}
                </Text>
              </TouchableOpacity>
            )}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
          />
        )}
      </View>
      <ArchiveFilterModal
        visible={filterModalVisible}
        filters={archiveFilters}
        value={filterSelection}
        primary={primary}
        onApply={applyArchiveFilters}
        onClose={() => setFilterModalVisible(false)}
      />
    </SafeAreaView>
  );
};
export default function CatalogOrProviderList(props: Props) {
  return props.route.params.catalogSection ? <CatalogBrowse section={props.route.params.catalogSection} search={props.route.params.catalogSearch} /> : <ScrollList {...props} />;
}
