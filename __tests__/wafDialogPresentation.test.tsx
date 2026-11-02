import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {Modal} from 'react-native';
import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import WafWebViewDialog from '../src/components/WafWebViewDialog';
import {useWafStore} from '../src/lib/zustand/wafStore';
const mockInject = jest.fn();
const mockReload = jest.fn();
const mockCookies = jest
  .fn<() => Promise<Record<string, string>>>()
  .mockResolvedValue({session: 'test'});
jest.mock('react-native-webview', () => {
  const R = require('react');
  return {
    WebView: R.forwardRef((props: any, ref: any) => {
      R.useImperativeHandle(ref, () => ({
        injectJavaScript: mockInject,
        reload: mockReload,
      }));
      return R.createElement('WebContent', props);
    }),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('../src/lib/zustand/themeStore', () => ({
  __esModule: true,
  default: (select: any) => select({primary: '#ff640a'}),
}));
jest.mock('../src/lib/services/cookieManager', () => ({
  getCookies: () => mockCookies(),
  buildCookieString: (cookies: any) =>
    Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; '),
  pickUserAgent: () => 'test-agent',
}));
const pressText = (tree: renderer.ReactTestRenderer, label: string) => {
  let node = tree.root.findAll(n => n.props.children === label)[0];
  while (node && typeof node.props.onPress !== 'function') {node = node.parent!;}
  node.props.onPress();
};
describe('WAF dialog preserves resolution lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useWafStore.setState({requests: []});
    mockCookies.mockResolvedValue({session: 'test'});
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  it('reloads and resolves once with HTML, cookies, URL and user agent', async () => {
    const resolve = jest.fn(),
      reject = jest.fn();
    useWafStore
      .getState()
      .enqueue({url: 'https://example.invalid', resolve, reject});
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<WafWebViewDialog />);
    });
    await act(async () => pressText(tree, 'Reload'));
    expect(mockReload).toHaveBeenCalledTimes(1);
    const web = tree.root.findByType('WebContent' as any);
    expect(web.props.sharedCookiesEnabled).toBe(true);
    expect(web.props.thirdPartyCookiesEnabled).toBe(true);
    await act(async () => pressText(tree, 'Done'));
    expect(mockInject).toHaveBeenCalled();
    await act(async () =>
      web.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            __vegaWaf: true,
            html: '<html>OK</html>',
            url: 'https://example.invalid/ready',
          }),
        },
      }),
    );
    expect(resolve).toHaveBeenCalledWith({
      data: '<html>OK</html>',
      cookies: 'session=test',
      cookieMap: {session: 'test'},
      url: 'https://example.invalid/ready',
      userAgent: 'test-agent',
    });
    await act(async () => jest.advanceTimersByTime(1500));
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(reject).not.toHaveBeenCalled();
    expect(useWafStore.getState().requests).toHaveLength(0);
    await act(async () => tree.unmount());
  });
  it('cancels only the active request and retains queued requests', async () => {
    const reject = jest.fn();
    useWafStore
      .getState()
      .enqueue({url: 'https://example.invalid/1', resolve: jest.fn(), reject});
    useWafStore.getState().enqueue({
      url: 'https://example.invalid/2',
      resolve: jest.fn(),
      reject: jest.fn(),
    });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<WafWebViewDialog />);
    });
    await act(async () => tree.root.findByType(Modal).props.onRequestClose());
    expect(reject).toHaveBeenCalledWith(new Error('WAF_DIALOG_CANCELLED'));
    expect(useWafStore.getState().requests.map(r => r.url)).toEqual([
      'https://example.invalid/2',
    ]);
    await act(async () => tree.unmount());
  });
  it('preserves timeout cancellation and cookie-triggered completion', async () => {
    const reject = jest.fn();
    useWafStore.getState().enqueue({
      url: 'https://example.invalid',
      timeoutMs: 2000,
      resolve: jest.fn(),
      reject,
    });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<WafWebViewDialog />);
    });
    await act(async () => jest.advanceTimersByTime(2000));
    expect(reject).toHaveBeenCalledTimes(1);
    const resolve = jest.fn();
    await act(async () => {
      useWafStore.getState().enqueue({
        url: 'https://example.invalid',
        waitForCookie: 'session',
        resolve,
        reject: jest.fn(),
      });
    });
    await act(async () => jest.advanceTimersByTime(1200));
    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({cookies: 'session=test'}),
    );
    await act(async () => tree.unmount());
  });
});
