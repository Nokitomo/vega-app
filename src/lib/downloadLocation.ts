import * as RNFS from '@dr.pogodin/react-native-fs';
import * as FileSystem from 'expo-file-system/legacy';
import {NativeModules} from 'react-native';
import {defaultDownloadFolder} from './constants';

export type PathDownloadLocation = {
  type: 'path';
  path: string;
  label?: string;
};

export type SafDownloadLocation = {
  type: 'saf';
  uri: string;
  label: string;
};

export type DownloadLocationConfig = PathDownloadLocation | SafDownloadLocation;

const DOWNLOAD_LOCATION_PREFIX = 'download-location:';

export const defaultDownloadLocationConfig: PathDownloadLocation = {
  type: 'path',
  path: defaultDownloadFolder,
  label: defaultDownloadFolder,
};

export const serializeDownloadLocation = (
  config: DownloadLocationConfig,
): string => {
  return `${DOWNLOAD_LOCATION_PREFIX}${JSON.stringify(config)}`;
};

export const parseDownloadLocation = (
  storedValue?: string | null,
): DownloadLocationConfig => {
  if (!storedValue) {
    return defaultDownloadLocationConfig;
  }

  if (!storedValue.startsWith(DOWNLOAD_LOCATION_PREFIX)) {
    return {
      type: 'path',
      path: storedValue,
      label: storedValue,
    };
  }

  try {
    const parsed = JSON.parse(
      storedValue.slice(DOWNLOAD_LOCATION_PREFIX.length),
    ) as DownloadLocationConfig;

    if (parsed.type === 'saf' && parsed.uri && parsed.label) {
      return parsed;
    }

    if (parsed.type === 'path' && parsed.path) {
      return {
        type: 'path',
        path: parsed.path,
        label: parsed.label || parsed.path,
      };
    }
  } catch (error) {
    console.log('Failed to parse download location:', error);
  }

  return defaultDownloadLocationConfig;
};

export const isSafDownloadLocation = (
  config: DownloadLocationConfig,
): config is SafDownloadLocation => {
  return config.type === 'saf';
};

export const getDownloadLocationDisplayValue = (
  config: DownloadLocationConfig,
): string => {
  return config.type === 'saf' ? config.label : config.path;
};

export const getDownloadFileName = (fileName: string, fileType: string) => {
  return `${fileName}.${fileType}`;
};

export const getSafEntryName = (entryUri: string): string => {
  const decodedUri = decodeURIComponent(entryUri);
  return decodedUri.slice(decodedUri.lastIndexOf('/') + 1);
};

export const findDownloadedFileByBaseName = async (
  location: DownloadLocationConfig,
  fileName: string,
) => {
  try {
    if (location.type === 'path') {
      const files = await RNFS.readDir(location.path);
      const file = files.find(fileItem => {
        const nameWithoutExtension = fileItem.name
          .split('.')
          .slice(0, -1)
          .join('.');
        return nameWithoutExtension === fileName;
      });

      return file ? file.path : false;
    }

    const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(
      location.uri,
    );
    const file = files.find(fileUri => {
      const entryName = getSafEntryName(fileUri);
      const nameWithoutExtension = entryName.split('.').slice(0, -1).join('.');
      return nameWithoutExtension === fileName;
    });

    return file || false;
  } catch (error) {
    console.log('Error reading download location:', error);
    return false;
  }
};

const getMimeType = (fileType: string) => {
  switch (fileType.toLowerCase()) {
    case 'mp4':
      return 'video/mp4';
    case 'mkv':
      return 'video/x-matroska';
    case 'mov':
      return 'video/quicktime';
    case 'avi':
      return 'video/x-msvideo';
    case 'srt':
      return 'application/x-subrip';
    case 'vtt':
      return 'text/vtt';
    case 'ass':
      return 'text/plain';
    case 'mp3':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
};

export const copyFileToSaf = async ({
  fromPath,
  directoryUri,
  fileName,
  fileType,
}: {
  fromPath: string;
  directoryUri: string;
  fileName: string;
  fileType: string;
}) => {
  const targetFileName = getDownloadFileName(fileName, fileType);
  const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    directoryUri,
    targetFileName,
    getMimeType(fileType),
  );

  const safCopyModule = NativeModules.SafCopyModule as
    | {
        copyFileToUri: (
          fromFilePath: string,
          toFileUri: string,
        ) => Promise<void>;
      }
    | undefined;

  try {
    if (!safCopyModule?.copyFileToUri) {
      throw new Error('SAF file copy bridge is unavailable');
    }

    await safCopyModule.copyFileToUri(fromPath, fileUri);
    return fileUri;
  } catch (error) {
    await FileSystem.StorageAccessFramework.deleteAsync(fileUri).catch(() => {
      return;
    });
    throw error;
  }
};

export const deleteDownloadedFileByBaseName = async (
  location: DownloadLocationConfig,
  fileName: string,
) => {
  const foundFile = await findDownloadedFileByBaseName(location, fileName);

  if (!foundFile) {
    return false;
  }

  if (location.type === 'path') {
    await RNFS.unlink(foundFile);
    return true;
  }

  await FileSystem.StorageAccessFramework.deleteAsync(foundFile);
  return true;
};
