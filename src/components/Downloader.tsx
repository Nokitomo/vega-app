import React, {useEffect, useLayoutEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ToastAndroid,
} from 'react-native';
import {ifExists} from '../lib/file/ifExists';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Octicons from '@expo/vector-icons/Octicons';
import {Stream} from '../lib/providers/types';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../lib/zustand/contentStore';
import * as IntentLauncher from 'expo-intent-launcher';
import {downloadManager} from '../lib/downloader';
import {cancelHlsDownload} from '../lib/hlsDownloader2';
// import {FFmpegKit} from 'ffmpeg-kit-react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {downloadFolder} from '../lib/constants';
import useThemeStore from '../lib/zustand/themeStore';
import DownloadBottomSheet from './DownloadBottomSheet';
import {settingsStorage} from '../lib/storage';
import {providerManager} from '../lib/services/ProviderManager';
import {useTranslation} from 'react-i18next';

const DownloadComponent = ({
  link,
  fileName,
  type,
  providerValue,
  title,
}: {
  link: string;
  fileName: string;
  type: string;
  providerValue: string;
  title: string;
}) => {
  const {primary} = useThemeStore(state => state);
  const {provider} = useContentStore(state => state);
  const {t} = useTranslation();
  const effectiveProviderValue = providerValue || provider.value;
  const [alreadyDownloaded, setAlreadyDownloaded] = useState<string | boolean>(
    false,
  );
  const [deleteModal, setDeleteModal] = useState(false);
  const [downloadModal, setDownloadModal] = useState(false);
  const [longPressModal, setLongPressModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [downloadId, setDownloadId] = useState<number | null>(null);
  const [servers, setServers] = useState<Stream[]>([]);
  const [serverLoading, setServerLoading] = useState(false);
  const [downloadActive, setDownloadActive] = useState(false);

  // check if file already exists
  useLayoutEffect(() => {
    const checkIfDownloaded = async () => {
      const exists = await ifExists(fileName);
      setAlreadyDownloaded(exists);
    };
    checkIfDownloaded();
  }, [fileName]);

  // handle download deletion
  const deleteDownload = async () => {
    try {
      const fileList = await RNFS.readDir(downloadFolder);
      // Find a file with the given name (without extension)
      const foundFile = fileList.find(fileItem => {
        const nameWithoutExtension = fileItem.name
          .split('.')
          .slice(0, -1)
          .join('.');
        return nameWithoutExtension === fileName;
      });
      if (foundFile) {
        await RNFS.unlink(foundFile.path);
        setAlreadyDownloaded(false);
        setDeleteModal(false);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // choose server
  useEffect(() => {
    const controller = new AbortController();
    if (!downloadModal && !longPressModal) {
      return;
    }
    const getServer = async () => {
      setServerLoading(true);
      const streamServers = await providerManager.getStream({
        link,
        type,
        signal: controller.signal,
        providerValue: effectiveProviderValue,
      });
      const filteredServers = streamServers;
      // .filter(
      //   server =>
      //     !manifest[
      //       providerValue || provider.value
      //     ].nonDownloadableServer?.includes(server.server),
      // );
      setServerLoading(false);
      setServers(filteredServers);
    };
    getServer();

    return () => {
      controller.abort();
    };
  }, [downloadModal, longPressModal, effectiveProviderValue, link, type]);

  const downloadServers = useMemo(() => {
    if (!servers || servers.length === 0) {
      return [];
    }

    if (effectiveProviderValue !== 'animeunity') {
      return servers;
    }

    return servers.filter(server => {
      if (!server) {
        return false;
      }
      const serverName = (server.server || '').toLowerCase();
      if (server.type !== 'm3u8') {
        return true;
      }
      return serverName.includes('download');
    });
  }, [servers, effectiveProviderValue]);

  // on holdPress external downloader
  const longPressDownload = async (
    streamLink: string,
    streamType?: string,
  ) => {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: streamLink,
        type: streamType || 'video/*',
      });
    } catch (error) {
      console.log(error);
    }
  };

  const animatedStyles = useAnimatedStyle(() => ({
    opacity: withRepeat(withTiming(0.5, {duration: 500}), -1, true),
  }));

  return (
    <>
      <View className="flex-row items-center mt-1 justify-between rounded-full bg-white/30 p-1">
        {downloadActive ? (
          <Animated.View
            style={[
              {
                marginHorizontal: 4,
              },
              animatedStyles,
            ]}>
            <TouchableOpacity
              onPress={() => {
                setCancelModal(prev => !prev);
                console.log('pressed');
              }}>
              <MaterialIcons name="downloading" size={27} color={primary} />
            </TouchableOpacity>
          </Animated.View>
        ) : alreadyDownloaded ? (
          <TouchableOpacity
            onPress={() => setDeleteModal(true)}
            className="mx-1">
            <MaterialIcons name="delete-outline" size={27} color="#c1c4c9" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              if (
                settingsStorage.getBool('alwaysExternalDownloader') === true
              ) {
                setLongPressModal(true);
              } else {
                setDownloadModal(true);
              }
            }}
            onLongPress={() => {
              if (settingsStorage.isHapticFeedbackEnabled()) {
                ReactNativeHapticFeedback.trigger('effectHeavyClick', {
                  enableVibrateFallback: true,
                  ignoreAndroidSystemSettings: false,
                });
              }
              setLongPressModal(true);
            }}
            className="mx-2">
            <Octicons name="download" size={25} color="#c1c4c9" />
          </TouchableOpacity>
        )}
        {/* delete modal */}
        {
          <Modal animationType="fade" visible={deleteModal} transparent={true}>
            <View className="flex-1 bg-black/10 justify-center items-center p-4">
              <View className="bg-tertiary p-3 w-80 rounded-md justify-center items-center">
                <Text className="text-2xl font-semibold my-3 text-white">
                  {t('Confirm to delete')}
                </Text>
                <View className="flex-row items-center justify-evenly w-full my-5">
                  <TouchableOpacity
                    onPress={deleteDownload}
                    className="p-2 rounded-md m-1 px-3"
                    style={{backgroundColor: primary}}>
                    <Text className="text-white font-semibold text-base rounded-md capitalize px-1">
                      {t('Yes')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setDeleteModal(false)}
                    className="p-2 px-4 rounded-md m-1"
                    style={{backgroundColor: primary}}>
                    <Text className="text-white font-semibold text-base rounded-md capitalize px-1">
                      {t('No')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        }
        {/* download modal */}
        <DownloadBottomSheet
          setModal={setDownloadModal}
          showModal={downloadModal}
          data={servers}
          loading={serverLoading}
          title={t('Select server to download')}
          onPressVideo={(server: Stream) => {
            const serverName = (server.server || '').toLowerCase();
            if (
              effectiveProviderValue === 'animeunity' &&
              server.type === 'm3u8' &&
              !serverName.includes('download')
            ) {
              ToastAndroid.show(
                t(
                  'This server is not supported for downloads. Please use AnimeUnity Download or an external downloader.',
                ),
                ToastAndroid.LONG,
              );
              return;
            }
            downloadManager({
              title: title,
              url: server.link,
              fileName: fileName,
              fileType: server.type,
              setDownloadActive: setDownloadActive,
              setAlreadyDownloaded: setAlreadyDownloaded,
              setDownloadId: setDownloadId,
              headers: server?.headers,
              deleteDownload: deleteDownload,
            });
          }}
          onPressSubs={(sub: {link: string; type: string; title: string}) => {
            downloadManager({
              title: title + ' ' + sub.title + ' ' + t('Subtitle') + ' ',
              url: sub.link,
              fileName: fileName + '-' + sub.title,
              fileType: sub.type,
              setDownloadActive: setDownloadActive,
              setAlreadyDownloaded: () => {},
              setDownloadId: setDownloadId,
              deleteDownload: () => {},
            });
          }}
        />
        {/* long press modal */}
        <DownloadBottomSheet
          setModal={setLongPressModal}
          showModal={longPressModal}
          data={downloadServers}
          loading={serverLoading}
          title={t('Select server to open')}
          onPressVideo={(server: Stream) => {
            longPressDownload(server.link);
          }}
          onPressSubs={(sub: {link: string; type: string; title: string}) => {
            longPressDownload(sub.link, 'text/vtt');
          }}
        />
      </View>
      {cancelModal && downloadId && (
        <Pressable
          onPress={async () => {
            setCancelModal(false);
            try {
              // Check if this is an HLS download (ID >= 1000) or regular download
              if (typeof downloadId === 'number' && downloadId >= 1000) {
                // HLS download cancellation
                cancelHlsDownload(downloadId);
              } else {
                // Regular download cancellation
                RNFS.stopDownload(downloadId);
                //FFMPEGKIT CANCEL
                // FFmpegKit.cancel(downloadId);
              }
              setDownloadActive(false);

              const files = await RNFS.readDir(downloadFolder);
              // Find a file with the given name (without extension)
              const foundFile = files.find(fileItem => {
                const nameWithoutExtension = fileItem.name
                  .split('.')
                  .slice(0, -1)
                  .join('.');
                return nameWithoutExtension === fileName;
              });
              if (foundFile) {
                await RNFS.unlink(foundFile.path);
              }
            } catch (error) {
              console.log('Error cancelling download', error);
            }
          }}
          className="absolute right-12 bg-quaternary/80 bottom-3 rounded-md px-2">
          <Text className="text-lg text-white">{t('Cancel')}</Text>
        </Pressable>
      )}
    </>
  );
};

export default DownloadComponent;
