import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  Pressable,
} from 'react-native';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import {mainStorage as MMKV} from '../lib/storage/StorageService';
import {useNavigation} from '@react-navigation/native';
import useThemeStore from '../lib/zustand/themeStore';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {TabStackParamList} from '../App';
import AntDesign from '@expo/vector-icons/AntDesign';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import useUiSettingsStore from '../lib/zustand/uiSettingsStore';
import {useTranslation} from 'react-i18next';
import {hasItaBadge} from '../lib/utils/helpers';

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
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const {history, removeItem} = useWatchHistoryStore(state => state);
  const showRecentlyWatched = useUiSettingsStore(
    state => state.showRecentlyWatched,
  );
  const [progressData, setProgressData] = useState<Record<string, number>>({});
  const [episodeMetaData, setEpisodeMetaData] = useState<
    Record<string, EpisodeMeta>
  >({});
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
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
    if (parsedSeasonNumber && parsedSeasonNumber > 0) {
      return t('SeasonBadge {{season}}-Ep. {{episode}}', {
        season: parsedSeasonNumber,
        episode: parsedEpisodeNumber,
      });
    }
    return t('Ep. {{number}}', {number: parsedEpisodeNumber});
  };

  // Filter out duplicates and get the most recent items
  const recentItems = React.useMemo(() => {
    const seen = new Set();
    const items = history
      .filter(item => {
        if (seen.has(item.link)) {
          return false;
        }
        seen.add(item.link);
        return true;
      })
      .slice(0, CONTINUE_WATCHING_LIMIT);

    return items;
  }, [history]);

  // Load progress data
  useEffect(() => {
    const loadProgressData = () => {
      const progressMap: Record<string, number> = {};
      const episodeMetaMap: Record<string, EpisodeMeta> = {};

      recentItems.forEach(item => {
        try {
          // Try to get dedicated watch history progress
          const historyKey = item.link;
          const historyProgressKey = `watch_history_progress_${historyKey}`;
          const storedProgress = MMKV.getString(historyProgressKey);

          if (storedProgress) {
            const parsed = JSON.parse(storedProgress);
            if (parsed.percentage) {
              progressMap[item.link] = Math.min(
                Math.max(parsed.percentage, 0),
                100,
              );
            } else if (parsed.currentTime && parsed.duration) {
              const percentage = (parsed.currentTime / parsed.duration) * 100;
              progressMap[item.link] = Math.min(Math.max(percentage, 0), 100);
            }

            if (parsed.episodeTitle || parsed.episodeNumber != null) {
              episodeMetaMap[item.link] = {
                episodeTitle: parsed.episodeTitle,
                episodeNumber: normalizeNumericValue(parsed.episodeNumber),
                seasonNumber: normalizeNumericValue(parsed.seasonNumber),
              };
            }
          } else if (item.currentTime && item.duration) {
            const percentage = (item.currentTime / item.duration) * 100;
            progressMap[item.link] = Math.min(Math.max(percentage, 0), 100);
          }
        } catch (e) {
          console.error('Error processing progress for item:', item.title, e);
        }
      });

      setProgressData(progressMap);
      setEpisodeMetaData(episodeMetaMap);
    };

    loadProgressData();
  }, [recentItems]);

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
      console.log('linkData', item.poster);
      // Navigate to Info screen
      navigation.navigate('HomeStack', {
        screen: 'Info',
        params: {
          link: linkData,
          provider: item.provider,
          poster: item.poster,
        },
      } as any);
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
    navigation.navigate(
      'SettingsStack',
      {
        screen: 'WatchHistoryStack',
        params: {
          screen: 'WatchHistory',
        },
      } as any,
    );
  };

  const deleteSelectedItems = () => {
    recentItems.forEach(item => {
      if (selectedItems.has(item.link)) {
        removeItem(item);
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
      <View className="flex flex-row justify-between items-center px-2 mb-3">
        <Text className="text-2xl font-semibold" style={{color: primary}}>
          {t('Continue Watching')}
        </Text>

        <View className="flex flex-row items-center">
          {!selectionMode && (
            <TouchableOpacity onPress={handleSeeAllPress} className="mr-2">
              <Text className="text-white text-sm">{t('See all')}</Text>
            </TouchableOpacity>
          )}

          {selectionMode && selectedItems.size > 0 && (
            <View className="flex flex-row items-center">
              <Text className="text-white mr-1">
                {t('{{count}} selected', {count: selectedItems.size})}
              </Text>
              <TouchableOpacity
                onPress={deleteSelectedItems}
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
        horizontal
        onScrollBeginDrag={onHorizontalDragStart}
        onMomentumScrollBegin={onHorizontalDragStart}
        onScrollEndDrag={onHorizontalDragEnd}
        onMomentumScrollEnd={onHorizontalDragEnd}
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.link}
        contentContainerStyle={{paddingHorizontal: 12}}
        renderItem={({item}) => {
          const progress = progressData[item.link] || 0;
          const isSelected = selectedItems.has(item.link);
          const episodeLabel = getEpisodeLabel({
            episodeTitle:
              episodeMetaData[item.link]?.episodeTitle || item.episodeTitle,
            episodeNumber:
              episodeMetaData[item.link]?.episodeNumber ?? item.episodeNumber,
            seasonNumber:
              episodeMetaData[item.link]?.seasonNumber ?? item.seasonNumber,
          });
          const showItaBadge = hasItaBadge(item.title);

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              className="max-w-[100px] mx-2"
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
                  className="rounded-md"
                  style={{width: 100, height: 150}}
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
                  <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/30 rounded-lg" />
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
                className="text-white text-center truncate w-24 text-xs"
                numberOfLines={2}>
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </Pressable>
  );
};

export default ContinueWatching;
