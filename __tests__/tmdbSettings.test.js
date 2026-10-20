const mockRunSync = jest.fn();
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({execSync: jest.fn(), runSync: mockRunSync})),
}));

const {mainStorage, secureStorage} = require('../src/lib/storage/StorageService');
const {saveAppTmdbApiKey} = require('../src/lib/services/appTmdbSettings');
const {providerManager} = require('../src/lib/services/ProviderManager');

beforeEach(() => {
  mainStorage.clearAll();
  secureStorage.clearAll();
  mockRunSync.mockClear();
});

test('changing or removing the key invalidates only provider metadata', () => {
  const clearRuntime = jest.spyOn(providerManager, 'clearRuntimeCaches');
  try {
    expect(saveAppTmdbApiKey('first-key')).toBe(true);
    expect(mockRunSync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM metadata_records'),
      ['%:animeunity', '%:streamingunity', '%:streamcenter'],
    );
    expect(clearRuntime).toHaveBeenCalledTimes(1);
    expect(saveAppTmdbApiKey('first-key')).toBe(false);
    expect(clearRuntime).toHaveBeenCalledTimes(1);
    expect(saveAppTmdbApiKey('')).toBe(true);
    expect(mockRunSync).toHaveBeenCalledTimes(2);
    expect(clearRuntime).toHaveBeenCalledTimes(2);
  } finally {
    clearRuntime.mockRestore();
  }
});
