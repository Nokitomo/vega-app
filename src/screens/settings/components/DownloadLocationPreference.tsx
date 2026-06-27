import React, {useState} from 'react';
import {
  Platform,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as RNFS from '@dr.pogodin/react-native-fs';
import * as FileSystem from 'expo-file-system/legacy';
import {useTranslation} from 'react-i18next';
import {defaultDownloadFolder} from '../../../lib/constants';
import {getDownloadLocationDisplayValue} from '../../../lib/downloadLocation';
import {settingsStorage} from '../../../lib/storage';

type DownloadLocationPreferenceProps = {
  primary: string;
};

const getAndroidDirectoryLabel = (directoryUri: string) => {
  const treeMarker = '/tree/';
  const treeIndex = directoryUri.indexOf(treeMarker);
  if (treeIndex === -1) {
    return 'Custom folder';
  }

  const documentId = decodeURIComponent(
    directoryUri.slice(treeIndex + treeMarker.length),
  );
  const [volume, relativePath = ''] = documentId.split(':');
  const volumeLabel = volume === 'primary' ? 'Internal storage' : volume;

  return relativePath ? `${volumeLabel}/${relativePath}` : volumeLabel;
};

const DownloadLocationPreference = ({
  primary,
}: DownloadLocationPreferenceProps) => {
  const {t} = useTranslation();
  const [downloadLocation, setDownloadLocation] = useState(
    settingsStorage.getDownloadLocation(),
  );
  const [isPickingFolder, setIsPickingFolder] = useState(false);

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  const saveDownloadLocation = (
    location:
      | string
      | {
          type: 'saf';
          uri: string;
          label: string;
        },
  ) => {
    if (typeof location === 'string' && !location.trim()) {
      showToast(t('Invalid download location'));
      return;
    }

    settingsStorage.setDownloadLocation(location);
    const nextLocation =
      typeof location === 'string'
        ? location.trim()
        : getDownloadLocationDisplayValue(location);
    setDownloadLocation(nextLocation);
    showToast(t('Download location updated'));
  };

  const pickDownloadLocation = async () => {
    if (isPickingFolder) {
      return;
    }

    setIsPickingFolder(true);
    try {
      if (Platform.OS === 'android') {
        const permissions =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (!permissions.granted) {
          showToast(t('No folder selected'));
          return;
        }

        saveDownloadLocation({
          type: 'saf',
          uri: permissions.directoryUri,
          label: getAndroidDirectoryLabel(permissions.directoryUri),
        });
        return;
      }

      const pickedFolders = await RNFS.pickFile({pickerType: 'folder'});
      const pickedFolder = pickedFolders[0];
      if (pickedFolder) {
        saveDownloadLocation(pickedFolder.replace(/^file:\/\//, ''));
        return;
      }

      showToast(t('No folder selected'));
    } catch (error) {
      console.log('Error picking download folder:', error);
      showToast(t('Unable to open folder picker'));
    } finally {
      setIsPickingFolder(false);
    }
  };

  return (
    <View className="border-b border-[#262626]">
      <View className="p-4">
        <Text className="text-white text-base mb-3">
          {t('Download Location')}
        </Text>
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-gray-300 text-sm flex-1" numberOfLines={2}>
            {downloadLocation}
          </Text>
          <TouchableOpacity
            onPress={pickDownloadLocation}
            disabled={isPickingFolder}
            className="p-2 rounded-lg bg-[#262626]">
            <MaterialCommunityIcons
              name="folder-open-outline"
              size={22}
              color={primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => {
          settingsStorage.resetDownloadLocation();
          setDownloadLocation(defaultDownloadFolder);
          showToast(t('Download location reset'));
        }}
        className="flex-row items-center justify-between px-4 pb-4">
        <Text className="text-white text-base flex-1">
          {t('Reset Download Location')}
        </Text>
        <MaterialCommunityIcons name="restore" size={24} color={primary} />
      </TouchableOpacity>
    </View>
  );
};

export default DownloadLocationPreference;
