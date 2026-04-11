import React from 'react';
import {View} from 'react-native';
import {GeckoWebViewProps} from './GeckoWebView.types';

export type {
  GeckoWebViewProps,
  GeckoLoadingStartEvent,
  GeckoLoadingFinishEvent,
  GeckoLoadingErrorEvent,
  GeckoExternalOpenEvent,
  GeckoBridgeMessageEvent,
} from './GeckoWebView.types';

export default function GeckoWebView(_props: GeckoWebViewProps) {
  return <View />;
}
