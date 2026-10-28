import {
  Pressable,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import React, {memo, useCallback, useMemo, useState} from 'react';
import type {Post} from '../lib/providers/types';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {HomeStackParamList} from '../App';
import useContentStore from '../lib/zustand/contentStore';
import {FlashList} from '@shopify/flash-list';
import type {FlashListProps} from '@shopify/flash-list';
import SkeletonLoader from './Skeleton';
import HomeRowState from './HomeRowState';
import {getHomeCardWidth} from './homePresentation';
import ProviderImage from './ProviderImage';
import {useTranslation} from 'react-i18next';
import PostBadges from './PostBadges';
import {startPerfNavigation} from '../lib/utils/perfTrace';
import {getSkeletonPlaceholderCount} from './sliderSkeleton';

// import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import useThemeStore from '../lib/zustand/themeStore';

const getPostKey = (item: Post, index: number) =>
  `${item.link}-${item.episodeId ?? item.episodeLabel ?? index}`;

const CARD_IMAGE_WIDTH = 100;
const CARD_IMAGE_HEIGHT = 150;
const CARD_TITLE_WIDTH = 112;
const CARD_TITLE_LINE_HEIGHT = 15;
const CARD_TITLE_LINES = 3;
const CARD_HORIZONTAL_MARGIN = 8;
const CARD_ESTIMATED_ITEM_SIZE = CARD_TITLE_WIDTH + CARD_HORIZONTAL_MARGIN * 2;

const SafeFlashList = <T,>({style, ...rest}: FlashListProps<T>) => (
  <View style={style}>
    <FlashList {...rest} />
  </View>
);

const Slider = ({
  homeAppearance = false,
  onRetry,
  retrying = false,
  isLoading,
  title,
  posts,
  filter,
  providerValue,
  isSearch = false,
  onHorizontalDragStart,
  onHorizontalDragEnd,
  error,
}: {
  homeAppearance?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  isLoading: boolean;
  title: string;
  posts: Post[];
  filter: string;
  providerValue?: string;
  isSearch?: boolean;
  onHorizontalDragStart?: () => void;
  onHorizontalDragEnd?: () => void;
  error?: string;
}): React.ReactElement => {
  const {provider} = useContentStore(state => state);
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const {width: windowWidth} = useWindowDimensions();
  const cardWidth = homeAppearance
    ? getHomeCardWidth(windowWidth)
    : CARD_TITLE_WIDTH;
  const imageWidth = homeAppearance ? cardWidth : CARD_IMAGE_WIDTH;
  const imageHeight = homeAppearance ? cardWidth * 1.5 : CARD_IMAGE_HEIGHT;
  const skeletonPlaceholderCount = homeAppearance
    ? Math.ceil(windowWidth / (cardWidth + 16)) + 1
    : getSkeletonPlaceholderCount(windowWidth);
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [isSelected, setSelected] = useState('');
  const [visiblePostKeys, setVisiblePostKeys] = useState<Set<string>>(
    () => new Set(),
  );
  // const {removeItem} = useWatchHistoryStore(state => state);

  const viewabilityConfig = useMemo(
    () => ({itemVisiblePercentThreshold: 20, minimumViewTime: 80}),
    [],
  );
  const handleViewableItemsChanged = useCallback<
    NonNullable<FlashListProps<Post>['onViewableItemsChanged']>
  >(({viewableItems}) => {
    const next = new Set<string>();
    viewableItems.forEach(token => {
      if (token.item && token.index != null) {
        next.add(getPostKey(token.item, token.index));
      }
    });
    setVisiblePostKeys(previous => {
      if (
        previous.size === next.size &&
        Array.from(previous).every(key => next.has(key))
      ) {
        return previous;
      }
      return next;
    });
  }, []);

  const handleMorePress = useCallback(() => {
    navigation.navigate('ScrollList', {
      title: title,
      filter: filter,
      providerValue: providerValue,
      isSearch: isSearch,
    });
  }, [navigation, title, filter, providerValue, isSearch]);

  const handleItemPress = useCallback(
    (item: Post) => {
      setSelected('');
      startPerfNavigation(
        item.provider || providerValue || provider?.value || '',
      );
      navigation.navigate('Info', {
        link: item.link,
        provider: item.provider || providerValue || provider?.value,
        poster: item?.image,
        variants: item.variants,
        dubStatus: item.dubStatus,
        dubStatusKey: item.dubStatusKey,
      });
    },
    [navigation, providerValue, provider?.value],
  );

  const renderItem = useCallback(
    ({item, index}: {item: Post; index: number}) => (
      <View
        className="flex flex-col mx-2"
        style={{
          width: cardWidth,
          alignItems: homeAppearance ? 'flex-start' : 'center',
        }}>
        <TouchableOpacity
          onLongPress={e => {
            e.stopPropagation();
            // if (filter === 'recent') {
            //   console.log('long press', filter);
            //   ReactNativeHapticFeedback.trigger('effectClick', {
            //     enableVibrateFallback: true,
            //     ignoreAndroidSystemSettings: false,
            //   });
            //   setSelected(item.link);
            // }
          }}
          onPress={e => {
            e.stopPropagation();
            handleItemPress(item);
          }}>
          <View className="relative">
            <ProviderImage
              className={homeAppearance ? undefined : 'rounded-md'}
              uri={item?.image}
              link={item.link}
              providerValue={item.provider || providerValue || provider?.value}
              artworkHints={item.artworkHints}
              shouldResolveArtwork={visiblePostKeys.has(
                getPostKey(item, index),
              )}
              style={{width: imageWidth, height: imageHeight}}
            />
            <PostBadges post={item} primary={primary} />
          </View>
          {/* {isSelected === item.link && (
            <View className="absolute top-0 left-0 w-full h-full bg-black/50 flex justify-center items-center z-50">
              <AntDesign
                name="delete"
                size={24}
                color="white"
                onPress={() => {
                  console.log('remove', item);
                  setSelected('');
                  removeItem(item);
                }}
              />
            </View>
          )} */}
        </TouchableOpacity>
        <Text
          className="text-white text-center text-xs"
          style={{
            width: cardWidth,
            textAlign: homeAppearance ? 'left' : 'center',
            fontSize: homeAppearance ? 14 : 12,
            marginTop: homeAppearance ? 8 : 0,
            lineHeight: homeAppearance ? 19 : CARD_TITLE_LINE_HEIGHT,
            minHeight: CARD_TITLE_LINE_HEIGHT * CARD_TITLE_LINES,
          }}
          numberOfLines={CARD_TITLE_LINES}
          ellipsizeMode="tail">
          {item.title}
        </Text>
      </View>
    ),
    [
      cardWidth,
      imageWidth,
      imageHeight,
      homeAppearance,
      handleItemPress,
      primary,
      provider?.value,
      providerValue,
      t,
      visiblePostKeys,
    ],
  );

  const keyExtractor = useCallback(
    (item: Post, index: number) => getPostKey(item, index),
    [],
  );
  const listExtraData = useMemo(
    () => ({isSelected, visiblePostKeys}),
    [isSelected, visiblePostKeys],
  );

  return (
    <Pressable
      onPress={() => setSelected('')}
      className="gap-3 mt-3 px-2"
      style={homeAppearance ? {marginBottom: 24} : undefined}>
      <View className="flex flex-row items-center justify-between">
        <Text
          className="text-2xl font-semibold flex-1"
          numberOfLines={1}
          style={{
            color: homeAppearance ? 'white' : primary,
            paddingLeft: homeAppearance ? 8 : 0,
            fontWeight: homeAppearance ? '700' : '600',
          }}>
          {title}
        </Text>
        {filter !== 'recent' && (
          <TouchableOpacity onPress={handleMorePress}>
            <Text className="text-white text-sm">{t('More')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {isLoading ? (
        <View
          className={
            homeAppearance
              ? 'flex flex-row overflow-hidden'
              : 'flex flex-row gap-2 overflow-hidden'
          }
          style={
            homeAppearance ? {paddingHorizontal: 3, paddingTop: 7} : undefined
          }>
          {Array.from({length: skeletonPlaceholderCount}).map((_, index) => (
            <View
              className={
                homeAppearance
                  ? 'mx-2'
                  : 'mx-3 gap-0 flex mb-3 justify-center items-center'
              }
              style={{width: cardWidth}}
              key={index}>
              <SkeletonLoader
                height={imageHeight}
                width={imageWidth}
                marginVertical={homeAppearance ? 0 : 8}
                style={homeAppearance ? {borderRadius: 0} : undefined}
              />
              <SkeletonLoader
                height={homeAppearance ? 19 : 12}
                width={cardWidth}
              />
              {homeAppearance ? <View style={{height: 30}} /> : null}
            </View>
          ))}
        </View>
      ) : homeAppearance && posts.length === 0 ? (
        <HomeRowState error={!!error} onRetry={onRetry} retrying={retrying} />
      ) : (
        <SafeFlashList
          estimatedItemSize={
            homeAppearance ? cardWidth + 16 : CARD_ESTIMATED_ITEM_SIZE
          }
          showsHorizontalScrollIndicator={false}
          data={posts}
          extraData={listExtraData}
          horizontal
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onScrollBeginDrag={onHorizontalDragStart}
          onMomentumScrollBegin={onHorizontalDragStart}
          onScrollEndDrag={onHorizontalDragEnd}
          onMomentumScrollEnd={onHorizontalDragEnd}
          contentContainerStyle={{paddingHorizontal: 3, paddingTop: 7}}
          renderItem={renderItem}
          ListFooterComponent={
            !isLoading && error && !homeAppearance ? (
              <View className="flex flex-row w-96 justify-center h-10 items-center">
                <Text className="text-red-500 text-center">{error}</Text>
              </View>
            ) : !isLoading && posts.length === 0 ? (
              <View className="flex flex-row w-96 justify-center h-10 items-center">
                <Text className="text-whiter text-center text-white">
                  {t('No Content Found')}
                </Text>
              </View>
            ) : null
          }
          keyExtractor={keyExtractor}
        />
      )}
      {homeAppearance && !isLoading && posts.length > 0 && !!error ? (
        <HomeRowState error onRetry={onRetry} retrying={retrying} />
      ) : null}
    </Pressable>
  );
};

export default memo(Slider);
