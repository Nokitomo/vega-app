import {mainStorage} from './StorageService';

/**
 * Storage keys for settings
 */
export enum SettingsKeys {
  // UI preferences
  PRIMARY_COLOR = 'primaryColor',
  IS_CUSTOM_THEME = 'isCustomTheme',
  SHOW_TAB_BAR_LABELS = 'showTabBarLabels',
  SHOW_RECENTLY_WATCHED = 'showRecentlyWatched',
  CUSTOM_COLOR = 'customColor',
  APP_LANGUAGE = 'appLanguage',
  ALLOW_TABLET_ROTATION = 'allowTabletRotation',
  // Feedback settings
  HAPTIC_FEEDBACK = 'hapticFeedback',
  NOTIFICATIONS_ENABLED = 'notificationsEnabled',

  // Update settings
  AUTO_CHECK_UPDATE = 'autoCheckUpdate',
  AUTO_DOWNLOAD = 'autoDownload',
  PENDING_UPDATE_APK_NAME = 'pendingUpdateApkName',
  PENDING_UPDATE_SOURCE_VERSION = 'pendingUpdateSourceVersion',

  // Player settings
  SHOW_MEDIA_CONTROLS = 'showMediaControls',
  SHOW_HAMBURGER_MENU = 'showHamburgerMenu',
  HIDE_SEEK_BUTTONS = 'hideSeekButtons',
  ENABLE_2X_GESTURE = 'enable2xGesture',
  ENABLE_SWIPE_GESTURE = 'enableSwipeGesture',

  // Quality settings
  EXCLUDED_QUALITIES = 'excludedQualities',

  // Subtitle settings
  SUBTITLE_FONT_SIZE = 'subtitleFontSize',
  SUBTITLE_OPACITY = 'subtitleOpacity',
  SUBTITLE_BOTTOM_PADDING = 'subtitleBottomPadding',
  CAST_PROVIDER = 'castProvider',

  LIST_VIEW_TYPE = 'viewType',

  // Telemetry (privacy)
  TELEMETRY_OPT_IN = 'telemetryOptIn',

  // Runtime feature flags
  ANDROID_GECKO_WEBVIEW_ENABLED = 'androidGeckoWebViewEnabled',
  ANDROID_GECKO_ADGUARD_ENABLED = 'androidGeckoAdGuardEnabled',
}

/**
 * Settings storage manager
 */
export class SettingsStorage {
  private getBoolWithDefault(key: SettingsKeys | string, defaultValue: boolean): boolean {
    const storedValue = mainStorage.getBool(key);
    return storedValue == null ? defaultValue : storedValue;
  }

  // Theme settings
  getPrimaryColor(): string {
    return mainStorage.getString(SettingsKeys.PRIMARY_COLOR) || '#FF6347';
  }

  setPrimaryColor(color: string): void {
    mainStorage.setString(SettingsKeys.PRIMARY_COLOR, color);
  }

  isCustomTheme(): boolean {
    return this.getBoolWithDefault(SettingsKeys.IS_CUSTOM_THEME, false);
  }

  setCustomTheme(isCustom: boolean): void {
    mainStorage.setBool(SettingsKeys.IS_CUSTOM_THEME, isCustom);
  }

  getCustomColor(): string {
    return mainStorage.getString(SettingsKeys.CUSTOM_COLOR) || '#FF6347';
  }

  setCustomColor(color: string): void {
    mainStorage.setString(SettingsKeys.CUSTOM_COLOR, color);
  }

  // UI preferences
  getAppLanguage(): 'en' | 'it' {
    const stored = mainStorage.getString(SettingsKeys.APP_LANGUAGE);
    return stored === 'en' ? 'en' : 'it';
  }

  setAppLanguage(language: 'en' | 'it'): void {
    mainStorage.setString(SettingsKeys.APP_LANGUAGE, language);
  }

  showTabBarLabels(): boolean {
    return this.getBoolWithDefault(SettingsKeys.SHOW_TAB_BAR_LABELS, false);
  }

  setShowTabBarLabels(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_TAB_BAR_LABELS, show);
  }

  showRecentlyWatched(): boolean {
    return this.getBoolWithDefault(SettingsKeys.SHOW_RECENTLY_WATCHED, true);
  }

  setShowRecentlyWatched(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_RECENTLY_WATCHED, show);
  }

  isTabletRotationEnabled(): boolean {
    return this.getBoolWithDefault(SettingsKeys.ALLOW_TABLET_ROTATION, false);
  }

  setTabletRotationEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.ALLOW_TABLET_ROTATION, enabled);
  }

  isHapticFeedbackEnabled(): boolean {
    return this.getBoolWithDefault(SettingsKeys.HAPTIC_FEEDBACK, true);
  }
  setHapticFeedbackEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.HAPTIC_FEEDBACK, enabled);
  }

  isNotificationsEnabled(): boolean {
    return this.getBoolWithDefault(SettingsKeys.NOTIFICATIONS_ENABLED, true);
  }

  setNotificationsEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.NOTIFICATIONS_ENABLED, enabled);
  }

  // Update settings
  isAutoCheckUpdateEnabled(): boolean {
    return this.getBoolWithDefault(SettingsKeys.AUTO_CHECK_UPDATE, true);
  }

  setAutoCheckUpdateEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.AUTO_CHECK_UPDATE, enabled);
  }

  isAutoDownloadEnabled(): boolean {
    return this.getBoolWithDefault(SettingsKeys.AUTO_DOWNLOAD, false);
  }

  setAutoDownloadEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.AUTO_DOWNLOAD, enabled);
  }

  getPendingUpdateApkName(): string | undefined {
    return mainStorage.getString(SettingsKeys.PENDING_UPDATE_APK_NAME);
  }

  getPendingUpdateSourceVersion(): string | undefined {
    return mainStorage.getString(SettingsKeys.PENDING_UPDATE_SOURCE_VERSION);
  }

  setPendingUpdateArtifact(apkName: string, sourceVersion: string): void {
    mainStorage.setString(SettingsKeys.PENDING_UPDATE_APK_NAME, apkName);
    mainStorage.setString(
      SettingsKeys.PENDING_UPDATE_SOURCE_VERSION,
      sourceVersion,
    );
  }

  clearPendingUpdateArtifact(): void {
    mainStorage.delete(SettingsKeys.PENDING_UPDATE_APK_NAME);
    mainStorage.delete(SettingsKeys.PENDING_UPDATE_SOURCE_VERSION);
  }

  // Player settings
  showMediaControls(): boolean {
    return this.getBoolWithDefault(SettingsKeys.SHOW_MEDIA_CONTROLS, true);
  }

  setShowMediaControls(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_MEDIA_CONTROLS, show);
  }

  showHamburgerMenu(): boolean {
    return this.getBoolWithDefault(SettingsKeys.SHOW_HAMBURGER_MENU, true);
  }

  setShowHamburgerMenu(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_HAMBURGER_MENU, show);
  }

  hideSeekButtons(): boolean {
    return this.getBoolWithDefault(SettingsKeys.HIDE_SEEK_BUTTONS, false);
  }

  setHideSeekButtons(hide: boolean): void {
    mainStorage.setBool(SettingsKeys.HIDE_SEEK_BUTTONS, hide);
  }

  isEnable2xGestureEnabled(): boolean {
    return this.getBoolWithDefault(SettingsKeys.ENABLE_2X_GESTURE, false);
  }

  setEnable2xGesture(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.ENABLE_2X_GESTURE, enabled);
  }

  isSwipeGestureEnabled(): boolean {
    return this.getBoolWithDefault(SettingsKeys.ENABLE_SWIPE_GESTURE, true);
  }

  setSwipeGestureEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.ENABLE_SWIPE_GESTURE, enabled);
  }

  // Quality settings
  getExcludedQualities(): string[] {
    return mainStorage.getArray<string>(SettingsKeys.EXCLUDED_QUALITIES) || [];
  }

  setExcludedQualities(qualities: string[]): void {
    mainStorage.setArray(SettingsKeys.EXCLUDED_QUALITIES, qualities);
  }

  // Subtitle settings
  getSubtitleFontSize(): number {
    return mainStorage.getNumber(SettingsKeys.SUBTITLE_FONT_SIZE) || 16;
  }

  setSubtitleFontSize(size: number): void {
    mainStorage.setNumber(SettingsKeys.SUBTITLE_FONT_SIZE, size);
  }

  getSubtitleOpacity(): number {
    const opacityStr = mainStorage.getString(SettingsKeys.SUBTITLE_OPACITY);
    return opacityStr ? parseFloat(opacityStr) : 1;
  }

  setSubtitleOpacity(opacity: number): void {
    mainStorage.setString(SettingsKeys.SUBTITLE_OPACITY, opacity.toString());
  }

  getSubtitleBottomPadding(): number {
    return mainStorage.getNumber(SettingsKeys.SUBTITLE_BOTTOM_PADDING) || 10;
  }

  setSubtitleBottomPadding(padding: number): void {
    mainStorage.setNumber(SettingsKeys.SUBTITLE_BOTTOM_PADDING, padding);
  }

  getCastProvider(): 'native' | 'wvc' | 'vega' {
    const provider = mainStorage.getString(SettingsKeys.CAST_PROVIDER);
    if (provider === 'wvc') {
      return 'wvc';
    }
    if (provider === 'vega') {
      return 'vega';
    }
    return 'native';
  }

  setCastProvider(provider: 'native' | 'wvc' | 'vega'): void {
    mainStorage.setString(SettingsKeys.CAST_PROVIDER, provider);
  }

  getListViewType(): number {
    return parseInt(
      mainStorage.getString(SettingsKeys.LIST_VIEW_TYPE) || '1',
      10,
    );
  }

  setListViewType(type: number): void {
    mainStorage.setString(SettingsKeys.LIST_VIEW_TYPE, type.toString());
  }

  // Telemetry / Privacy
  isTelemetryOptIn(): boolean {
    // Default to true (opted in) unless explicitly disabled.
    return this.getBoolWithDefault(SettingsKeys.TELEMETRY_OPT_IN, true);
  }

  setTelemetryOptIn(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.TELEMETRY_OPT_IN, enabled);
  }

  isAndroidGeckoWebViewEnabled(): boolean {
    return this.getBoolWithDefault(
      SettingsKeys.ANDROID_GECKO_WEBVIEW_ENABLED,
      true,
    );
  }

  setAndroidGeckoWebViewEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.ANDROID_GECKO_WEBVIEW_ENABLED, enabled);
  }

  isAndroidGeckoAdGuardEnabled(): boolean {
    return this.getBoolWithDefault(
      SettingsKeys.ANDROID_GECKO_ADGUARD_ENABLED,
      true,
    );
  }

  setAndroidGeckoAdGuardEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.ANDROID_GECKO_ADGUARD_ENABLED, enabled);
  }

  // Generic get/set methods for settings not covered by specific methods
  getBool(key: string, defaultValue = false): boolean {
    const value = mainStorage.getBool(key, defaultValue);
    return value == null ? defaultValue : value;
  }

  setBool(key: string, value: boolean): void {
    mainStorage.setBool(key, value);
  }
}

// Export a singleton instance
export const settingsStorage = new SettingsStorage();
