import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import React, {useEffect, useMemo, useState, useRef, useCallback} from 'react';
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
import {hasItaBadge} from '../lib/utils/helpers';

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

const ScrollList = ({route}: Props): React.ReactElement => {
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const [posts, setPosts] = useState<Post[]>([]);
  const {filter, providerValue} = route.params;
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEnd, setIsEnd] = useState<boolean>(false);
  const {provider} = useContentStore(state => state);
  const {width: windowWidth} = useWindowDimensions();
  const [gridContainerWidth, setGridContainerWidth] = useState<number>(0);
  const [viewType, setViewType] = useState<number>(
    settingsStorage.getListViewType(),
  );
  const isCalendarView = filter === 'calendar' && !route.params.isSearch;
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
  const resolveEpisodeLabel = useCallback(
    (post: Post) =>
      post.episodeLabelKey
        ? t(post.episodeLabelKey, post.episodeLabelParams)
        : post.episodeLabel,
    [t],
  );
  const gridColumns = 3;
  const gridFallbackHorizontalPadding = 32;
  const gridMaxItemWidth = 100;
  const gridBaseWidth =
    gridContainerWidth > 0
      ? gridContainerWidth
      : Math.max(0, windowWidth - gridFallbackHorizontalPadding);
  const gridAvailableWidth = Math.max(0, gridBaseWidth);
  const gridColumnWidth =
    gridAvailableWidth > 0
      ? Math.floor(gridAvailableWidth / gridColumns)
      : gridMaxItemWidth;
  const gridItemWidth = Math.min(gridMaxItemWidth, gridColumnWidth);
  const gridItemHeight = Math.round(gridItemWidth * 1.5);
  const gridTitleWidth = Math.max(80, Math.min(gridItemWidth, gridColumnWidth) - 4);
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
    const signal = abortController.current.signal;

    const fetchPosts = async () => {
      // Don't fetch if we're already at the end
        if (isEnd) {
          return;
        }

      try {
        // Prevent concurrent loading calls
        if (isLoadingMore.current) {
          return;
        }
        isLoadingMore.current = true;

        setIsLoading(true);

        // Simulate network delay to reduce rapid API calls
        // Remove this in production if not needed
        await new Promise(resolve => setTimeout(resolve, 300));

        // Skip if component unmounted or request was aborted
        if (!isMounted.current || signal.aborted) {
          return;
        }

        const getNewPosts = route.params.isSearch
          ? providerManager.getSearchPosts({
              searchQuery: filter,
              page,
              providerValue: providerValue || provider.value,
              signal,
            })
          : providerManager.getPosts({
              filter,
              page,
              providerValue: providerValue || provider.value,
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

        setPosts(prev => [...prev, ...newPosts]);
      } catch (error) {
        // Skip handling if component unmounted or request was aborted
        if (!isMounted.current || (error as any)?.name === 'AbortError') {
          return;
        }
        console.error('Error fetching posts:', error);
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
          isLoadingMore.current = false;
        }
      }
    };

    fetchPosts();
  }, [page, route.params, filter, provider.value]);

  const onEndReached = async () => {
    // Don't trigger more loading if we're already loading or at the end
    if (isLoading || isEnd || isLoadingMore.current) {
      return;
    }
    setIsLoading(true);
    setPage(prevPage => prevPage + 1);
  };

  // Limit the number of skeletons to prevent unnecessary renders
  const renderSkeletons = () => {
    const skeletonCount = viewType === 1 ? 6 : 3;
    const itemWrapperStyle =
      viewType === 1
        ? gridItemWrapperStyle
        : {marginHorizontal: 12, marginVertical: 12};
    const imageSize =
      viewType === 1
        ? {width: gridItemWidth, height: gridItemHeight}
        : {width: 100, height: 150};
    const textWidth = viewType === 1 ? gridTitleWidth : 97;
    return Array.from({length: skeletonCount}).map((_, i) => (
      <View
        className="gap-0 flex justify-center items-center"
        style={itemWrapperStyle}
        key={i}>
        <SkeletonLoader height={imageSize.height} width={imageSize.width} />
        <SkeletonLoader height={12} width={textWidth} />
      </View>
    ));
  };

  return (
    <View className="h-full w-full bg-black items-center p-4" style={{flex: 1}}>
      <View className="w-full px-4 font-semibold my-6 flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={26} color="white" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold" style={{color: primary}}>
            {route.params.title}
          </Text>
        </View>
        {!isCalendarView && (
          <TouchableOpacity
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
        )}
      </View>
      <View
        className="justify-center flex-row w-full"
        style={{flex: 1}}
        onLayout={event =>
          setGridContainerWidth(event.nativeEvent.layout.width)
        }>
        {isCalendarView ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{paddingBottom: 80}}>
            {isLoading ? (
              <View className="flex flex-row flex-wrap gap-1 justify-center items-center mb-16">
                {renderSkeletons()}
              </View>
            ) : (
              calendarSections.map(section => (
                <View key={section.title} className="mb-6">
                  <Text
                    className="text-xl font-bold mb-2"
                    style={{color: primary}}>
                    {section.title}
                  </Text>
                  {chunkPosts(section.data, 3).map((row, rowIndex) => (
                    <View
                      key={`${section.title}-${rowIndex}`}
                      className="flex flex-row"
                      style={{width: gridAvailableWidth}}>
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
                            })
                          }>
                          <View className="relative">
                            <ProviderImage
                              className="rounded-md"
                              uri={item.image}
                              link={item.link}
                              providerValue={
                                route.params.providerValue || provider.value
                              }
                              style={{
                                width: gridItemWidth,
                                height: gridItemHeight,
                              }}
                            />
                            {(() => {
                              const episodeLabel = resolveEpisodeLabel(item);
                              return episodeLabel ? (
                                <View
                                  className="absolute top-1 right-1 rounded-full px-2 py-0.5"
                                  style={{backgroundColor: primary}}>
                                  <Text className="text-black text-[10px] font-semibold">
                                    {episodeLabel}
                                  </Text>
                                </View>
                              ) : null;
                            })()}
                            {hasItaBadge(item.title) ? (
                              <View
                                className="absolute top-1 left-1 rounded-full px-2 py-0.5"
                                style={{backgroundColor: primary}}>
                                <Text className="text-black text-[10px] font-semibold">
                                  {t('ITA')}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text
                            className="text-white text-center text-xs"
                            style={{width: gridTitleWidth}}
                            numberOfLines={2}
                            ellipsizeMode="tail">
                            {item?.title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              ))
            )}
            {!isLoading && calendarSections.length === 0 ? (
              <View className="w-full h-full flex items-center justify-center">
                <Text className="text-white text-center font-semibold text-lg">
                  {t('No Content Found')}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <FlashList
            estimatedItemSize={300}
            ListFooterComponent={
              <>
                {isLoading && (
                  <View
                    className={`flex ${
                      viewType === 1 ? 'flex-row flex-wrap' : 'flex-col'
                    } gap-1 justify-center items-center mb-16`}>
                    {renderSkeletons()}
                  </View>
                )}
                <View className="h-32" />
              </>
            }
            data={posts}
            numColumns={viewType === 1 ? 3 : 1}
            key={`view-type-${viewType}`}
            contentContainerStyle={{paddingBottom: 80}}
            keyExtractor={(item, i) => `${item.title}-${i}`}
            renderItem={({item}) => (
              <TouchableOpacity
                className={
                  viewType === 1
                    ? 'flex flex-col'
                    : 'flex-row m-3 items-center'
                }
                style={
                  viewType === 1
                    ? gridItemWrapperStyle
                    : undefined
                }
                onPress={() =>
                  navigation.navigate('Info', {
                    link: item.link,
                    provider: route.params.providerValue || provider.value,
                    poster: item?.image,
                  })
                }>
                <View className="relative">
                  <ProviderImage
                    className="rounded-md"
                    uri={item.image}
                    link={item.link}
                    providerValue={route.params.providerValue || provider.value}
                    style={
                      viewType === 1
                        ? {width: gridItemWidth, height: gridItemHeight}
                        : {width: 70, height: 100}
                    }
                  />
                  {(() => {
                    const episodeLabel = resolveEpisodeLabel(item);
                    return episodeLabel ? (
                      <View
                        className="absolute top-1 right-1 rounded-full px-2 py-0.5"
                        style={{backgroundColor: primary}}>
                        <Text className="text-black text-[10px] font-semibold">
                          {episodeLabel}
                        </Text>
                      </View>
                    ) : null;
                  })()}
                  {hasItaBadge(item.title) ? (
                    <View
                      className="absolute top-1 left-1 rounded-full px-2 py-0.5"
                      style={{backgroundColor: primary}}>
                      <Text className="text-black text-[10px] font-semibold">
                        {t('ITA')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  className={
                    viewType === 1
                      ? 'text-white text-center text-xs'
                      : 'text-white ml-3 w-72 font-semibold text-base'
                  }
                  style={viewType === 1 ? {width: gridTitleWidth} : undefined}
                  numberOfLines={2}
                  ellipsizeMode="tail">
                  {item?.title}
                </Text>
              </TouchableOpacity>
            )}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
          />
        )}
        {!isCalendarView && !isLoading && posts.length === 0 ? (
          <View className="w-full h-full flex items-center justify-center">
            <Text className="text-white text-center font-semibold text-lg">
              {t('No Content Found')}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default ScrollList;
