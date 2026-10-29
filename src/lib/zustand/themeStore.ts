import {create} from 'zustand';
import {settingsStorage} from '../storage/SettingsStorage';

export interface Theme {
  primary: string;
  isCustom: boolean;
  setPrimary: (primary: string) => void;
  setCustom: (isCustom: boolean) => void;
}

// SettingsStorage is the sole persistence owner, separate from provider state.
const useThemeStore = create<Theme>(set => ({
  primary: settingsStorage.getPrimaryColor(),
  isCustom: settingsStorage.isCustomTheme(),
  setPrimary: primary => {
    settingsStorage.setPrimaryColor(primary);
    set({primary});
  },
  setCustom: isCustom => {
    settingsStorage.setCustomTheme(isCustom);
    set({isCustom});
  },
}));

export default useThemeStore;
