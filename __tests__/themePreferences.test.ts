import {beforeEach, describe, expect, it} from '@jest/globals';
import {StorageService, mainStorage} from '../src/lib/storage/StorageService';
import {readThemePreferences} from '../src/lib/storage/themePreferences';
import {DEFAULT_PRIMARY, foregroundOnPrimary} from '../src/lib/utils/themeColors';
import useThemeStore from '../src/lib/zustand/themeStore';
import {settingsStorage} from '../src/lib/storage/SettingsStorage';

const storage = new StorageService('theme-test');
beforeEach(() => {storage.clearAll(); mainStorage.clearAll();});

describe('theme preference upgrade', () => {
  it('initializes new installs and upgrades only the old Vega preset', () => {
    expect(readThemePreferences(storage)).toEqual({primary: DEFAULT_PRIMARY, isCustom: false});
    storage.setString('primaryColor', '#ff6347');
    expect(readThemePreferences(storage).primary).toBe(DEFAULT_PRIMARY);
  });
  it('preserves other presets and explicitly custom old orange', () => {
    storage.setString('primaryColor', '#2196F3');
    expect(readThemePreferences(storage).primary).toBe('#2196F3');
    storage.setBool('isCustomTheme', true);
    storage.setString('primaryColor', '#FF6347');
    expect(readThemePreferences(storage)).toEqual({primary: '#FF6347', isCustom: true});
  });
  it('recovers legacy-only preferences without altering provider data', () => {
    const legacy = JSON.stringify({state: {primary: '#123456', isCustom: true, provider: {value: 'fixture'}}});
    storage.setString('content-storage', legacy);
    expect(readThemePreferences(storage)).toEqual({primary: '#123456', isCustom: true});
    expect(storage.getString('content-storage')).toBe(legacy);
    storage.setString('content-storage', JSON.stringify({state: {provider: {value: 'other'}}}));
    expect(readThemePreferences(storage)).toEqual({primary: '#123456', isCustom: true});
  });
  it('prefers dedicated settings over stale shared values and tolerates invalid legacy data', () => {
    storage.setString('content-storage', JSON.stringify({state: {primary: '#123456', isCustom: true}}));
    storage.setBool('isCustomTheme', false);
    storage.setString('primaryColor', '#FF6347');
    expect(readThemePreferences(storage)).toEqual({primary: DEFAULT_PRIMARY, isCustom: false});
    storage.setString('content-storage', 'invalid');
    expect(readThemePreferences(storage).primary).toBe(DEFAULT_PRIMARY);
  });
  it('persists live changes independently of provider selection', () => {
    const provider = JSON.stringify({state: {provider: {value: 'fixture'}}});
    mainStorage.setString('content-storage', provider);
    useThemeStore.getState().setCustom(true);
    useThemeStore.getState().setPrimary('#123456');
    expect(useThemeStore.getState().primary).toBe('#123456');
    expect(settingsStorage.getPrimaryColor()).toBe('#123456');
    expect(settingsStorage.isCustomTheme()).toBe(true);
    expect(mainStorage.getString('content-storage')).toBe(provider);
    expect(new StorageService().getString('primaryColor')).toBe('#123456');
  });
  it('keeps saved custom color separate from the Vega default', () => {
    settingsStorage.setCustomColor('#FF6347');
    expect(settingsStorage.getPrimaryColor()).toBe(DEFAULT_PRIMARY);
    expect(settingsStorage.getCustomColor()).toBe('#FF6347');
  });
});

it('keeps black labels for Vega and adapts filled controls to dark/light colors', () => {
  expect(foregroundOnPrimary(DEFAULT_PRIMARY)).toBe('black');
  expect(foregroundOnPrimary('#123456')).toBe('white');
  expect(foregroundOnPrimary('#000')).toBe('white');
  expect(foregroundOnPrimary('#fff')).toBe('black');
  expect(foregroundOnPrimary('#98FB98')).toBe('black');
});
