import {describe, expect, it} from '@jest/globals';
import {hasHomeBottomBar} from '../src/lib/utils/homeNavigationBar';

const tabs = (tab = 'HomeStack', screen = 'Home') => ({index: 0, routes: [
  {name: 'TabStack', state: {index: 0, routes: [
    {name: tab, state: {index: 0, routes: [{name: screen}]}},
  ]}},
]});
describe('Android Home inset route selection', () => {
  it('matches Home and details with the Home navbar', () => {
    expect(hasHomeBottomBar(tabs())).toBe(true);
    expect(hasHomeBottomBar(tabs('HomeStack', 'Info'))).toBe(true);
  });
  it('does not color fullscreen, webview or other tabs', () => {
    expect(hasHomeBottomBar({...tabs(), index: 1, routes: [...tabs().routes, {name: 'Player'}]})).toBe(false);
    expect(hasHomeBottomBar(tabs('HomeStack', 'Webview'))).toBe(false);
    expect(hasHomeBottomBar(tabs('SearchStack', 'Search'))).toBe(false);
    expect(hasHomeBottomBar(tabs('SettingsStack', 'Settings'))).toBe(false);
  });
  it('handles navigation initialization', () => {
    expect(hasHomeBottomBar()).toBe(false);
    expect(hasHomeBottomBar({routes: [{name: 'TabStack'}]})).toBe(true);
  });
});
