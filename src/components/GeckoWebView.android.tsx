import React from 'react';
import {requireNativeComponent} from 'react-native';
import {GeckoWebViewProps} from './GeckoWebView.types';

const NativeGeckoView = requireNativeComponent<GeckoWebViewProps>('VegaGeckoView');

export type {
  GeckoWebViewProps,
  GeckoLoadingStartEvent,
  GeckoLoadingFinishEvent,
  GeckoLoadingErrorEvent,
  GeckoExternalOpenEvent,
  GeckoBridgeMessageEvent,
} from './GeckoWebView.types';

export default function GeckoWebView(props: GeckoWebViewProps) {
  return <NativeGeckoView {...props} />;
}
