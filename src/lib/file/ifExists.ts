import {settingsStorage} from '../storage';
import {findDownloadedFileByBaseName} from '../downloadLocation';

// check if file exists in download folder folder

export const ifExists = async (fileName: string) => {
  return findDownloadedFileByBaseName(
    settingsStorage.getDownloadLocationConfig(),
    fileName,
  );
};
