import {SafeAreaView} from 'react-native-safe-area-context';
import {
  HOME_FONT,
  CATALOG_CARD_TITLE_STYLE,
} from '../components/homePresentation';
import usePosterGrid from '../components/usePosterGrid';
import React, {useMemo} from 'react';
import {StatusBar, Text, TouchableOpacity, View} from 'react-native';
import CatalogSavedImage from '../components/catalog/CatalogSavedImage';
import {FlashList} from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {HomeStackParamList} from '../App';
import useThemeStore from '../lib/zustand/themeStore';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import {
  getContinueWatchingPresentation,
  selectContinueWatchingItems,
} from '../lib/utils/continueWatching';

type Props = NativeStackScreenProps<HomeStackParamList, 'ContinueWatchingAll'>;

const ContinueWatchingAll = ({navigation}: Props) => {
  const {t} = useTranslation();
  const grid = usePosterGrid();
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
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{flex: 1, backgroundColor: 'black'}}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <View
        className="flex-row items-center px-4 py-3"
        style={{borderBottomWidth: 1, borderBottomColor: '#23252b'}}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('Close')}
          style={{minWidth: 48, minHeight: 48, justifyContent: 'center'}}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: HOME_FONT.heading,
            fontSize: 22,
            color: 'white',
            flex: 1,
          }}>
          {t('Continue Watching')}
        </Text>
      </View>
      <View
        testID="history-viewport"
        onLayout={grid.onLayout}
        style={{flex: 1, marginHorizontal: 10, paddingTop: 12}}>
        {grid.ready && (
          <FlashList
            data={items}
            numColumns={grid.columns}
            key={grid.columns}
            estimatedItemSize={190}
            contentContainerStyle={{paddingBottom: 28}}
            keyExtractor={item => item.link}
            ListEmptyComponent={() => (
              <View className="items-center mt-12 px-6">
                <MaterialCommunityIcons
                  name="play-circle-outline"
                  size={72}
                  color={primary}
                />
                <Text className="text-white/70 text-center mt-3">
                  {t('No items to continue watching')}
                </Text>
              </View>
            )}
            renderItem={({item}) => {
              const presentation = getContinueWatchingPresentation(item);
              const progress = presentation.progressPercent;
              let infoLink: typeof item.link | Record<string, unknown> =
                item.link;
              if (item.link.startsWith('{')) {
                try {
                  infoLink = JSON.parse(item.link);
                } catch {
                  // Keep the stored link if it is not valid JSON.
                }
              }
              return (
                <View
                  style={{
                    width: grid.cellWidth,
                    paddingHorizontal: 6,
                    marginBottom: 24,
                  }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      navigation.navigate('Info', {
                        link: infoLink as typeof item.link,
                        provider: item.provider,
                        poster: item.poster,
                        catalogRef: item.catalogRef,
                        continueWatchingTarget: presentation.target,
                      })
                    }>
                    <View className="relative">
                      <CatalogSavedImage
                        catalogRef={item.catalogRef}
                        source={{uri: item.poster}}
                        resizeMode="cover"
                        style={{
                          width: grid.posterWidth,
                          height: grid.posterWidth * 1.5,
                          backgroundColor: '#23252b',
                        }}
                      />
                      {presentation.hasNewEpisodes ? (
                        <View
                          className="absolute bottom-3 left-1 rounded px-1 py-0.5"
                          style={{backgroundColor: primary}}>
                          <Text className="text-black text-[9px] font-semibold">
                            {t('New episodes')}
                          </Text>
                        </View>
                      ) : null}
                      <View className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                        <View
                          style={{
                            width: `${progress}%`,
                            height: '100%',
                            backgroundColor: primary,
                          }}
                        />
                      </View>
                    </View>
                    <Text
                      style={{...CATALOG_CARD_TITLE_STYLE, color: 'white'}}
                      numberOfLines={3}>
                      {item.displayTitle || item.title}
                    </Text>
                    {(
                      presentation.target
                        ? presentation.target.episodeNumber != null
                        : !!item.episodeTitle
                    ) ? (
                      <Text className="text-white/60 text-xs" numberOfLines={1}>
                        {presentation.target?.seasonNumber != null &&
                        presentation.target?.episodeNumber != null
                          ? t('SeasonBadge {{season}}-Ep. {{episode}}', {
                              season: presentation.target.seasonNumber,
                              episode: presentation.target.episodeNumber,
                            })
                          : presentation.target?.episodeNumber != null
                            ? t('Ep. {{number}}', {
                                number: presentation.target.episodeNumber,
                              })
                            : item.episodeTitle}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => hideContinueWatchingItem(item.link)}
                    accessibilityLabel={t('Remove from Continue Watching')}
                    className="absolute top-1 right-1 rounded-full bg-black/70 p-1">
                    <MaterialCommunityIcons
                      name="close"
                      size={19}
                      color="white"
                    />
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default ContinueWatchingAll;
