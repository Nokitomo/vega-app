import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {Linking, Switch, Platform} from 'react-native';
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import Browser from '../src/screens/WebView';
let mockEnabled = true;
const mockGeckoSetting = jest.fn(),
  mockAdBlockSetting = jest.fn();
jest.mock('../src/lib/config/features', () => ({
  get USER_WEBVIEW_ENABLED() {
    return mockEnabled;
  },
}));
jest.mock('../src/components/GeckoWebView', () => ({
  __esModule: true,
  default: 'Gecko',
}));
jest.mock('react-native-webview', () => ({WebView: 'Legacy'}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({top: 24, bottom: 24, left: 0, right: 0}),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('../src/lib/zustand/themeStore', () => ({
  __esModule: true,
  default: (select: any) => select({primary: '#ff640a'}),
}));
jest.mock('../src/lib/storage', () => ({
  settingsStorage: {
    isAndroidGeckoAdGuardEnabled: () => true,
    isAndroidGeckoWebViewEnabled: () => true,
    setAndroidGeckoWebViewEnabled: (v: boolean) => mockGeckoSetting(v),
    setAndroidGeckoAdGuardEnabled: (v: boolean) => mockAdBlockSetting(v),
  },
}));
jest.mock('@react-navigation/native', () => ({useFocusEffect: () => {}}));
jest.mock('expo-navigation-bar', () => ({
  setVisibilityAsync: () => Promise.resolve(),
}));
jest.mock('react-native-orientation-locker', () => ({
  __esModule: true,
  default: {lockToLandscape: jest.fn(), unlockAllOrientations: jest.fn()},
}));
jest.mock('../src/lib/utils/vegaOrientation', () => ({
  applyAndroidUserOrientation: () => true,
}));
const route = {params: {link: 'https://example.invalid/page'}} as any;
describe('Browser presentation preserves navigation', () => {
  beforeEach(() => {
    Platform.OS = 'android';
    mockEnabled = true;
    jest.clearAllMocks();
  });
  it('preserves external open, close, adblock controls, fullscreen and fallback', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const back = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <Browser route={route} navigation={{goBack: back} as any} />,
      );
    });
    await act(async () =>
      tree.root.findByProps({name: 'open-in-browser'}).props.onPress(),
    );
    expect(open).toHaveBeenCalledWith(route.params.link);
    await act(async () =>
      tree.root.findByProps({name: 'gpp-good'}).props.onPress(),
    );
    await act(async () =>
      tree.root.findByType(Switch).props.onValueChange(false),
    );
    expect(mockAdBlockSetting).toHaveBeenCalledWith(false);
    const gecko = tree.root.findByType('Gecko' as any);
    expect(gecko.props.adBlockEnabled).toBe(false);
    await act(async () =>
      gecko.props.onFullScreenChange({nativeEvent: {fullScreen: true}}),
    );
    expect(tree.root.findAllByProps({name: 'close'})).toHaveLength(0);
    await act(async () =>
      gecko.props.onFullScreenChange({nativeEvent: {fullScreen: false}}),
    );
    await act(async () =>
      gecko.props.onLoadingError({nativeEvent: {fatal: false}}),
    );
    expect(mockGeckoSetting).not.toHaveBeenCalled();
    await act(async () =>
      gecko.props.onLoadingError({nativeEvent: {fatal: true}}),
    );
    expect(mockGeckoSetting).toHaveBeenCalledWith(false);
    const legacy = tree.root.findByType('Legacy' as any);
    expect(legacy.props.source).toEqual({uri: route.params.link});
    expect(legacy.props.sharedCookiesEnabled).toBe(true);
    await act(async () =>
      tree.root.findByProps({name: 'close'}).props.onPress(),
    );
    expect(back).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });
  it('retains external browser behavior when the feature is disabled', async () => {
    mockEnabled = false;
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined),
      back = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <Browser
          route={route}
          navigation={{goBack: back, canGoBack: () => true} as any}
        />,
      );
    });
    expect(open).toHaveBeenCalledWith(route.params.link);
    expect(back).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType('Gecko' as any)).toHaveLength(0);
    expect(tree.root.findAllByType('Legacy' as any)).toHaveLength(0);
    await act(async () => tree.unmount());
  });
});
