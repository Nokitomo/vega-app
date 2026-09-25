import Constants from 'expo-constants';

const normalizeBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return false;
};

export const USER_WEBVIEW_ENABLED = normalizeBoolean(
  Constants.expoConfig?.extra?.userWebViewEnabled,
);
