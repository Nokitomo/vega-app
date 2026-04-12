import {create} from 'zustand';
import {settingsStorage} from '../storage';

type UiSettingsState = {
  showTabBarLabels: boolean;
  showRecentlyWatched: boolean;
  tabletRotationEnabled: boolean;
  showHamburgerMenu: boolean;
  disableDrawer: boolean;
  setShowTabBarLabels: (value: boolean) => void;
  setShowRecentlyWatched: (value: boolean) => void;
  setTabletRotationEnabled: (value: boolean) => void;
  setShowHamburgerMenu: (value: boolean) => void;
  setDisableDrawer: (value: boolean) => void;
};

const useUiSettingsStore = create<UiSettingsState>(set => ({
  showTabBarLabels: settingsStorage.showTabBarLabels(),
  showRecentlyWatched: settingsStorage.showRecentlyWatched(),
  tabletRotationEnabled: settingsStorage.isTabletRotationEnabled(),
  showHamburgerMenu: settingsStorage.showHamburgerMenu(),
  disableDrawer: settingsStorage.getBool('disableDrawer') || false,
  setShowTabBarLabels: value => {
    settingsStorage.setShowTabBarLabels(value);
    set({showTabBarLabels: value});
  },
  setShowRecentlyWatched: value => {
    settingsStorage.setShowRecentlyWatched(value);
    set({showRecentlyWatched: value});
  },
  setTabletRotationEnabled: value => {
    settingsStorage.setTabletRotationEnabled(value);
    set({tabletRotationEnabled: value});
  },
  setShowHamburgerMenu: value => {
    settingsStorage.setShowHamburgerMenu(value);
    set({showHamburgerMenu: value});
  },
  setDisableDrawer: value => {
    settingsStorage.setBool('disableDrawer', value);
    set({disableDrawer: value});
  },
}));

export default useUiSettingsStore;
