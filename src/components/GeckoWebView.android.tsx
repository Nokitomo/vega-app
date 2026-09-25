import React from 'react';
import {requireNativeComponent, View} from 'react-native';
import {GeckoWebViewProps} from './GeckoWebView.types';
import {USER_WEBVIEW_ENABLED} from '../lib/config/features';

const NativeGeckoView = USER_WEBVIEW_ENABLED
  ? requireNativeComponent<GeckoWebViewProps>('VegaGeckoView')
  : null;

export type {
  GeckoWebViewProps,
  GeckoLoadingStartEvent,
  GeckoLoadingFinishEvent,
  GeckoLoadingErrorEvent,
  GeckoExternalOpenEvent,
  GeckoBridgeMessageEvent,
  GeckoFullScreenEvent,
  GeckoAdBlockStatusEvent,
} from './GeckoWebView.types';

export default function GeckoWebView(props: GeckoWebViewProps) {
  if (!NativeGeckoView) {
    return <View style={props.style} />;
  }

  return <NativeGeckoView {...props} />;
}
