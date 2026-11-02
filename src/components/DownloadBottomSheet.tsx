import {
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  useWindowDimensions,
  ToastAndroid,
  View,
} from 'react-native';
import React, {useEffect, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {Stream} from '../lib/providers/types';
import BottomSheet, {BottomSheetScrollView} from '@gorhom/bottom-sheet';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import SkeletonLoader from './Skeleton';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {setClipboardString} from '../lib/utils/clipboard';
import useThemeStore from '../lib/zustand/themeStore';
import {TextTrackType} from 'react-native-video';
import {settingsStorage} from '../lib/storage';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HOME_FONT} from './homePresentation';

type Props = {
  data: Stream[];
  loading: boolean;
  title: string;
  showModal: boolean;
  setModal: (value: boolean) => void;
  onPressVideo: (item: any) => void;
  onPressSubs: (item: any) => void;
  error?: string | null;
};
const DownloadBottomSheet = ({
  data,
  loading,
  showModal,
  setModal,
  title,
  onPressSubs,
  onPressVideo,
  error,
}: Props) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const [activeTab, setActiveTab] = React.useState<1 | 2>(1);

  const {width, height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelMargin = Math.max(0, (width - 640) / 2);
  const expandedHeight = Math.min(450, height - insets.top - 16);

  const subtitle = data.map(server => {
    if (server.subtitles && server.subtitles.length > 0) {
      return server.subtitles;
    }
  });
  useEffect(() => {
    if (showModal) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [showModal]);
  return (
    <Modal
      onRequestClose={() => {
        bottomSheetRef.current?.close();
      }}
      visible={showModal}
      transparent={true}>
      <GestureHandlerRootView style={{flex: 1}}>
        <Pressable
          onPress={() => bottomSheetRef.current?.close()}
          className="flex-1"
          style={{backgroundColor: 'rgba(0,0,0,0.65)'}}>
          <BottomSheet
            enablePanDownToClose={true}
            snapPoints={[
              Math.min(height * 0.3, expandedHeight * 0.6),
              expandedHeight,
            ]}
            containerStyle={{marginHorizontal: panelMargin}}
            ref={bottomSheetRef}
            backgroundStyle={{backgroundColor: '#141519', borderRadius: 0}}
            handleIndicatorStyle={{backgroundColor: '#a0a0a0', width: 40}}
            onClose={() => setModal(false)}>
            <Pressable className="flex-1" onPress={e => e.stopPropagation()}>
              <Text
                numberOfLines={2}
                style={{
                  fontFamily: HOME_FONT.heading,
                  fontSize: 22,
                  color: 'white',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                }}>
                {title}
              </Text>
              <BottomSheetScrollView
                contentContainerStyle={{
                  paddingHorizontal: 20,
                  paddingBottom: Math.max(insets.bottom, 16),
                }}
                showsVerticalScrollIndicator={false}>
                {subtitle &&
                  subtitle.length > 0 &&
                  subtitle[0] !== undefined && (
                    <View className="flex-row items-center w-full mb-4 border-b border-[#23252b]">
                      <Text
                        className="flex-1 text-base py-3 text-center"
                        style={{
                          fontFamily: HOME_FONT.bold,
                          color: activeTab === 1 ? primary : 'white',
                          borderBottomWidth: activeTab === 1 ? 2 : 0,
                          borderBottomColor:
                            activeTab === 1 ? primary : 'transparent',
                        }}
                        onPress={() => setActiveTab(1)}>
                        {t('Video')}
                      </Text>
                      <Text
                        className="flex-1 text-base py-3 text-center"
                        style={{
                          fontFamily: HOME_FONT.bold,
                          color: activeTab === 2 ? primary : 'white',
                          borderBottomWidth: activeTab === 2 ? 2 : 0,
                          borderBottomColor:
                            activeTab === 2 ? primary : 'transparent',
                        }}
                        onPress={() => setActiveTab(2)}>
                        {t('Subtitle')}
                      </Text>
                    </View>
                  )}
                {loading
                  ? Array.from({length: 4}).map((_, index) => (
                      <SkeletonLoader
                        key={index}
                        width={Math.max(0, width - panelMargin * 2 - 40)}
                        height={48}
                        marginVertical={5}
                      />
                    ))
                  : activeTab === 1
                    ? data.map(item => (
                        <TouchableOpacity
                          className="px-4 py-3 min-h-12 justify-center bg-[#23252b] mb-2"
                          key={item.link}
                          onLongPress={() => {
                            if (settingsStorage.isHapticFeedbackEnabled()) {
                              RNReactNativeHapticFeedback.trigger(
                                'effectTick',
                                {
                                  enableVibrateFallback: true,
                                  ignoreAndroidSystemSettings: false,
                                },
                              );
                            }
                            setClipboardString(item.link);
                            ToastAndroid.show(
                              t('Link copied'),
                              ToastAndroid.SHORT,
                            );
                          }}
                          onPress={() => {
                            onPressVideo(item);
                            bottomSheetRef.current?.close();
                          }}>
                          <Text
                            style={{
                              color: 'white',
                              fontFamily: HOME_FONT.medium,
                              fontSize: 16,
                            }}>
                            {item.server}
                          </Text>
                        </TouchableOpacity>
                      ))
                    : subtitle.length > 0
                      ? subtitle.map(subs =>
                          subs?.map(item => (
                            <TouchableOpacity
                              className="px-4 py-3 min-h-12 justify-center bg-[#23252b] mb-2"
                              key={item.uri}
                              onLongPress={() => {
                                if (settingsStorage.isHapticFeedbackEnabled()) {
                                  RNReactNativeHapticFeedback.trigger(
                                    'effectTick',
                                    {
                                      enableVibrateFallback: true,
                                      ignoreAndroidSystemSettings: false,
                                    },
                                  );
                                }
                                setClipboardString(item.uri);
                                ToastAndroid.show(
                                  t('Link copied'),
                                  ToastAndroid.SHORT,
                                );
                              }}
                              onPress={() => {
                                onPressSubs({
                                  server: t('Subtitles'),
                                  link: item.uri,
                                  type:
                                    item.type === TextTrackType.VTT
                                      ? 'vtt'
                                      : 'srt',
                                  title: item.title,
                                });
                                bottomSheetRef.current?.close();
                              }}>
                              <Text
                                style={{
                                  color: 'white',
                                  fontFamily: HOME_FONT.medium,
                                  fontSize: 16,
                                }}>
                                {item.language}
                                {' - '} {item.title}
                              </Text>
                            </TouchableOpacity>
                          )),
                        )
                      : null}
                {data.length === 0 && !loading && (
                  <Text
                    style={{fontFamily: HOME_FONT.regular}}
                    className="text-red-400 text-base text-center py-4">
                    {error || t('No server found')}
                  </Text>
                )}
              </BottomSheetScrollView>
            </Pressable>
          </BottomSheet>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default DownloadBottomSheet;
