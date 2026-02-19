import {Clipboard as LegacyClipboard} from 'react-native';

type ClipboardApi = {
  setString: (content: string) => void;
};

const loadClipboard = (): ClipboardApi | null => {
  try {
    const module = require('@react-native-clipboard/clipboard');
    const clipboard = module?.default || module;
    if (clipboard && typeof clipboard.setString === 'function') {
      return clipboard as ClipboardApi;
    }
  } catch (_error) {
    // Native module might be missing in current binary; fallback below.
  }

  if (LegacyClipboard && typeof LegacyClipboard.setString === 'function') {
    return LegacyClipboard as ClipboardApi;
  }

  return null;
};

export const setClipboardString = (content: string): boolean => {
  const clipboard = loadClipboard();
  if (!clipboard) {
    return false;
  }
  clipboard.setString(content);
  return true;
};
