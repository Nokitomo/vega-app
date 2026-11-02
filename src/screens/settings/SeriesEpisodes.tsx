import {SafeAreaView} from 'react-native-safe-area-context';
import {settingsPresentation} from '../../components/settingsPresentation';
import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as FileSystem from 'expo-file-system/legacy';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {RootStackParamList, WatchHistoryStackParamList} from '../../App';
import {downloadsStorage, settingsStorage} from '../../lib/storage';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useThemeStore from '../../lib/zustand/themeStore';
import {useTranslation} from 'react-i18next';
import {hasItaBadge} from '../../lib/utils/helpers';

type SeriesEpisodesRouteProp = NativeStackScreenProps<
  WatchHistoryStackParamList,
  'SeriesEpisodes'
>;

const SeriesEpisodes = ({navigation, route}: SeriesEpisodesRouteProp) => {
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const {width} = useWindowDimensions();
  const thumbnailWidth = Math.min(180, Math.max(88, width * 0.34));
  const {series, episodes: initialEpisodes, thumbnails} = route.params;
  const [episodes, setEpisodes] = useState(initialEpisodes);
  const [episodeSelected, setEpisodeSelected] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);

  // Function to extract episode number from filename
  const getEpisodeNumber = (filename: string): number => {
    const match =
      filename.match(/episode[\s-]*(\d+)/i) ||
      filename.match(/episode[_\s-]*(\d+)/i) ||
      filename.match(/ep[\s-]*(\d+)/i) ||
      filename.match(/Episodes[_\s-]*(\d+)/i) ||
      filename.match(/Episode[_\s-]*(\d+)/i) ||
      filename.match(/[^a-zA-Z]E(\d+)[^a-zA-Z]/i) ||
      filename.match(/[^\d](\d+)[^\d]/);
    console.log('match', match);

    return match ? parseInt(match[1], 10) : 0;
  };

  // Sort episodes by episode number
  const sortedEpisodes = useMemo(() => {
    return [...episodes].sort((a, b) => {
      const aFilename = a.uri.split('/').pop() || '';
      const bFilename = b.uri.split('/').pop() || '';
      return getEpisodeNumber(aFilename) - getEpisodeNumber(bFilename);
    });
  }, [episodes]);

  const isEpisodeSelected = (uri: string) => episodeSelected.includes(uri);

  const toggleSelection = (uri: string) => {
    setEpisodeSelected(prev => {
      const isSelected = prev.includes(uri);
      const next = isSelected
        ? prev.filter(item => item !== uri)
        : [...prev, uri];
      setIsSelecting(next.length > 0);
      return next;
    });
  };

  const deleteEpisodes = async () => {
    try {
      await Promise.all(
        episodeSelected.map(async fileUri => {
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          if (!fileInfo.exists) {
            return;
          }
          if (fileUri.startsWith('content://')) {
            await FileSystem.StorageAccessFramework.deleteAsync(fileUri);
          } else {
            const path =
              Platform.OS === 'android'
                ? fileUri.replace('file://', '')
                : fileUri;
            await RNFS.unlink(path);
          }
        }),
      );

      const remainingEpisodes = episodes.filter(
        item => !episodeSelected.includes(item.uri),
      );
      setEpisodes(remainingEpisodes);
      setEpisodeSelected([]);
      setIsSelecting(false);

      const cachedFiles = downloadsStorage.getFilesInfo() || [];
      const filteredCached = cachedFiles.filter(
        file => file?.uri && !episodeSelected.includes(file.uri),
      );
      downloadsStorage.saveFilesInfo(filteredCached as any);

      const cachedThumbnails = downloadsStorage.getThumbnails() || {};
      const updatedThumbnails: Record<string, string> = {...cachedThumbnails};
      episodeSelected.forEach(uri => {
        delete updatedThumbnails[uri];
      });
      downloadsStorage.saveThumbnails(updatedThumbnails);

      if (remainingEpisodes.length === 0) {
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error deleting episodes:', error);
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={settingsPresentation.page}>
      <View className="flex-1 bg-black">
        {/* Simple Header */}
        <View className="bg-black px-4 py-4 border-b border-[#23252b]">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="p-2 min-h-12 min-w-12 items-center justify-center">
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="white"
              />
            </TouchableOpacity>
            <Text
              style={settingsPresentation.title}
              className="text-xl text-white font-bold ml-4 flex-1"
              numberOfLines={1}
              ellipsizeMode="tail">
              {series}
            </Text>
            <View className="flex-row items-center gap-x-4">
              {isSelecting && (
                <MaterialCommunityIcons
                  name="close"
                  size={26}
                  color={primary}
                  onPress={() => {
                    setEpisodeSelected([]);
                    setIsSelecting(false);
                  }}
                />
              )}
              {isSelecting && episodeSelected.length > 0 && (
                <MaterialCommunityIcons
                  name="delete-outline"
                  size={26}
                  color={primary}
                  onPress={deleteEpisodes}
                />
              )}
            </View>
          </View>
        </View>

        {/* Episodes list */}
        <View className="flex-1 px-4">
          <View className="flex-row items-center justify-between py-4">
            <Text
              style={settingsPresentation.bold}
              className="text-white text-lg font-bold">
              {t('Episodes')}
            </Text>
            <Text style={settingsPresentation.body} className="text-gray-400">
              {episodes.length === 1
                ? t('{{count}} episode', {count: episodes.length})
                : t('{{count}} episodes', {count: episodes.length})}
            </Text>
          </View>

          <FlashList
            data={sortedEpisodes}
            extraData={{isSelecting, episodeSelected}}
            estimatedItemSize={120}
            contentContainerStyle={{paddingBottom: 24}}
            keyExtractor={item => item.uri}
            renderItem={({item}) => {
              const fileName = item.uri.split('/').pop() || '';
              const episodeNumber = getEpisodeNumber(fileName);
              const selected = isEpisodeSelected(item.uri);
              const showItaBadge = hasItaBadge(fileName);

              return (
                <TouchableOpacity
                  className={`flex-row overflow-hidden mb-3 items-center ${
                    isSelecting && selected ? 'bg-quaternary' : 'bg-[#141519]'
                  }`}
                  style={{
                    borderColor:
                      isSelecting && selected ? primary : 'transparent',
                    borderWidth: isSelecting && selected ? 1 : 0,
                  }}
                  onPress={() => {
                    if (isSelecting) {
                      if (settingsStorage.isHapticFeedbackEnabled()) {
                        RNReactNativeHapticFeedback.trigger('effectTick', {
                          enableVibrateFallback: true,
                          ignoreAndroidSystemSettings: false,
                        });
                      }
                      toggleSelection(item.uri);
                      return;
                    }
                    rootNavigation.navigate('Player', {
                      episodeList: [{title: fileName || '', link: item.uri}],
                      linkIndex: 0,
                      type: '',
                      directUrl: item.uri,
                      primaryTitle: fileName,
                      poster: {},
                      providerValue: 'vega',
                      doNotTrack: true,
                    });
                  }}
                  onLongPress={() => {
                    if (settingsStorage.isHapticFeedbackEnabled()) {
                      RNReactNativeHapticFeedback.trigger('effectTick', {
                        enableVibrateFallback: true,
                        ignoreAndroidSystemSettings: false,
                      });
                    }
                    setIsSelecting(true);
                    setEpisodeSelected([item.uri]);
                  }}>
                  <View
                    style={{width: thumbnailWidth, aspectRatio: 16 / 9}}
                    className="relative">
                    {thumbnails[item.uri] ? (
                      <Image
                        source={{uri: thumbnails[item.uri]}}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-full h-full bg-quaternary" />
                    )}
                    {showItaBadge ? (
                      <View
                        className="absolute top-2 left-2 rounded-full px-2 py-0.5"
                        style={{backgroundColor: primary}}>
                        <Text
                          style={settingsPresentation.bold}
                          className="text-black text-[10px] font-semibold">
                          {t('ITA')}
                        </Text>
                      </View>
                    ) : null}
                    {isSelecting && (
                      <>
                        {selected && (
                          <View className="absolute inset-0 bg-black/40" />
                        )}
                        <View className="absolute top-2 right-2 bg-black/70 rounded-full p-1">
                          <MaterialCommunityIcons
                            name={
                              selected
                                ? 'check-circle'
                                : 'checkbox-blank-circle-outline'
                            }
                            size={18}
                            color={selected ? primary : 'white'}
                          />
                        </View>
                      </>
                    )}
                    <View className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded">
                      <Text
                        style={settingsPresentation.body}
                        className="text-white text-xs">
                        {t('EP {{number}}', {number: episodeNumber})}
                      </Text>
                    </View>
                  </View>
                  {isSelecting && selected && (
                    <View
                      className="absolute inset-0"
                      style={{backgroundColor: primary, opacity: 0.25}}
                    />
                  )}
                  <View className="flex-1 p-3 justify-center">
                    <Text
                      style={settingsPresentation.medium}
                      className="text-base text-white font-medium mb-1">
                      {t('Episode {{number}}', {number: episodeNumber})}
                    </Text>
                    <Text
                      style={settingsPresentation.body}
                      numberOfLines={2}
                      className="text-xs my-1 text-gray-400">
                      {fileName}
                    </Text>
                    <Text
                      style={settingsPresentation.body}
                      className="text-sm text-gray-400">
                      {(item.size / (1024 * 1024)).toFixed(1)} MB
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SeriesEpisodes;
