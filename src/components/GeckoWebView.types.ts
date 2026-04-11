import {NativeSyntheticEvent, StyleProp, ViewStyle} from 'react-native';

export type GeckoLoadingStartEvent = {
  uri?: string;
};

export type GeckoLoadingFinishEvent = {
  success?: boolean;
};

export type GeckoLoadingErrorEvent = {
  uri?: string;
  message?: string;
  code?: number;
  category?: number;
  fatal?: boolean;
};

export type GeckoExternalOpenEvent = {
  uri?: string;
  source?: string;
};

export type GeckoBridgeMessageEvent = {
  nativeApp?: string;
  port?: string;
  message?: string;
};

export type GeckoFullScreenEvent = {
  fullScreen?: boolean;
};

export type GeckoWebViewProps = {
  style?: StyleProp<ViewStyle>;
  url?: string;
  javaScriptEnabled?: boolean;
  onLoadingStart?: (event: NativeSyntheticEvent<GeckoLoadingStartEvent>) => void;
  onLoadingFinish?: (
    event: NativeSyntheticEvent<GeckoLoadingFinishEvent>,
  ) => void;
  onLoadingError?: (event: NativeSyntheticEvent<GeckoLoadingErrorEvent>) => void;
  onExternalOpen?: (event: NativeSyntheticEvent<GeckoExternalOpenEvent>) => void;
  onBridgeMessage?: (
    event: NativeSyntheticEvent<GeckoBridgeMessageEvent>,
  ) => void;
  onFullScreenChange?: (
    event: NativeSyntheticEvent<GeckoFullScreenEvent>,
  ) => void;
};
