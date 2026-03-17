import {
  View,
  Text,
  TouchableNativeFeedback,
  ToastAndroid,
  Linking,
  Alert,
  Switch,
  Platform,
  NativeModules,
} from 'react-native';
// import pkg from '../../../package.json';
import React, {useState} from 'react';
import {Feather} from '@expo/vector-icons';
import {settingsStorage} from '../../lib/storage';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import * as Application from 'expo-application';
import {notificationService} from '../../lib/services/Notification';
import {useTranslation} from 'react-i18next';
import i18n from '../../i18n';

type GitHubReleaseAsset = {
  name?: string;
  browser_download_url?: string;
};

type GitHubRelease = {
  tag_name?: string;
  body?: string | null;
  html_url?: string;
  draft?: boolean;
  assets?: GitHubReleaseAsset[];
};

type AndroidApkArch = 'arm64-v8a' | 'armeabi-v7a' | 'universal' | 'other';

type DeviceAbiNativeModule = {
  supportedAbis?: string[];
};

const GITHUB_RELEASES_API = 'https://api.github.com/repos/Nokitomo/vega-app/releases';
const GITHUB_RELEASES_PAGE = 'https://github.com/Nokitomo/vega-app/releases';

const extractSemver = (tag: string): string | null => {
  const match = String(tag || '').match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
};

const classifyApkArch = (assetName: string): AndroidApkArch => {
  const lowerName = String(assetName || '').toLowerCase();
  if (lowerName.includes('arm64-v8a') || lowerName.includes('arm64')) {
    return 'arm64-v8a';
  }
  if (lowerName.includes('armeabi-v7a') || lowerName.includes('armv7')) {
    return 'armeabi-v7a';
  }
  if (lowerName.includes('universal')) {
    return 'universal';
  }
  return 'other';
};

const getAndroidSupportedAbis = (): string[] => {
  if (Platform.OS !== 'android') {
    return [];
  }

  const nativeModule = NativeModules.DeviceAbi as DeviceAbiNativeModule | undefined;
  const supportedAbis = nativeModule?.supportedAbis;
  if (!Array.isArray(supportedAbis)) {
    return [];
  }

  return supportedAbis
    .map(abi => String(abi || '').toLowerCase())
    .filter(Boolean);
};

const getPreferredApkOrder = (supportedAbis: string[]): AndroidApkArch[] => {
  const hasArm64 = supportedAbis.some(
    abi => abi.includes('arm64') || abi.includes('aarch64'),
  );
  const hasArmV7 = supportedAbis.some(
    abi =>
      abi.includes('armeabi-v7a') || abi.includes('armv7') || abi === 'armeabi',
  );

  const order: AndroidApkArch[] = [];

  if (hasArm64) {
    order.push('arm64-v8a');
  }
  if (hasArmV7) {
    order.push('armeabi-v7a');
  }

  order.push('universal');

  if (!order.includes('arm64-v8a')) {
    order.push('arm64-v8a');
  }
  if (!order.includes('armeabi-v7a')) {
    order.push('armeabi-v7a');
  }

  order.push('other');

  return order;
};

const pickAndroidApkAsset = (
  assets: GitHubReleaseAsset[] = [],
  supportedAbis: string[] = [],
): GitHubReleaseAsset | undefined => {
  const apkAssets = assets.filter(
    asset =>
      typeof asset?.name === 'string' &&
      asset.name.toLowerCase().endsWith('.apk') &&
      typeof asset?.browser_download_url === 'string',
  );

  if (apkAssets.length === 0) {
    return undefined;
  }

  const priority = getPreferredApkOrder(supportedAbis);
  for (const arch of priority) {
    const found = apkAssets.find(asset =>
      classifyApkArch(String(asset.name || '')) === arch,
    );
    if (found) {
      return found;
    }
  }

  return apkAssets[0];
};

const selectBestRelease = (releases: GitHubRelease[]): GitHubRelease | undefined => {
  const usable = Array.isArray(releases)
    ? releases.filter(release => !release?.draft)
    : [];

  if (usable.length === 0) {
    return undefined;
  }

  if (Platform.OS === 'android') {
    const withApk = usable.find(release =>
      Boolean(pickAndroidApkAsset(release.assets || [])),
    );
    if (withApk) {
      return withApk;
    }
  }

  return usable[0];
};

// download update
const downloadUpdate = async (url: string, name: string) => {
  console.log('downloading', url, name);
  await notificationService.requestPermission();

  try {
    if (await RNFS.exists(`${RNFS.DownloadDirectoryPath}/${name}`)) {
      await notificationService.displayUpdateNotification({
        id: 'downloadComplete',
        title: i18n.t('Download completed'),
        body: i18n.t('Tap to install'),
        data: {name: `${name}`, action: 'install'},
      });
      return;
    }
  } catch (error) {}
  const {promise} = RNFS.downloadFile({
    fromUrl: url,
    background: true,
    progressInterval: 1000,
    progressDivider: 1,
    toFile: `${RNFS.DownloadDirectoryPath}/${name}`,
    begin: res => {
      console.log('begin', res.jobId, res.statusCode, res.headers);
    },
    progress: res => {
      console.log('progress', res.bytesWritten, res.contentLength);
      notificationService.showUpdateProgress(
        i18n.t('Downloading update'),
        i18n.t('Version {{current}} -> {{target}}', {
          current: Application.nativeApplicationVersion,
          target: name,
        }),
        {
          current: res.bytesWritten,
          max: res.contentLength,
          indeterminate: false,
        },
      );
    },
  });
  promise.then(async res => {
    if (res.statusCode === 200) {
      await notificationService.cancelNotification('updateProgress');
      await notificationService.displayUpdateNotification({
        id: 'downloadComplete',
        title: i18n.t('Download complete'),
        body: i18n.t('Tap to install'),
        data: {name, action: 'install'},
      });
    }
  });
};

// handle check for update
export const checkForUpdate = async (
  setUpdateLoading: React.Dispatch<React.SetStateAction<boolean>>,
  autoDownload: boolean,
  showToast: boolean = true,
) => {
  setUpdateLoading(true);
  try {
    const res = await fetch(GITHUB_RELEASES_API);
    if (!res.ok) {
      throw new Error(`Failed to fetch releases: ${res.status}`);
    }

    const releases = (await res.json()) as GitHubRelease[];
    const data = selectBestRelease(releases);
    if (!data) {
      showToast &&
        ToastAndroid.show(i18n.t('App is up to date'), ToastAndroid.SHORT);
      setUpdateLoading(false);
      return;
    }

    const localVersion = Application.nativeApplicationVersion;
    const remoteSemver = extractSemver(String(data.tag_name || ''));
    if (!remoteSemver) {
      showToast &&
        ToastAndroid.show(i18n.t('App is up to date'), ToastAndroid.SHORT);
      setUpdateLoading(false);
      return;
    }

    const supportedAbis = getAndroidSupportedAbis();
    const apkAsset = pickAndroidApkAsset(data.assets || [], supportedAbis);

    if (compareVersions(localVersion || '', remoteSemver)) {
      ToastAndroid.show(i18n.t('New update available'), ToastAndroid.SHORT);
      Alert.alert(
        i18n.t('Update v{{current}} -> {{target}}', {
          current: localVersion,
          target: data.tag_name || remoteSemver,
        }),
        data.body || '',
        [
          {text: i18n.t('Cancel')},
          {
            text: i18n.t('Update'),
            onPress: () =>
              autoDownload &&
              Platform.OS === 'android' &&
              apkAsset?.browser_download_url &&
              apkAsset?.name
                ? downloadUpdate(apkAsset.browser_download_url, apkAsset.name)
                : Linking.openURL(data.html_url || GITHUB_RELEASES_PAGE),
          },
        ],
      );
      console.log(
        'local version',
        localVersion,
        'remote semver',
        remoteSemver,
      );
    } else {
      showToast &&
        ToastAndroid.show(i18n.t('App is up to date'), ToastAndroid.SHORT);
      console.log(
        'local version',
        localVersion,
        'remote semver',
        remoteSemver,
      );
    }
  } catch (error) {
    ToastAndroid.show(
      i18n.t('Failed to check for update'),
      ToastAndroid.SHORT,
    );
    console.log('Update error', error);
  }
  setUpdateLoading(false);
};

const About = () => {
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const [updateLoading, setUpdateLoading] = useState(false);
  const [autoDownload, setAutoDownload] = useState(
    settingsStorage.isAutoDownloadEnabled(),
  );
  const [autoCheckUpdate, setAutoCheckUpdate] = useState<boolean>(
    settingsStorage.isAutoCheckUpdateEnabled(),
  );

  return (
    <View className="flex-1 bg-black mt-8">
      <View className="px-4 py-3 border-b border-white/10">
        <Text className="text-2xl font-bold text-white">{t('About')}</Text>
        <Text className="text-gray-400 mt-1 text-sm">
          {t('App information and updates')}
        </Text>
      </View>

      <View className="p-4 space-y-4 pb-24">
        {/* Version */}
        <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center">
          <Text className="text-white text-base">{t('Version')}</Text>
          <Text className="text-white/70">
            v{Application.nativeApplicationVersion}
          </Text>
        </View>

        {/* Auto Install Updates */}
        <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center">
          <Text className="text-white text-base">
            {t('Auto install updates')}
          </Text>
          <Switch
            value={autoDownload}
            onValueChange={() => {
              setAutoDownload(!autoDownload);
              settingsStorage.setAutoDownloadEnabled(!autoDownload);
            }}
            thumbColor={autoDownload ? primary : 'gray'}
          />
        </View>

        {/* Auto Check Updates */}
        <View className="bg-white/10 p-3 rounded-lg flex-row justify-between items-center">
          <View className="flex-1 mr-2">
            <Text className="text-white text-base">
              {t('Check updates on start')}
            </Text>
            <Text className="text-gray-400 text-sm">
              {t('Automatically check for updates when app starts')}
            </Text>
          </View>
          <Switch
            value={autoCheckUpdate}
            onValueChange={() => {
              setAutoCheckUpdate(!autoCheckUpdate);
              settingsStorage.setAutoCheckUpdateEnabled(!autoCheckUpdate);
            }}
            thumbColor={autoCheckUpdate ? primary : 'gray'}
          />
        </View>

        {/* Check Updates Button */}
        <TouchableNativeFeedback
          onPress={() => checkForUpdate(setUpdateLoading, autoDownload, true)}
          disabled={updateLoading}
          background={TouchableNativeFeedback.Ripple('#ffffff20', false)}>
          <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center mt-4">
            <View className="flex-row items-center space-x-3">
              <MaterialCommunityIcons name="update" size={22} color="white" />
              <Text className="text-white text-base">
                {t('Check for updates')}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="white" />
          </View>
        </TouchableNativeFeedback>
      </View>
    </View>
  );
};

export default About;

function compareVersions(localVersion: string, remoteVersion: string): boolean {
  try {
    // Split versions into arrays and convert to numbers
    const local = localVersion.split('.').map(Number);
    const remote = remoteVersion.split('.').map(Number);

    // Compare major version
    if (remote[0] > local[0]) {
      return true;
    }
    if (remote[0] < local[0]) {
      return false;
    }

    // Compare minor version
    if (remote[1] > local[1]) {
      return true;
    }
    if (remote[1] < local[1]) {
      return false;
    }

    // Compare patch version
    if (remote[2] > local[2]) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Invalid version format');
    return false;
  }
}
