import {create} from 'zustand';
import {settingsStorage} from '../storage';

type UiSettingsState = {
  showTabBarLabels: boolean;
  showRecentlyWatched: boolean;
  tabletRotationEnabled: boolean;
  setShowTabBarLabels: (value: boolean) => void;
  setShowRecentlyWatched: (value: boolean) => void;
  setTabletRotationEnabled: (value: boolean) => void;
};

const useUiSettingsStore = create<UiSettingsState>(set => ({
  showTabBarLabels: settingsStorage.showTabBarLabels(),
  showRecentlyWatched: settingsStorage.showRecentlyWatched(),
  tabletRotationEnabled: settingsStorage.isTabletRotationEnabled(),
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
}));

export default useUiSettingsStore;
