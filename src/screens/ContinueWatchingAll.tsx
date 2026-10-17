import React, {useMemo} from 'react';
import {
  Image,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {HomeStackParamList} from '../App';
import useThemeStore from '../lib/zustand/themeStore';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import {
  getHistoryProgressPercent,
  selectContinueWatchingItems,
} from '../lib/utils/continueWatching';

type Props = NativeStackScreenProps<HomeStackParamList, 'ContinueWatchingAll'>;

const ContinueWatchingAll = ({navigation}: Props) => {
  const {t} = useTranslation();
  const {primary} = useThemeStore(state => state);
  const {history, hiddenFromContinueWatching, hideContinueWatchingItem} =
    useWatchHistoryStore(state => state);
  const items = useMemo(
    () =>
      selectContinueWatchingItems(
        history,
        Number.MAX_SAFE_INTEGER,
        hiddenFromContinueWatching,
      ),
    [history, hiddenFromContinueWatching],
  );

  return (
    <View className="flex-1 bg-black">
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={{paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0}} />
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('Close')}
          className="mr-3">
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">
          {t('Continue Watching')}
        </Text>
      </View>
      <FlashList
        data={items}
        numColumns={3}
        estimatedItemSize={190}
        contentContainerStyle={{paddingHorizontal: 8, paddingBottom: 28}}
        keyExtractor={item => item.link}
        ListEmptyComponent={() => (
          <View className="items-center mt-12 px-6">
            <MaterialCommunityIcons name="play-circle-outline" size={72} color={primary} />
            <Text className="text-white/70 text-center mt-3">
              {t('No items to continue watching')}
            </Text>
          </View>
        )}
        renderItem={({item}) => {
          const progress = getHistoryProgressPercent(item);
          let infoLink: typeof item.link | Record<string, unknown> = item.link;
          if (item.link.startsWith('{')) {
            try {
              infoLink = JSON.parse(item.link);
            } catch {
              // Keep the stored link if it is not valid JSON.
            }
          }
          return (
            <View className="flex-1 m-1">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate('Info', {
                    link: infoLink as typeof item.link,
                    provider: item.provider,
                    poster: item.poster,
                  })
                }>
                <View className="relative">
                  <Image
                    source={{uri: item.poster}}
                    className="w-full aspect-[2/3] rounded-lg"
                  />
                  <View className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                    <View
                      style={{width: `${progress}%`, height: '100%', backgroundColor: primary}}
                    />
                  </View>
                </View>
                <Text className="text-white text-sm mt-1" numberOfLines={2}>
                  {item.displayTitle || item.title}
                </Text>
                {item.episodeTitle ? (
                  <Text className="text-white/60 text-xs" numberOfLines={1}>
                    {item.episodeTitle}
                  </Text>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => hideContinueWatchingItem(item.link)}
                accessibilityLabel={t('Remove from Continue Watching')}
                className="absolute top-1 right-1 rounded-full bg-black/70 p-1">
                <MaterialCommunityIcons name="close" size={19} color="white" />
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
};

export default ContinueWatchingAll;
