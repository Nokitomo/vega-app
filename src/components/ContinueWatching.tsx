import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import {useNavigation} from '@react-navigation/native';
import {getHomeCardWidth, HOME_ACCENT, HOME_FONT} from './homePresentation';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {HomeStackParamList} from '../App';
import AntDesign from '@expo/vector-icons/AntDesign';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import useUiSettingsStore from '../lib/zustand/uiSettingsStore';
import {useTranslation} from 'react-i18next';
import {hasItaBadge} from '../lib/utils/helpers';
import {
  getContinueWatchingPresentation,
  selectContinueWatchingItems,
} from '../lib/utils/continueWatching';

type EpisodeMeta = {
  episodeTitle?: string;
  episodeNumber?: number;
  seasonNumber?: number;
};

const CONTINUE_WATCHING_LIMIT = 30;

const normalizeNumericValue = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const ContinueWatching = ({
  onHorizontalDragStart,
  onHorizontalDragEnd,
}: {
  onHorizontalDragStart?: () => void;
  onHorizontalDragEnd?: () => void;
}) => {
  const primary = HOME_ACCENT;
  const {width} = useWindowDimensions();
  const cardWidth = getHomeCardWidth(width);
  const {t} = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const {
    history,
    hiddenFromContinueWatching,
    hideContinueWatchingItem,
    migrateDisplayTitles,
  } = useWatchHistoryStore(state => state);
  const showRecentlyWatched = useUiSettingsStore(
    state => state.showRecentlyWatched,
  );
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<boolean>(false);

  useEffect(() => {
    migrateDisplayTitles().catch(error => {
      console.error('Error migrating watch history display titles:', error);
    });
  }, [migrateDisplayTitles]);

  const getEpisodeLabel = ({
    episodeTitle,
    episodeNumber,
    seasonNumber,
  }: EpisodeMeta) => {
    const parsedEpisodeNumber =
      normalizeNumericValue(episodeNumber) ??
      (episodeTitle
        ? Number.parseInt(episodeTitle.match(/\d+/)?.[0] || '', 10)
        : NaN);
    if (!Number.isFinite(parsedEpisodeNumber) || parsedEpisodeNumber <= 0) {
      return undefined;
    }
    const parsedSeasonNumber = normalizeNumericValue(seasonNumber);
    if (parsedSeasonNumber != null && parsedSeasonNumber >= 0) {
      return t('SeasonBadge {{season}}-Ep. {{episode}}', {
        season: parsedSeasonNumber,
        episode: parsedEpisodeNumber,
      });
    }
    return t('Ep. {{number}}', {number: parsedEpisodeNumber});
  };

  // Exclude completed movies before applying the Home limit.
  const recentItems = React.useMemo(() => {
    return selectContinueWatchingItems(
      history,
      CONTINUE_WATCHING_LIMIT,
      hiddenFromContinueWatching,
    );
  }, [history, hiddenFromContinueWatching]);

  const handleNavigateToInfo = (item: any) => {
    try {
      // Parse the link if it's a JSON string
      let linkData = item.link;
      if (typeof item.link === 'string' && item.link.startsWith('{')) {
        try {
          linkData = JSON.parse(item.link);
        } catch (e) {
          console.error('Failed to parse link:', e);
        }
      }
      // Navigate to Info screen
      navigation.navigate('Info', {
        link: linkData,
        provider: item.provider,
        poster: item.poster,
        continueWatchingTarget: getContinueWatchingPresentation(item).target,
      });
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const toggleItemSelection = (link: string) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(link)) {
        newSelected.delete(link);
      } else {
        newSelected.add(link);
      }

      // Exit selection mode if no items are selected
      if (newSelected.size === 0) {
        setSelectionMode(false);
      }

      return newSelected;
    });
  };

  const handleLongPress = (link: string) => {
    ReactNativeHapticFeedback.trigger('effectClick', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });

    // Enter selection mode if not already in it
    if (!selectionMode) {
      setSelectionMode(true);
    }

    toggleItemSelection(link);
  };

  const handlePress = (item: any) => {
    if (selectionMode) {
      toggleItemSelection(item.link);
    } else {
      handleNavigateToInfo(item);
    }
  };

  const handleSeeAllPress = () => {
    navigation.navigate('ContinueWatchingAll');
  };

  const deleteSelectedItems = () => {
    recentItems.forEach(item => {
      if (selectedItems.has(item.link)) {
        hideContinueWatchingItem(item.link);
      }
    });
    setSelectedItems(new Set());
    setSelectionMode(false);
  };

  const exitSelectionMode = () => {
    setSelectedItems(new Set());
    setSelectionMode(false);
  };

  // Only render if we have items (MOVED AFTER ALL HOOKS)
  if (!showRecentlyWatched) {
    return null;
  }
  if (recentItems.length === 0) {
    return null;
  }

  return (
    <Pressable
      onPress={() => selectionMode && exitSelectionMode()}
      className="mt-3 mb-8">
      <View className="flex flex-row justify-between items-center px-4 mb-3">
        <Text
          className="flex-1"
          style={{
            color: 'white',
            fontFamily: HOME_FONT.heading,
            fontSize: 20,
            lineHeight: 26,
          }}>
          {t('Continue Watching')}
        </Text>

        <View className="flex flex-row items-center">
          {!selectionMode && (
            <TouchableOpacity
              onPress={handleSeeAllPress}
              className="mr-2"
              style={{
                minWidth: 48,
                minHeight: 48,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Text
                className="text-white text-sm"
                style={{fontFamily: HOME_FONT.medium}}>
                {t('More')}
              </Text>
            </TouchableOpacity>
          )}

          {selectionMode && selectedItems.size > 0 && (
            <View className="flex flex-row items-center">
              <Text className="text-white mr-1">
                {t('{{count}} selected', {count: selectedItems.size})}
              </Text>
              <TouchableOpacity
                onPress={deleteSelectedItems}
                accessibilityRole="button"
                accessibilityLabel={t('Hide selected from continue watching')}
                hitSlop={10}
                className="rounded-full mr-2">
                <MaterialCommunityIcons
                  name="delete-outline"
                  size={25}
                  color={primary}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={recentItems}
        extraData={cardWidth}
        horizontal
        onScrollBeginDrag={onHorizontalDragStart}
        onMomentumScrollBegin={onHorizontalDragStart}
        onScrollEndDrag={onHorizontalDragEnd}
        onMomentumScrollEnd={onHorizontalDragEnd}
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.link}
        contentContainerStyle={{paddingHorizontal: 8}}
        renderItem={({item}) => {
          const presentation = getContinueWatchingPresentation(item);
          const progress = presentation.progressPercent;
          const isSelected = selectedItems.has(item.link);
          const displayTitle = item.displayTitle || item.title;
          const episodeLabel = getEpisodeLabel({
            episodeTitle: presentation.target
              ? presentation.target.title
              : item.episodeTitle,
            episodeNumber: presentation.target
              ? presentation.target.episodeNumber
              : item.episodeNumber,
            seasonNumber: presentation.target
              ? presentation.target.seasonNumber
              : item.seasonNumber,
          });
          const showItaBadge = hasItaBadge(displayTitle);

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              className="mx-2"
              style={{width: cardWidth}}
              accessibilityRole="button"
              accessibilityLabel={displayTitle}
              accessibilityState={{selected: isSelected}}
              onLongPress={e => {
                e.stopPropagation();
                handleLongPress(item.link);
              }}
              onPress={e => {
                e.stopPropagation();
                handlePress(item);
              }}>
              <View className="relative">
                {/* Poster Image */}
                <Image
                  source={{uri: item?.poster}}
                  style={{
                    width: cardWidth,
                    height: cardWidth * 1.5,
                    backgroundColor: '#23252B',
                  }}
                />
                {showItaBadge ? (
                  <View
                    className="absolute top-2 left-2 rounded-full px-2 py-0.5"
                    style={{backgroundColor: primary}}>
                    <Text className="text-black text-[10px] font-semibold">
                      {t('ITA')}
                    </Text>
                  </View>
                ) : null}
                {episodeLabel ? (
                  <View
                    className={`absolute top-2 ${
                      showItaBadge ? 'right-2' : 'left-2'
                    } rounded-full px-2 py-0.5`}
                    style={{backgroundColor: primary}}>
                    <Text className="text-black text-[10px] font-semibold">
                      {episodeLabel}
                    </Text>
                  </View>
                ) : null}
                {presentation.hasNewEpisodes ? (
                  <View
                    className="absolute bottom-3 left-1 rounded px-1 py-0.5"
                    style={{backgroundColor: primary}}>
                    <Text className="text-black text-[9px] font-semibold">
                      {t('New episodes')}
                    </Text>
                  </View>
                ) : null}

                {/* Selection Indicator */}
                {selectionMode && (
                  <View className="absolute top-2 right-2 z-50">
                    <View
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        isSelected ? '' : 'bg-white/30'
                      }`}
                      style={{
                        borderWidth: 1,
                        borderColor: 'white',
                        backgroundColor: isSelected ? primary : undefined,
                      }}>
                      {isSelected && (
                        <AntDesign name="check" size={12} color="white" />
                      )}
                    </View>
                  </View>
                )}

                {/* Selection Overlay */}
                {isSelected && (
                  <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/30" />
                )}

                {/* Progress Bar */}
                <View
                  className="absolute bottom-0 left-0 right-0 h-1"
                  style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${progress}%`,
                      backgroundColor: primary,
                    }}
                  />
                </View>
              </View>
              <Text
                style={{
                  color: 'white',
                  fontSize: 14,
                  fontFamily: HOME_FONT.regular,
                  lineHeight: 19,
                  marginTop: 8,
                  minHeight: 38,
                }}
                numberOfLines={2}>
                {displayTitle}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </Pressable>
  );
};

export default ContinueWatching;
