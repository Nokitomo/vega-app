import {describe, expect, it} from '@jest/globals';
import {hasAppBottomBar} from '../src/lib/utils/homeNavigationBar';

const tabs = (tab = 'HomeStack', screen = 'Home') => ({index: 0, routes: [
  {name: 'TabStack', state: {index: 0, routes: [
    {name: tab, state: {index: 0, routes: [{name: screen}]}},
  ]}},
]});
describe('Android app inset route selection', () => {
  it('matches Home and details with the Home navbar', () => {
    expect(hasAppBottomBar(tabs())).toBe(true);
    expect(hasAppBottomBar(tabs('HomeStack', 'Info'))).toBe(true);
  });
  it('does not color fullscreen or hidden tab bars', () => {
    expect(hasAppBottomBar({...tabs(), index: 1, routes: [...tabs().routes, {name: 'Player'}]})).toBe(false);
    expect(hasAppBottomBar(tabs('HomeStack', 'Webview'))).toBe(false);
    expect(hasAppBottomBar(tabs('SearchStack', 'Webview'))).toBe(false);
  });
  it.each(['HomeStack', 'SearchStack', 'WatchListStack', 'SettingsStack'])('colors the active %s tab', tab => {
    expect(hasAppBottomBar(tabs(tab))).toBe(true);
  });
  it('ignores an inactive fullscreen route', () => {
    expect(hasAppBottomBar({routes: [{name: 'TabStack', state: {index: 1, routes: [
      {name: 'HomeStack', state: {routes: [{name: 'Webview'}]}},
      {name: 'SettingsStack'},
    ]}}]})).toBe(true);
  });
  it('handles navigation initialization', () => {
    expect(hasAppBottomBar()).toBe(false);
    expect(hasAppBottomBar({routes: [{name: 'TabStack'}]})).toBe(true);
  });
});
