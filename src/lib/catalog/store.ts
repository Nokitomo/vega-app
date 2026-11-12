import {create} from 'zustand';
import {settingsStorage} from '../storage/SettingsStorage';
import {readCatalogPreferences} from './preferences';
import type {
  CatalogPreferences,
  InstalledCatalog,
  TransferState,
} from './types';

function installed(): InstalledCatalog | null {
  try {
    const value = JSON.parse(settingsStorage.getInstalledCatalog() || 'null');
    return value &&
      /^[a-f0-9]{64}$/.test(value.revision) &&
      /^catalog-[a-f0-9-]+\.sqlite$/.test(value.file) &&
      Number.isSafeInteger(value.bytes) &&
      value.bytes > 0
      ? value
      : null;
  } catch {
    return null;
  }
}
export const useCatalogStore = create<{
  preferences: CatalogPreferences;
  installed: InstalledCatalog | null;
  generation: number;
  transfer: TransferState;
  setPreferences: (p: CatalogPreferences) => void;
  setInstalled: (value: InstalledCatalog | null) => void;
  setTransfer: (value: TransferState) => void;
}>(set => ({
  preferences: readCatalogPreferences(settingsStorage.getCatalogPreferences()),
  installed: installed(),
  generation: 0,
  transfer: {status: 'idle', bytes: 0, total: 0},
  setPreferences: value => {
    const p = readCatalogPreferences(JSON.stringify(value));
    settingsStorage.setCatalogPreferences(JSON.stringify(p));
    set(s => ({preferences: p, generation: s.generation + 1}));
  },
  setInstalled: value => {
    settingsStorage.setInstalledCatalog(JSON.stringify(value));
    set(s => ({installed: value, generation: s.generation + 1}));
  },
  setTransfer: transfer => set({transfer}),
}));
