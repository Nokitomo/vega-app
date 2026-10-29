import type {IStorageService} from './StorageService';
import {DEFAULT_PRIMARY, LEGACY_PRIMARY} from '../utils/themeColors';

// Theme used to share Zustand's content-storage key with the provider store.
// Recover missing dedicated preferences without writing or deleting that key.
export function readThemePreferences(storage: IStorageService) {
  let legacy: {primary?: unknown; isCustom?: unknown} = {};
  try {
    const parsed = JSON.parse(storage.getString('content-storage') || '{}');
    if (parsed?.state && typeof parsed.state === 'object') {legacy = parsed.state;}
  } catch { /* Dedicated preferences remain usable when legacy JSON is invalid. */ }
  const savedCustom = storage.getBool('isCustomTheme');
  const isCustom = savedCustom ?? (legacy.isCustom === true);
  const savedPrimary = storage.getString('primaryColor');
  const previous = savedPrimary || (typeof legacy.primary === 'string' ? legacy.primary : '') || DEFAULT_PRIMARY;
  const primary = !isCustom && previous.toUpperCase() === LEGACY_PRIMARY
    ? DEFAULT_PRIMARY : previous;
  if (savedPrimary !== primary) {storage.setString('primaryColor', primary);}
  if (savedCustom == null) {storage.setBool('isCustomTheme', isCustom);}
  return {primary, isCustom};
}
