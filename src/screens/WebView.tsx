import {
  View,
  Text,
  SafeAreaView,
  Linking,
  Platform,
  NativeSyntheticEvent,
} from 'react-native';
import React, {useMemo, useState} from 'react';
import {WebView as LegacyWebView} from 'react-native-webview';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList} from '../App';
import {MaterialIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import GeckoWebView, {GeckoLoadingErrorEvent} from '../components/GeckoWebView';
import {settingsStorage} from '../lib/storage';

type Props = NativeStackScreenProps<HomeStackParamList, 'Webview'>;

const Webview = ({route, navigation}: Props) => {
  const {t} = useTranslation();
  const [forceLegacyWebView, setForceLegacyWebView] = useState(false);

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
    setForceLegacyWebView(true);
  };

  return (
    <SafeAreaView className="bg-black w-full h-full">
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
      {canUseGecko ? (
        <GeckoWebView
          style={{flex: 1}}
          url={route.params.link}
          javaScriptEnabled={true}
          onLoadingError={handleGeckoError}
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
