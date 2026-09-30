import {NativeModules, Platform} from 'react-native';
import {settingsStorage} from '../storage';

export type WarpState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export type WarpStatus = {
  supported: boolean;
  state: WarpState;
  running: boolean;
  registered: boolean;
  port: number | null;
  abi: string;
};

export type VegaWarpNativeModule = {
  getStatus: () => Promise<WarpStatus>;
  start: () => Promise<WarpStatus>;
  stop: () => Promise<WarpStatus>;
};

const nativeModule = NativeModules.VegaWarp as VegaWarpNativeModule | undefined;

type WarpPreferenceStorage = Pick<
  typeof settingsStorage,
  'isAndroidWarpEnabled' | 'setAndroidWarpEnabled'
>;

export const createWarpService = (
  module: VegaWarpNativeModule | undefined,
  isAvailable: boolean,
  storage: WarpPreferenceStorage = settingsStorage,
) => {
  const assertAvailable = (): VegaWarpNativeModule => {
    if (!isAvailable || !module) {
      throw new Error('WARP is unavailable on this platform');
    }
    return module;
  };

  return {
    isAvailable,

    getStatus(): Promise<WarpStatus> {
      return assertAvailable().getStatus();
    },

    isEnabled(): boolean {
      return storage.isAndroidWarpEnabled();
    },

    async setEnabled(enabled: boolean): Promise<WarpStatus> {
      const activeModule = assertAvailable();
      if (!enabled) {
        const status = await activeModule.stop();
        storage.setAndroidWarpEnabled(false);
        return status;
      }

      try {
        const status = await activeModule.start();
        if (!status.running) {
          throw new Error('WARP did not reach the running state');
        }
        storage.setAndroidWarpEnabled(true);
        return status;
      } catch (error) {
        storage.setAndroidWarpEnabled(false);
        throw error;
      }
    },

    async syncPreference(): Promise<WarpStatus> {
      const activeModule = assertAvailable();
      if (!storage.isAndroidWarpEnabled()) {
        return activeModule.stop();
      }

      try {
        const status = await activeModule.start();
        if (!status.running) {
          throw new Error('WARP did not reach the running state');
        }
        return status;
      } catch (error) {
        storage.setAndroidWarpEnabled(false);
        throw error;
      }
    },
  };
};

export const warpService = createWarpService(
  nativeModule,
  Platform.OS === 'android' && Boolean(nativeModule),
);
