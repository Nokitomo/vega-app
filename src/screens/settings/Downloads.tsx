import {View, Text, Image, Platform, TouchableOpacity} from 'react-native';
import requestStoragePermission from '../../lib/file/getStoragePermission';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import React, {useCallback, useState, useEffect} from 'react';
import {settingsStorage, downloadsStorage} from '../../lib/storage';
import useThemeStore from '../../lib/zustand/themeStore';
import * as RNFS from '@dr.pogodin/react-native-fs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../App';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {FlashList} from '@shopify/flash-list';
import {useTranslation} from 'react-i18next';
import {hasItaBadge} from '../../lib/utils/helpers';
import {
  DownloadLocationConfig,
  getSafEntryName,
  isSafDownloadLocation,
  serializeDownloadLocation,
} from '../../lib/downloadLocation';

// Define supported video extensions
const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.wmv',
  '.flv',
  '.webm',
  '.m4v',
];

const isVideoFile = (filename: string): boolean => {
  const extension = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return VIDEO_EXTENSIONS.includes(extension);
};

// Add this interface after the existing imports
interface DownloadedFile {
  uri: string;
  exists: boolean;
  name?: string;
  isDirectory?: boolean;
  size?: number;
  modificationTime?: number;
}

interface MediaGroup {
  title: string;
  episodes: DownloadedFile[];
  thumbnail?: string;
  isMovie: boolean;
  isIta?: boolean;
}

const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[\s.-]+/g, ' ') // normalize spaces, dots, and hyphens
    .replace(/[^\w\s]/g, '') // remove special characters
    .trim();
};

const getBaseName = (fileName: string): string => {
  let baseName = fileName
    .replace(/\.(mp4|mkv|avi|mov)$/i, '') // remove extension
    .replace(/(?:480p|720p|1080p|2160p|HEVC|x264|BluRay|WEB-DL|HDRip).*$/i, '') // remove quality tags
    .replace(/\[.*?\]/g, '') // remove bracketed text
    .replace(/\(.*?\)/g, '') // remove parenthesized text
    .replace(/(?:episode|ep)[\s-]*\d+/gi, '') // remove episode indicators
    .replace(/s\d{1,2}e\d{1,2}/gi, '') // remove SxxExx format
    .replace(/season[\s-]*\d+/gi, '') // remove season indicators
    .replace(/\s*-\s*\d+/, '') // remove trailing numbers
    .replace(/\s*\d+\s*$/, '') // remove ending numbers
    .replace(/[_.]/g, ' ') // replace underscores and dots with spaces
    .trim();

  // Remove any remaining numbers at the end that might be episode numbers
  baseName = baseName.replace(/[\s.-]*\d+$/, '');

  return baseName;
};

const getEpisodeInfo = (
  fileName: string,
): {season: number; episode: number} => {
  // Try to match SxxExx format first
  let match = fileName.match(/s(\d{1,2})e(\d{1,2})/i);
  if (match) {
    return {season: parseInt(match[1], 10), episode: parseInt(match[2], 10)};
  }

  // Try to match "Season X Episode Y" format
  match = fileName.match(/season[\s.-]*(\d{1,2}).*?episode[\s.-]*(\d{1,2})/i);
  if (match) {
    return {season: parseInt(match[1], 10), episode: parseInt(match[2], 10)};
  }

  // Try to match episode number only
  match =
    fileName.match(/(?:episode|ep)[\s.-]*(\d{1,2})/i) ||
    fileName.match(/[\s.-](\d{1,2})(?:\s*$|\s*\.)/);

  if (match) {
    return {season: 1, episode: parseInt(match[1], 10)};
  }

  // Default case
  return {season: 1, episode: 0};
};

const getFileName = (file: DownloadedFile): string => {
  if (file.name) {
    return file.name;
  }

  return decodeURIComponent(file.uri.split('/').pop() || '');
};

const normalizeDownloadedFile = (
  fileInfo: FileSystem.FileInfo,
  name?: string,
): DownloadedFile | null => {
  if (!fileInfo.uri || !fileInfo.exists) {
    return null;
  }

  return {
    uri: fileInfo.uri,
    exists: fileInfo.exists,
    name,
    isDirectory: 'isDirectory' in fileInfo ? fileInfo.isDirectory : undefined,
    size: 'size' in fileInfo ? (fileInfo as any).size : undefined,
    modificationTime:
      'modificationTime' in fileInfo
        ? (fileInfo as any).modificationTime
        : undefined,
  };
};

const loadFilesFromPathLocation = async (
  downloadLocation: Extract<DownloadLocationConfig, {type: 'path'}>,
): Promise<DownloadedFile[]> => {
  const properPath =
    Platform.OS === 'android'
      ? `file://${downloadLocation.path}`
      : downloadLocation.path;

  const allFiles = await FileSystem.readDirectoryAsync(properPath);
  const videoFiles = allFiles.filter(file => isVideoFile(file));

  const filesInfo = await Promise.all(
    videoFiles.map(async file => {
      const filePath =
        Platform.OS === 'android'
          ? `file://${downloadLocation.path}/${file}`
          : `${downloadLocation.path}/${file}`;

      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return normalizeDownloadedFile(fileInfo, file);
    }),
  );

  return filesInfo.filter((file): file is DownloadedFile => Boolean(file));
};

const loadFilesFromSafLocation = async (
  downloadLocation: Extract<DownloadLocationConfig, {type: 'saf'}>,
): Promise<DownloadedFile[]> => {
  const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(
    downloadLocation.uri,
  );

  const videoEntries = entries.filter(entryUri =>
    isVideoFile(getSafEntryName(entryUri)),
  );

  const filesInfo = await Promise.all(
    videoEntries.map(async entryUri => {
      const fileInfo = await FileSystem.getInfoAsync(entryUri);
      return normalizeDownloadedFile(fileInfo, getSafEntryName(entryUri));
    }),
  );

  return filesInfo.filter((file): file is DownloadedFile => Boolean(file));
};

const Downloads = () => {
  const [files, setFiles] = useState<DownloadedFile[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const {primary} = useThemeStore(state => state);

  const [groupSelected, setGroupSelected] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {t} = useTranslation();

  const loadData = useCallback(async () => {
    const downloadLocation = settingsStorage.getDownloadLocationConfig();
    const locationKey = serializeDownloadLocation(downloadLocation);
    const cachedLocation = downloadsStorage.getCacheLocation();

    setLoading(true);

    if (cachedLocation && cachedLocation !== locationKey) {
      downloadsStorage.clearCache();
      setFiles([]);
      setThumbnails({});
    }

    const cachedFiles = downloadsStorage.getFilesInfo();
    const cachedThumbnails = downloadsStorage.getThumbnails();

    if (cachedFiles && cachedFiles.length > 0) {
      const validCachedFiles = cachedFiles
        .map(file => normalizeDownloadedFile(file as FileSystem.FileInfo))
        .filter((file): file is DownloadedFile => Boolean(file));

      setFiles(validCachedFiles);
      setLoading(false);
    } else {
      setFiles([]);
    }

    setThumbnails(cachedThumbnails || {});

    const granted = await requestStoragePermission();
    if (!granted) {
      setLoading(false);
      return;
    }

    try {
      const nextFiles = isSafDownloadLocation(downloadLocation)
        ? await loadFilesFromSafLocation(downloadLocation)
        : await loadFilesFromPathLocation(downloadLocation);

      downloadsStorage.saveFilesInfo(nextFiles as any, locationKey);
      setFiles(nextFiles);
    } catch (error) {
      console.error('Error reading files:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  async function getThumbnail(file: DownloadedFile) {
    try {
      // Verify it's a video file before attempting to generate thumbnail
      const fileName = getFileName(file);
      if (!fileName || !isVideoFile(fileName)) {
        return null;
      }

      const {uri} = await VideoThumbnails.getThumbnailAsync(file.uri, {
        time: 100000,
      });
      return uri;
    } catch (error) {
      console.log('error in getThumbnail:', error);
      return null;
    }
  }

  // Generate thumbnails for files that don't have them cached
  useEffect(() => {
    const getThumbnails = async () => {
      try {
        // Only generate thumbnails for files that don't have one
        const filesToProcess = files.filter(file => !thumbnails[file.uri]);

        if (filesToProcess.length === 0) {
          return;
        }

        const thumbnailPromises = filesToProcess.map(async file => {
          const thumbnail = await getThumbnail(file);
          if (thumbnail) {
            return {[file.uri]: thumbnail};
          }
          return null;
        });

        const thumbnailResults = await Promise.all(thumbnailPromises);
        const newThumbnails = thumbnailResults.reduce<Record<string, string>>(
          (acc, curr) => {
            return curr ? {...acc, ...curr} : acc;
          },
          {},
        );

        if (Object.keys(newThumbnails).length > 0) {
          const mergedThumbnails = {...thumbnails, ...newThumbnails};
          downloadsStorage.saveThumbnails(
            mergedThumbnails,
            serializeDownloadLocation(settingsStorage.getDownloadLocationConfig()),
          );
          setThumbnails(mergedThumbnails);
        }
      } catch (error) {
        console.error('Error generating thumbnails:', error);
      }
    };

    if (files.length > 0) {
      getThumbnails();
    }
  }, [files]);

  const deleteFiles = async () => {
    try {
      // Process each file
      await Promise.all(
        groupSelected.map(async fileUri => {
          try {
            const fileInfo = await FileSystem.getInfoAsync(fileUri);
            if (fileInfo.exists) {
              if (fileUri.startsWith('content://')) {
                await FileSystem.StorageAccessFramework.deleteAsync(fileUri);
              } else {
                const path =
                  Platform.OS === 'android'
                    ? fileUri.replace('file://', '')
                    : fileUri;
                await RNFS.unlink(path);
              }
            }
          } catch (error) {
            console.error(`Error deleting file ${fileUri}:`, error);
            throw error; // Re-throw to be caught by the outer try-catch
          }
        }),
      );

      // Update state after successful deletion
      const newFiles = files.filter(file => !groupSelected.includes(file.uri));
      setFiles(newFiles);
      setGroupSelected([]);
      setIsSelecting(false);

      // Optional: Show success message
    } catch (error) {
      console.error('Error deleting files:', error);
    }
  };

  // Add this function to group files by series name
  const groupMediaFiles = React.useMemo((): MediaGroup[] => {
    const groups: Record<string, MediaGroup> = {};

    // First pass: Group by normalized base name
    files.forEach(file => {
      const fileName = getFileName(file);
      const baseName = getBaseName(fileName);
      const normalizedBaseName = normalizeString(baseName);

      if (!groups[normalizedBaseName]) {
        groups[normalizedBaseName] = {
          title: baseName,
          episodes: [],
          thumbnail: undefined,
          isMovie: true,
        };
      }
      groups[normalizedBaseName].episodes.push(file);
    });

    // Second pass: Determine if each group is a movie or series and assign thumbnails
    Object.values(groups).forEach(group => {
      const hasEpisodeIndicators = group.episodes.some(file => {
        const fileName = getFileName(file);
        return getEpisodeInfo(fileName).episode > 0;
      });

      group.isMovie = !(group.episodes.length > 1 || hasEpisodeIndicators);

      // Sort episodes by season and episode number if it's a series
      if (!group.isMovie) {
        group.episodes.sort((a, b) => {
          const aName = getFileName(a);
          const bName = getFileName(b);
          const aInfo = getEpisodeInfo(aName);
          const bInfo = getEpisodeInfo(bName);

          if (aInfo.season !== bInfo.season) {
            return aInfo.season - bInfo.season;
          }
          return aInfo.episode - bInfo.episode;
        });
      }

      // Find the first available thumbnail for the group
      for (const episode of group.episodes) {
        if (thumbnails[episode.uri]) {
          group.thumbnail = thumbnails[episode.uri];
          break;
        }
      }
      group.isIta = group.episodes.some(episode => {
        const fileName = getFileName(episode);
        return hasItaBadge(fileName);
      });
    });

    return Object.values(groups);
  }, [files, thumbnails]);

  // Helper to check if a group is selected (any episode in groupSelected)
  const isGroupSelected = (group: MediaGroup): boolean => {
    return group.episodes.some(ep => groupSelected.includes(ep.uri));
  };

  // Helper to get all episode URIs from a group
  const getGroupUris = (group: MediaGroup): string[] => {
    return group.episodes.map(ep => ep.uri);
  };

  const getGroupKey = (group: MediaGroup): string =>
    group.episodes[0]?.uri ?? normalizeString(group.title);

  const toggleGroupSelection = (group: MediaGroup) => {
    const groupUris = getGroupUris(group);
    setGroupSelected(prev => {
      const isSelected = groupUris.some(uri => prev.includes(uri));
      const next = isSelected
        ? prev.filter(uri => !groupUris.includes(uri))
        : [...prev, ...groupUris];
      setIsSelecting(next.length > 0);
      return next;
    });
  };

  return (
    <View className="mt-14 px-2 w-full h-full">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl">{t('Downloads')}</Text>
        <View className="flex-row gap-x-7 items-center">
          {isSelecting && (
            <MaterialCommunityIcons
              name="close"
              size={28}
              color={primary}
              onPress={() => {
                setGroupSelected([]);
                setIsSelecting(false);
              }}
            />
          )}
          {isSelecting && groupSelected.length > 0 && (
            <MaterialCommunityIcons
              name="delete-outline"
              size={28}
              color={primary}
              onPress={deleteFiles}
            />
          )}
        </View>
      </View>

      <FlashList
        data={groupMediaFiles}
        extraData={{isSelecting, groupSelected}}
        estimatedItemSize={100}
        keyExtractor={item => getGroupKey(item)}
        ListEmptyComponent={() =>
          !loading && (
            <View className="flex-1 justify-center items-center mt-10">
              <Text className="text-center text-lg">
                {t('Looks Empty Here!')}
              </Text>
            </View>
          )
        }
        renderItem={({item}) => (
          <TouchableOpacity
            className={`flex-row w-full p-2 mb-2 rounded-lg overflow-hidden items-center ${
              isSelecting && isGroupSelected(item)
                ? 'bg-quaternary'
                : 'bg-transparent'
            }`}
            style={{
              borderColor:
                isSelecting && isGroupSelected(item) ? primary : 'transparent',
              borderWidth: isSelecting && isGroupSelected(item) ? 1 : 0,
            }}
            onLongPress={() => {
              if (settingsStorage.isHapticFeedbackEnabled()) {
                RNReactNativeHapticFeedback.trigger('effectTick', {
                  enableVibrateFallback: true,
                  ignoreAndroidSystemSettings: false,
                });
              }
              setGroupSelected(getGroupUris(item));
              setIsSelecting(true);
            }}
            onPress={() => {
              if (isSelecting) {
                if (settingsStorage.isHapticFeedbackEnabled()) {
                  RNReactNativeHapticFeedback.trigger('effectTick', {
                    enableVibrateFallback: true,
                    ignoreAndroidSystemSettings: false,
                  });
                }
                toggleGroupSelection(item);
              } else {
                // Direct play for movies, navigate to episodes for series
                if (item.isMovie) {
                  const file = item.episodes[0];
                  const fileName = getFileName(file);
                  navigation.navigate('Player', {
                    episodeList: [{title: fileName, link: file.uri}],
                    linkIndex: 0,
                    type: '',
                    directUrl: file.uri,
                    primaryTitle: item.title,
                    poster: {},
                    providerValue: 'vega',
                    doNotTrack: true,
                  });
                } else {
                  navigation.navigate('TabStack', {
                    screen: 'SettingsStack',
                    params: {
                      screen: 'WatchHistoryStack',
                      params: {
                        screen: 'SeriesEpisodes',
                        params: {
                          episodes: item.episodes as any,
                          series: item.title,
                          thumbnails: thumbnails,
                        },
                      },
                    },
                  });
                }
              }
            }}>
            <View className="w-40 aspect-video rounded-md overflow-hidden bg-quaternary mr-3 relative">
              {item.thumbnail ? (
                <Image
                  source={{uri: item.thumbnail}}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full items-center justify-center">
                  <MaterialCommunityIcons
                    name="movie-open-outline"
                    size={32}
                    color={primary}
                  />
                </View>
              )}
              {item.isIta ? (
                <View
                  className="absolute top-2 left-2 rounded-full px-2 py-0.5"
                  style={{backgroundColor: primary}}>
                  <Text className="text-black text-[10px] font-semibold">
                    {t('ITA')}
                  </Text>
                </View>
              ) : null}
              {isSelecting && (
                <>
                  {isGroupSelected(item) && (
                    <View className="absolute inset-0 bg-black/40" />
                  )}
                  <View className="absolute top-2 right-2 bg-black/70 rounded-full p-1">
                    <MaterialCommunityIcons
                      name={
                        isGroupSelected(item)
                          ? 'check-circle'
                          : 'checkbox-blank-circle-outline'
                      }
                      size={20}
                      color={isGroupSelected(item) ? primary : 'white'}
                    />
                  </View>
                </>
              )}
            </View>

            <View className="flex-1 justify-center">
              <Text
                className="text-white font-semibold text-lg mb-1"
                numberOfLines={2}>
                {item.title}
              </Text>
              {!item.isMovie && (
                <Text className="text-gray-400 text-sm">
                  {item.episodes.length === 1
                    ? t('{{count}} episode', {count: item.episodes.length})
                    : t('{{count}} episodes', {count: item.episodes.length})}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default Downloads;
