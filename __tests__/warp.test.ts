import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {
  createWarpService,
  VegaWarpNativeModule,
  WarpStatus,
} from '../src/lib/services/warp';
import {mainStorage, settingsStorage} from '../src/lib/storage';

const mockStart = jest.fn<() => Promise<WarpStatus>>();
const mockStop = jest.fn<() => Promise<WarpStatus>>();
const mockGetStatus = jest.fn<() => Promise<WarpStatus>>();

const nativeModule: VegaWarpNativeModule = {
  start: mockStart,
  stop: mockStop,
  getStatus: mockGetStatus,
};
const warpService = createWarpService(nativeModule, true);

const runningStatus: WarpStatus = {
  supported: true,
  state: 'running',
  running: true,
  registered: true,
  port: 34567,
  abi: 'arm64-v8a',
};

const stoppedStatus: WarpStatus = {
  ...runningStatus,
  state: 'stopped',
  running: false,
  port: null,
};

describe('warpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mainStorage.clearAll();
  });

  it('persists activation only after the native tunnel is running', async () => {
    mockStart.mockResolvedValue(runningStatus);

    await expect(warpService.setEnabled(true)).resolves.toEqual(runningStatus);

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(settingsStorage.isAndroidWarpEnabled()).toBe(true);
  });

  it('clears activation after a native startup failure', async () => {
    settingsStorage.setAndroidWarpEnabled(true);
    mockStart.mockRejectedValue(new Error('failed'));

    await expect(warpService.setEnabled(true)).rejects.toThrow('failed');

    expect(settingsStorage.isAndroidWarpEnabled()).toBe(false);
  });

  it('stops a stale native process when the preference is disabled', async () => {
    mockStop.mockResolvedValue(stoppedStatus);

    await expect(warpService.syncPreference()).resolves.toEqual(stoppedStatus);

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('restores an enabled tunnel at application startup', async () => {
    settingsStorage.setAndroidWarpEnabled(true);
    mockStart.mockResolvedValue(runningStatus);

    await expect(warpService.syncPreference()).resolves.toEqual(runningStatus);

    expect(mockStart).toHaveBeenCalledTimes(1);
  });
});
