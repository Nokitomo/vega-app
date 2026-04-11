import {
  View,
  Text,
  SafeAreaView,
  Linking,
  Platform,
  NativeSyntheticEvent,
  StatusBar,
} from 'react-native';
import React, {useEffect, useMemo, useState} from 'react';
import {WebView as LegacyWebView} from 'react-native-webview';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList} from '../App';
import {MaterialIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import GeckoWebView, {
  GeckoFullScreenEvent,
  GeckoLoadingErrorEvent,
} from '../components/GeckoWebView';
import {settingsStorage} from '../lib/storage';
import * as NavigationBar from 'expo-navigation-bar';
import Orientation from 'react-native-orientation-locker';
import {applyAndroidUserOrientation} from '../lib/utils/vegaOrientation';

type Props = NativeStackScreenProps<HomeStackParamList, 'Webview'>;

const Webview = ({route, navigation}: Props) => {
  const {t} = useTranslation();
  const [forceLegacyWebView, setForceLegacyWebView] = useState(false);
  const [isWebContentFullscreen, setIsWebContentFullscreen] = useState(false);

  const canUseGecko = useMemo(
    () =>
      Platform.OS === 'android' &&
      settingsStorage.isAndroidGeckoWebViewEnabled() &&
      !forceLegacyWebView,
    [forceLegacyWebView],
  );

  const handleGeckoError = (
    event: NativeSyntheticEvent<GeckoLoadingErrorEvent>,
  ) => {
    const {nativeEvent} = event;
    if (!nativeEvent?.fatal) {
      return;
    }

    settingsStorage.setAndroidGeckoWebViewEnabled(false);
    setIsWebContentFullscreen(false);
    setForceLegacyWebView(true);
  };

  const handleGeckoFullScreenChange = (
    event: NativeSyntheticEvent<GeckoFullScreenEvent>,
  ) => {
    setIsWebContentFullscreen(Boolean(event.nativeEvent?.fullScreen));
  };

  useEffect(() => {
    if (!canUseGecko && isWebContentFullscreen) {
      setIsWebContentFullscreen(false);
    }
  }, [canUseGecko, isWebContentFullscreen]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const setSystemUi = async () => {
      try {
        await NavigationBar.setBehaviorAsync('overlay-swipe');
        await NavigationBar.setVisibilityAsync(
          isWebContentFullscreen ? 'hidden' : 'visible',
        );
      } catch {}

      StatusBar.setHidden(isWebContentFullscreen, 'slide');
    };

    setSystemUi();

    if (isWebContentFullscreen) {
      Orientation.lockToLandscape();
    } else {
      const applied = applyAndroidUserOrientation();
      if (!applied) {
        Orientation.unlockAllOrientations();
      }
    }
  }, [isWebContentFullscreen]);

  useEffect(() => {
    return () => {
      if (Platform.OS !== 'android') {
        return;
      }

      StatusBar.setHidden(false, 'slide');
      NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
      const applied = applyAndroidUserOrientation();
      if (!applied) {
        Orientation.unlockAllOrientations();
      }
    };
  }, []);

  return (
    <SafeAreaView className="bg-black w-full h-full">
      {!isWebContentFullscreen && (
        <View className="bg-black w-full mt-6 h-16 flex flex-row justify-between p-3 items-center">
          <Text className="text-white text-lg font-bold">{t('Webview')}</Text>
          <View className="flex flex-row items-center gap-5">
            <MaterialIcons
              name="open-in-browser"
              size={24}
              color="white"
              onPress={() => {
                Linking.openURL(route.params.link);
              }}
            />
            <MaterialIcons
              name="close"
              size={24}
              color="white"
              onPress={() => {
                navigation.goBack();
              }}
            />
          </View>
        </View>
      )}
      {canUseGecko ? (
        <GeckoWebView
          style={{flex: 1}}
          url={route.params.link}
          javaScriptEnabled={true}
          onLoadingError={handleGeckoError}
          onFullScreenChange={handleGeckoFullScreenChange}
        />
      ) : (
        <LegacyWebView
          style={{flex: 1}}
          javaScriptEnabled={false}
          source={{uri: route.params.link}}
        />
      )}
    </SafeAreaView>
  );
};

export default Webview;
