import {NativeModules, Platform} from 'react-native';

type VegaOrientationModule = {
  setUserOrientation?: () => void;
};

const vegaOrientationModule: VegaOrientationModule | undefined =
  NativeModules.VegaOrientation;

export const applyAndroidUserOrientation = (): boolean => {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (!vegaOrientationModule?.setUserOrientation) {
    return false;
  }

  vegaOrientationModule.setUserOrientation();
  return true;
};
