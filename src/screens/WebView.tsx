import {
  View,
  Text,
  Linking,
  Platform,
  NativeSyntheticEvent,
  StatusBar,
  AppState,
  Switch,
  Pressable,
  useWindowDimensions,
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
import {resolveWebViewLink} from '../lib/utils/providerLinks';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {HOME_FONT} from '../components/homePresentation';
import useThemeStore from '../lib/zustand/themeStore';
import {USER_WEBVIEW_ENABLED} from '../lib/config/features';

type Props = NativeStackScreenProps<HomeStackParamList, 'Webview'>;

const Webview = ({route, navigation}: Props) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const {primary} = useThemeStore(state => state);
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
  const webViewLink = useMemo(
    () => resolveWebViewLink(route.params.link),
    [route.params.link],
  );

  useEffect(() => {
    if (USER_WEBVIEW_ENABLED) {
      return;
    }

    let cancelled = false;
    Linking.openURL(webViewLink).finally(() => {
      if (!cancelled && navigation.canGoBack()) {
        navigation.goBack();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [navigation, webViewLink]);

  const canUseGecko = useMemo(
    () =>
      USER_WEBVIEW_ENABLED &&
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
        await NavigationBar.setVisibilityAsync(
          fullScreen ? 'hidden' : 'visible',
        );
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

  if (!USER_WEBVIEW_ENABLED) {
    return (
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        className="bg-black flex-1 items-center justify-center px-6">
        <Text
          style={{fontFamily: HOME_FONT.regular}}
          className="text-white text-base text-center">
          {t('Opening in external browser')}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={isWebContentFullscreen ? [] : ['top', 'bottom', 'left', 'right']}
      className="bg-black flex-1">
      {!isWebContentFullscreen && (
        <View className="bg-black w-full h-16 flex flex-row justify-between px-4 items-center border-b border-[#23252b]">
          <Text
            style={{fontFamily: HOME_FONT.heading, fontSize: 22}}
            className="text-white flex-1"
            numberOfLines={1}>
            {t('Webview')}
          </Text>
          <View className="flex flex-row items-center gap-5">
            <MaterialIcons
              name="open-in-browser"
              style={{padding: 10}}
              size={24}
              color="white"
              onPress={() => {
                Linking.openURL(webViewLink);
              }}
            />
            {canUseGecko && (
              <MaterialIcons
                name={adBlockEnabled ? 'gpp-good' : 'gpp-bad'}
                style={{padding: 10}}
                size={24}
                color={adBlockEnabled ? '#4ADE80' : '#9CA3AF'}
                onPress={() => {
                  setShowAdBlockPanel(prev => !prev);
                }}
              />
            )}
            <MaterialIcons
              name="close"
              style={{padding: 10}}
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
            top: insets.top + 64,
            zIndex: 30,
            width: Math.min(300, width - insets.left - insets.right - 24),
            borderRadius: 0,
            backgroundColor: '#141519',
            borderColor: '#23252b',
            borderWidth: 1,
            padding: 12,
            gap: 10,
          }}>
          <Text
            style={{
              color: '#F9FAFB',
              fontSize: 16,
              fontFamily: HOME_FONT.bold,
            }}>
            {t('AdBlock Settings')}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <Text
              style={{
                color: '#E5E7EB',
                fontFamily: HOME_FONT.regular,
                flex: 1,
              }}>
              {t('AdBlock Enabled')}
            </Text>
            <Switch
              trackColor={{false: '#52525b', true: primary}}
              value={adBlockEnabled}
              onValueChange={handleToggleAdBlock}
            />
          </View>
          <Text
            style={{
              color: '#D1D5DB',
              fontSize: 14,
              fontFamily: HOME_FONT.regular,
            }}>
            {adBlockStatus.installing
              ? t('AdBlock Installing')
              : adBlockEnabled && adBlockStatus.installed
                ? t('AdBlock Active')
                : adBlockStatus.error
                  ? t('AdBlock Error')
                  : t('AdBlock Disabled')}
          </Text>
          {Boolean(adBlockStatus.error) && (
            <Text
              style={{
                color: '#FCA5A5',
                fontSize: 14,
                fontFamily: HOME_FONT.regular,
              }}>
              {adBlockStatus.error}
            </Text>
          )}
          <View
            style={{flexDirection: 'row', justifyContent: 'flex-end', gap: 10}}>
            <Pressable
              onPress={handleRetryAdBlock}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                minHeight: 44,
                justifyContent: 'center',
                backgroundColor: '#23252b',
              }}>
              <Text
                style={{
                  color: '#F9FAFB',
                  fontSize: 14,
                  fontFamily: HOME_FONT.regular,
                }}>
                {t('Retry install')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowAdBlockPanel(false)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                minHeight: 44,
                justifyContent: 'center',
                backgroundColor: '#23252b',
              }}>
              <Text
                style={{
                  color: '#F9FAFB',
                  fontSize: 14,
                  fontFamily: HOME_FONT.regular,
                }}>
                {t('Close')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
      {canUseGecko ? (
        <GeckoWebView
          style={{flex: 1}}
          url={webViewLink}
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
          javaScriptEnabled={true}
          domStorageEnabled={true}
          thirdPartyCookiesEnabled={true}
          sharedCookiesEnabled={true}
          setSupportMultipleWindows={false}
          source={{uri: webViewLink}}
        />
      )}
    </SafeAreaView>
  );
};

export default Webview;
