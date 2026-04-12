import {Pressable, Text, TouchableOpacity, View} from 'react-native';
import React, {memo, useCallback, useState} from 'react';
import type {Post} from '../lib/providers/types';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {HomeStackParamList} from '../App';
import useContentStore from '../lib/zustand/contentStore';
import {FlashList} from '@shopify/flash-list';
import type {FlashListProps} from '@shopify/flash-list';
import SkeletonLoader from './Skeleton';
import ProviderImage from './ProviderImage';
import {useTranslation} from 'react-i18next';
import {hasItaBadge} from '../lib/utils/helpers';

// import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import useThemeStore from '../lib/zustand/themeStore';

const Slider = ({
  isLoading,
  title,
  posts,
  filter,
  providerValue,
  isSearch = false,
  onHorizontalDragStart,
  onHorizontalDragEnd,
}: {
  isLoading: boolean;
  title: string;
  posts: Post[];
  filter: string;
  providerValue?: string;
  isSearch?: boolean;
  onHorizontalDragStart?: () => void;
  onHorizontalDragEnd?: () => void;
}): React.ReactElement => {
  const {provider} = useContentStore(state => state);
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [isSelected, setSelected] = useState('');
  // const {removeItem} = useWatchHistoryStore(state => state);

  const SafeFlashList = <T,>({style, ...rest}: FlashListProps<T>) => (
    <View style={style}>
      <FlashList {...rest} />
    </View>
  );

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
      navigation.navigate('Info', {
        link: item.link,
        provider: item.provider || providerValue || provider?.value,
        poster: item?.image,
      });
    },
    [navigation, providerValue, provider?.value],
  );

  const renderItem = useCallback(
    ({item}: {item: Post}) => (
      <View className="flex flex-col mx-2">
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
              className="rounded-md"
              uri={item?.image}
              link={item.link}
              providerValue={item.provider || providerValue || provider?.value}
              style={{width: 100, height: 150}}
            />
            {(() => {
              const episodeLabel = item.episodeLabelKey
                ? t(item.episodeLabelKey, item.episodeLabelParams)
                : item.episodeLabel;
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
          className="text-white text-center w-24 text-xs"
          numberOfLines={2}
          ellipsizeMode="tail">
          {item.title}
        </Text>
      </View>
    ),
    [handleItemPress, primary, provider?.value, providerValue, t],
  );

  const keyExtractor = useCallback(
    (item: Post, index: number) =>
      `${item.link}-${item.episodeId ?? item.episodeLabel ?? index}`,
    [],
  );

  return (
    <Pressable onPress={() => setSelected('')} className="gap-3 mt-3 px-2">
      <View className="flex flex-row items-center justify-between">
        <Text
          className="text-2xl font-semibold flex-1"
          numberOfLines={1}
          style={{color: primary}}>
          {title}
        </Text>
        {filter !== 'recent' && (
          <TouchableOpacity onPress={handleMorePress}>
            <Text className="text-white text-sm">{t('More')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {isLoading ? (
        <View className="flex flex-row gap-2 overflow-hidden">
          {Array.from({length: 20}).map((_, index) => (
            <View
              className="mx-3 gap-0 flex mb-3 justify-center items-center"
              key={index}>
              <SkeletonLoader height={150} width={100} />
              <SkeletonLoader height={12} width={97} />
            </View>
          ))}
        </View>
      ) : (
        <SafeFlashList
          estimatedItemSize={30}
          showsHorizontalScrollIndicator={false}
          data={posts}
          extraData={isSelected}
          horizontal
          onScrollBeginDrag={onHorizontalDragStart}
          onMomentumScrollBegin={onHorizontalDragStart}
          onScrollEndDrag={onHorizontalDragEnd}
          onMomentumScrollEnd={onHorizontalDragEnd}
          contentContainerStyle={{paddingHorizontal: 3, paddingTop: 7}}
          renderItem={renderItem}
          ListFooterComponent={
            !isLoading && posts.length === 0 ? (
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
    </Pressable>
  );
};

export default memo(Slider);
