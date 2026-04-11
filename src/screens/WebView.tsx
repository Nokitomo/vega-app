import {
  View,
  Text,
  SafeAreaView,
  Linking,
  Platform,
  NativeSyntheticEvent,
  StatusBar,
  AppState,
  Switch,
  Pressable,
} from 'react-native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {WebView as LegacyWebView} from 'react-native-webview';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList} from '../App';
import {MaterialIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import GeckoWebView, {
  GeckoAdBlockStatusEvent,
  GeckoFullScreenEvent,
  GeckoLoadingErrorEvent,
} from '../components/GeckoWebView';
import {settingsStorage} from '../lib/storage';
import * as NavigationBar from 'expo-navigation-bar';
import Orientation from 'react-native-orientation-locker';
import {applyAndroidUserOrientation} from '../lib/utils/vegaOrientation';
import {useFocusEffect} from '@react-navigation/native';

type Props = NativeStackScreenProps<HomeStackParamList, 'Webview'>;

const Webview = ({route, navigation}: Props) => {
  const {t} = useTranslation();
  const [forceLegacyWebView, setForceLegacyWebView] = useState(false);
  const [isWebContentFullscreen, setIsWebContentFullscreen] = useState(false);
  const [showAdBlockPanel, setShowAdBlockPanel] = useState(false);
  const [adBlockEnabled, setAdBlockEnabled] = useState(
    settingsStorage.isAndroidGeckoAdGuardEnabled(),
  );
  const [adBlockRetryToken, setAdBlockRetryToken] = useState(0);
  const [adBlockStatus, setAdBlockStatus] = useState<{
    enabled: boolean;
    installed: boolean;
    installing: boolean;
    error?: string;
  }>({
    enabled: settingsStorage.isAndroidGeckoAdGuardEnabled(),
    installed: false,
    installing: false,
  });
  const reapplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleAdBlockStatusChange = (
    event: NativeSyntheticEvent<GeckoAdBlockStatusEvent>,
  ) => {
    const nativeEvent = event.nativeEvent;
    console.log('[WebView][AdBlock] native status', nativeEvent);
    setAdBlockStatus(prev => ({
      enabled:
        typeof nativeEvent.enabled === 'boolean'
          ? nativeEvent.enabled
          : prev.enabled,
      installed:
        typeof nativeEvent.installed === 'boolean'
          ? nativeEvent.installed
          : prev.installed,
      installing:
        typeof nativeEvent.installing === 'boolean'
          ? nativeEvent.installing
          : prev.installing,
      error: nativeEvent.error || undefined,
    }));
  };

  useEffect(() => {
    if (!canUseGecko && isWebContentFullscreen) {
      setIsWebContentFullscreen(false);
    }
  }, [canUseGecko, isWebContentFullscreen]);

  useEffect(() => {
    if (!canUseGecko) {
      setShowAdBlockPanel(false);
    }
  }, [canUseGecko]);

  const handleToggleAdBlock = (value: boolean) => {
    console.log('[WebView][AdBlock] toggle', value);
    setAdBlockEnabled(value);
    settingsStorage.setAndroidGeckoAdGuardEnabled(value);
    setAdBlockStatus(prev => ({
      ...prev,
      enabled: value,
      installing: value,
      error: undefined,
    }));
  };

  const handleRetryAdBlock = () => {
    console.log('[WebView][AdBlock] manual retry');
    setAdBlockRetryToken(prev => prev + 1);
    setAdBlockStatus(prev => ({
      ...prev,
      installing: true,
      error: undefined,
    }));
  };

  const clearReapplyTimer = useCallback(() => {
    if (reapplyTimerRef.current) {
      clearTimeout(reapplyTimerRef.current);
      reapplyTimerRef.current = null;
    }
  }, []);

  const applySystemUiForFullscreenState = useCallback(
    async (fullScreen: boolean) => {
      if (Platform.OS !== 'android') {
        return;
      }

      try {
        await NavigationBar.setVisibilityAsync(fullScreen ? 'hidden' : 'visible');
      } catch {}

      StatusBar.setHidden(fullScreen, 'slide');

      if (fullScreen) {
        Orientation.lockToLandscape();
      } else {
        const applied = applyAndroidUserOrientation();
        if (!applied) {
          Orientation.unlockAllOrientations();
        }
      }
    },
    [],
  );

  const reapplyImmersiveIfNeeded = useCallback(() => {
    if (Platform.OS !== 'android' || !isWebContentFullscreen) {
      return;
    }

    clearReapplyTimer();
    applySystemUiForFullscreenState(true);
    reapplyTimerRef.current = setTimeout(() => {
      applySystemUiForFullscreenState(true);
      reapplyTimerRef.current = null;
    }, 120);
  }, [
    applySystemUiForFullscreenState,
    clearReapplyTimer,
    isWebContentFullscreen,
  ]);

  useEffect(() => {
    applySystemUiForFullscreenState(isWebContentFullscreen);
  }, [applySystemUiForFullscreenState, isWebContentFullscreen]);

  useFocusEffect(
    useCallback(() => {
      reapplyImmersiveIfNeeded();
      return () => {
        clearReapplyTimer();
      };
    }, [clearReapplyTimer, reapplyImmersiveIfNeeded]),
  );

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState === 'active') {
          reapplyImmersiveIfNeeded();
        }
      },
    );

    return () => {
      appStateSubscription.remove();
    };
  }, [reapplyImmersiveIfNeeded]);

  useEffect(() => {
    return () => {
      if (Platform.OS !== 'android') {
        return;
      }

      clearReapplyTimer();
      StatusBar.setHidden(false, 'slide');
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
      const applied = applyAndroidUserOrientation();
      if (!applied) {
        Orientation.unlockAllOrientations();
      }
    };
  }, [clearReapplyTimer]);

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
            {canUseGecko && (
              <MaterialIcons
                name={adBlockEnabled ? 'gpp-good' : 'gpp-bad'}
                size={24}
                color={adBlockEnabled ? '#4ADE80' : '#9CA3AF'}
                onPress={() => {
                  setShowAdBlockPanel(prev => !prev);
                }}
              />
            )}
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
      {canUseGecko && showAdBlockPanel && !isWebContentFullscreen && (
        <View
          style={{
            position: 'absolute',
            right: 12,
            top: 84,
            zIndex: 30,
            width: 260,
            borderRadius: 12,
            backgroundColor: '#111827',
            borderColor: '#374151',
            borderWidth: 1,
            padding: 12,
            gap: 10,
          }}>
          <Text style={{color: '#F9FAFB', fontSize: 16, fontWeight: '700'}}>
            {t('AdBlock Settings')}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <Text style={{color: '#E5E7EB'}}>{t('AdBlock Enabled')}</Text>
            <Switch value={adBlockEnabled} onValueChange={handleToggleAdBlock} />
          </View>
          <Text style={{color: '#D1D5DB', fontSize: 12}}>
            {adBlockStatus.installing
              ? t('AdBlock Installing')
              : adBlockEnabled && adBlockStatus.installed
                ? t('AdBlock Active')
                : adBlockStatus.error
                  ? t('AdBlock Error')
                  : t('AdBlock Disabled')}
          </Text>
          {Boolean(adBlockStatus.error) && (
            <Text style={{color: '#FCA5A5', fontSize: 12}}>
              {adBlockStatus.error}
            </Text>
          )}
          <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: 10}}>
            <Pressable
              onPress={handleRetryAdBlock}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: '#1F2937',
              }}>
              <Text style={{color: '#F9FAFB', fontSize: 12}}>
                {t('Retry install')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowAdBlockPanel(false)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: '#374151',
              }}>
              <Text style={{color: '#F9FAFB', fontSize: 12}}>{t('Close')}</Text>
            </Pressable>
          </View>
        </View>
      )}
      {canUseGecko ? (
        <GeckoWebView
          style={{flex: 1}}
          url={route.params.link}
          javaScriptEnabled={true}
          adBlockEnabled={adBlockEnabled}
          adBlockRetryToken={adBlockRetryToken}
          onLoadingError={handleGeckoError}
          onFullScreenChange={handleGeckoFullScreenChange}
          onAdBlockStatusChange={handleAdBlockStatusChange}
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
