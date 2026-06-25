import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {WebView, WebViewMessageEvent} from 'react-native-webview';
import {headers as commonHeaders} from '../lib/providers/headers';
import type {OpenWebViewResult} from '../lib/providers/types';
import {
  buildCookieString,
  getCookies,
  pickUserAgent,
} from '../lib/services/cookieManager';
import {useWafStore, WafRequest} from '../lib/zustand/wafStore';
import useThemeStore from '../lib/zustand/themeStore';

const GRAB_HTML_JS =
  '(function(){try{window.ReactNativeWebView.postMessage(JSON.stringify({__vegaWaf:true,html:document.documentElement.outerHTML,url:location.href}));}catch(e){}})(); true;';

const WafWebViewDialog = () => {
  const {t} = useTranslation();
  const request = useWafStore(state => state.requests[0]);
  const remove = useWafStore(state => state.remove);
  const {primary} = useThemeStore(state => state);
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);
  const settledRef = useRef(false);
  const pendingResolveRef = useRef(false);
  const htmlRef = useRef('');
  const currentUrlRef = useRef('');
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userAgent = useMemo(
    () => pickUserAgent(request?.headers) || commonHeaders['User-Agent'],
    [request?.headers],
  );

  useEffect(() => {
    settledRef.current = false;
    pendingResolveRef.current = false;
    htmlRef.current = '';
    currentUrlRef.current = request?.url || '';
    setLoading(true);
  }, [request?.id, request?.url]);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const finalizeResolve = useCallback(
    async (activeRequest: WafRequest) => {
      clearFallbackTimer();
      try {
        const url = currentUrlRef.current || activeRequest.url;
        const cookieMap = await getCookies(url);
        const result: OpenWebViewResult = {
          data: htmlRef.current,
          cookies: buildCookieString(cookieMap),
          cookieMap,
          url,
          userAgent,
        };
        activeRequest.resolve(result);
      } catch (error) {
        activeRequest.reject(
          error instanceof Error
            ? error
            : new Error('Failed to read WebView cookies'),
        );
      } finally {
        remove(activeRequest.id);
      }
    },
    [clearFallbackTimer, remove, userAgent],
  );

  const cancel = useCallback(() => {
    if (!request || settledRef.current) {
      return;
    }

    settledRef.current = true;
    clearFallbackTimer();
    request.reject(new Error('WAF_DIALOG_CANCELLED'));
    remove(request.id);
  }, [clearFallbackTimer, remove, request]);

  const resolveWithPage = useCallback(() => {
    if (!request || settledRef.current) {
      return;
    }

    settledRef.current = true;
    pendingResolveRef.current = true;
    webViewRef.current?.injectJavaScript(GRAB_HTML_JS);

    const activeRequest = request;
    fallbackTimerRef.current = setTimeout(() => {
      if (pendingResolveRef.current) {
        pendingResolveRef.current = false;
        finalizeResolve(activeRequest);
      }
    }, 1200);
  }, [finalizeResolve, request]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        if (
          message?.__vegaWaf &&
          typeof message.html === 'string' &&
          request
        ) {
          htmlRef.current = message.html;
          if (typeof message.url === 'string' && message.url.length > 0) {
            currentUrlRef.current = message.url;
          }

          if (pendingResolveRef.current) {
            pendingResolveRef.current = false;
            finalizeResolve(request);
          }
        }
      } catch {}
    },
    [finalizeResolve, request],
  );

  useEffect(() => {
    const cookieName = request?.waitForCookie;
    const url = request?.url;
    if (!cookieName || !url) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      if (cancelled || settledRef.current) {
        return;
      }

      const cookieMap = await getCookies(currentUrlRef.current || url);
      if (cookieMap[cookieName]) {
        resolveWithPage();
      }
    };

    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [request?.id, request?.url, request?.waitForCookie, resolveWithPage]);

  useEffect(() => {
    if (!request) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        cancel();
        return true;
      },
    );

    return () => subscription.remove();
  }, [cancel, request]);

  useEffect(() => {
    if (!request?.timeoutMs) {
      return;
    }

    const timer = setTimeout(() => cancel(), request.timeoutMs);
    return () => clearTimeout(timer);
  }, [cancel, request?.timeoutMs]);

  if (!request) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      visible={true}
      transparent={true}
      onRequestClose={cancel}>
      <View className="flex-1 bg-black/70 justify-center items-center px-4 py-6">
        <View
          className="bg-tertiary overflow-hidden w-full rounded-lg"
          style={{height: '82%', maxWidth: 560}}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-1 pr-3">
              <Text className="text-white text-base font-bold" numberOfLines={1}>
                {request.title || t('Verify you are human')}
              </Text>
              <Text className="text-white/60 text-xs mt-1" numberOfLines={2}>
                {request.description ||
                  t('Complete the challenge below, then tap Done.')}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={t('Cancel')}
              className="p-2"
              hitSlop={8}
              onPress={cancel}>
              <MaterialIcons name="close" size={22} color="#c1c4c9" />
            </Pressable>
          </View>

          <View className="flex-1 bg-black">
            <WebView
              ref={webViewRef}
              source={{uri: request.url, headers: request.headers}}
              userAgent={userAgent}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              originWhitelist={['http://*', 'https://*']}
              injectedJavaScript={GRAB_HTML_JS}
              onMessage={onMessage}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => {
                setLoading(false);
                webViewRef.current?.injectJavaScript(GRAB_HTML_JS);
              }}
              onNavigationStateChange={state => {
                if (state.url) {
                  currentUrlRef.current = state.url;
                }
              }}
            />
            {loading && (
              <View
                className="items-center justify-center bg-black/30"
                style={StyleSheet.absoluteFillObject}>
                <ActivityIndicator size="large" color={primary} />
              </View>
            )}
          </View>

          <View className="flex-row items-center gap-3 px-4 py-3">
            <Pressable
              className="px-4 py-2 rounded-md bg-white/10"
              onPress={() => webViewRef.current?.reload()}>
              <Text className="text-white text-sm">{t('Reload')}</Text>
            </Pressable>
            <Pressable
              className="flex-1 px-4 py-2 rounded-md items-center"
              style={{backgroundColor: primary}}
              onPress={resolveWithPage}>
              <Text className="text-white text-sm font-semibold">
                {t('Done')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default WafWebViewDialog;
