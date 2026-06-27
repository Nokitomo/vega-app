import {ifExists} from './file/ifExists';
// import {hlsDownloader} from './hlsDownloader';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {Alert} from 'react-native';
import requestStoragePermission from './file/getStoragePermission';
import {hlsDownloader2} from './hlsDownloader2';
import {notificationService} from './services/Notification';
import i18n from '../i18n';
import {settingsStorage} from './storage';
import {
  copyFileToSaf,
  getDownloadFileName,
  isSafDownloadLocation,
} from './downloadLocation';

export const downloadManager = async ({
  title,
  url,
  fileName,
  fileType,
  setDownloadActive,
  setAlreadyDownloaded,
  setDownloadId,
  headers,
  deleteDownload,
}: {
  title: string;
  url: string;
  fileName: string;
  fileType: string;
  setDownloadActive: (value: boolean) => void;
  headers?: any;
  setAlreadyDownloaded: (value: boolean) => void;
  setDownloadId: (value: number) => void;
  deleteDownload: () => void;
}) => {
  await requestStoragePermission();

  await notificationService.showDownloadStarting(title, fileName);
  if (await ifExists(fileName)) {
    console.log('File already exists');
    setAlreadyDownloaded(true);
    setDownloadActive(false);
    return;
  }
  setDownloadActive(true);
  // if (activeDownloads.length > 0) {
  //   notifee.displayNotification({
  //     id: 'downloadQueue',
  //     title: 'Download Queue' + fileName,
  //     body: 'Downloading ' + fileName,
  //     android: {
  //       channelId,
  //       color: primary,
  //     },
  //   });
  //   console.log(
  //     'Downloading:',
  //     activeDownloads[0],
  //     activeDownloads[1],
  //     activeDownloads.length,
  //   );

  //   return;
  // }
  try {
    // downloadFile and save it to download folder
    const downloadLocation = settingsStorage.getDownloadLocationConfig();
    const isSafLocation = isSafDownloadLocation(downloadLocation);

    if (!isSafLocation && !(await RNFS.exists(downloadLocation.path))) {
      await RNFS.mkdir(downloadLocation.path);
    }
    await notificationService.requestPermission();

    if (fileType === 'm3u8') {
      if (isSafLocation) {
        throw new Error(
          i18n.t('Custom Android download folders do not support HLS yet'),
        );
      }

      // hlsDownloader({
      //   videoUrl: url,
      //   downloadStore,
      //   path: `${downloadFolder}/${fileName}.mp4`,
      //   fileName,
      //   title,
      //   setAlreadyDownloaded,
      //   setDownloadId: setDownloadId,
      //   headers,
      // });
      hlsDownloader2({
        videoUrl: url,
        setDownloadActive,
        path: `${downloadLocation.path}/${fileName}.mp4`,
        fileName,
        title,
        setAlreadyDownloaded,
        setDownloadId: setDownloadId,
        headers,
      });
      // ToastAndroid.show(
      //   'Hls video download is not supported, Use external Downloader',
      //   ToastAndroid.LONG,
      // );
      // notifee.cancelNotification(fileName);
      // downloadStore.removeActiveDownload(fileName);
      // setAlreadyDownloaded(false);
      console.log('Downloading HLS');
      return;
    }
    const targetFileName = getDownloadFileName(fileName, fileType);
    const downloadDest = isSafLocation
      ? `${RNFS.CachesDirectoryPath}/${targetFileName}`
      : `${downloadLocation.path}/${targetFileName}`;
    const ret = RNFS.downloadFile({
      fromUrl: url,
      progressInterval: 1000,
      backgroundTimeout: 1000 * 60 * 60,
      progressDivider: 1,
      headers: headers ? headers : {},
      toFile: downloadDest,
      background: true,
      begin: (res: any) => {
        console.log('Download has started', res);
        setDownloadId(ret.jobId);
      },
      progress: (res: any) => {
        const progress = res.bytesWritten / res.contentLength;
        const body =
          res.contentLength < 1024 * 1024 * 1024
            ? // less than 1GB?

              Math.round(res.bytesWritten / 1024 / 1024) +
              ' / ' +
              Math.round(res.contentLength / 1024 / 1024) +
              ' MB'
            : parseFloat((res.bytesWritten / 1024 / 1024 / 1024).toFixed(2)) +
              ' / ' +
              parseFloat((res.contentLength / 1024 / 1024 / 1024).toFixed(2)) +
              ' GB';
        // console.log('Download progress:', progress * 100);
        notificationService.showDownloadProgress(
          title,
          fileName,
          progress,
          body,
          ret.jobId,
        );
      },
    });
    ret.promise.then(res => {
      const finalizeDownload = async () => {
        console.log('Download complete', res);

        if (isSafLocation) {
          await copyFileToSaf({
            fromPath: downloadDest,
            directoryUri: downloadLocation.uri,
            fileName,
            fileType,
          });
          await RNFS.unlink(downloadDest);
        }

        setAlreadyDownloaded(true);
        notificationService.showDownloadComplete(title, fileName);
        setDownloadActive(false);
      };

      finalizeDownload().catch(async err => {
        deleteDownload();
        console.log('Download finalize error:', err);
        Alert.alert(
          i18n.t('Download failed'),
          err.message || i18n.t('Failed to download'),
        );
        notificationService.showDownloadFailed(title, fileName);
        setDownloadActive(false);
        setAlreadyDownloaded(false);

        if (await RNFS.exists(downloadDest)) {
          await RNFS.unlink(downloadDest);
        }
      });
      // downloadManager({
      //   ...activeDownloads[0],
      //   downloadStore,
      //   setAlreadyDownloaded,
      // });
    });
    ret.promise.catch(async err => {
      deleteDownload();
      console.log('Download error:', err);
      Alert.alert(
        i18n.t('Download failed'),
        err.message || i18n.t('Failed to download'),
      );
      notificationService.showDownloadFailed(title, fileName);
      setDownloadActive(false);
      setAlreadyDownloaded(false);

      if (isSafLocation && (await RNFS.exists(downloadDest))) {
        await RNFS.unlink(downloadDest);
      }
      // downloadManager({
      //   ...activeDownloads[0],
      //   downloadStore,
      //   setAlreadyDownloaded,
      // });
    });
    return ret.jobId;
  } catch (error: any) {
    console.error('Download error:', error);
    deleteDownload();
    Alert.alert(
      i18n.t('Download failed'),
      error?.message || i18n.t('Failed to download'),
    );
    setDownloadActive(false);
    setAlreadyDownloaded(false);
  }
};
