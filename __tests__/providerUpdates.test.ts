import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {extensionManager} from '../src/lib/services/ExtensionManager';
import {updateProvidersService} from '../src/lib/services/UpdateProviders';
import {
  extensionStorage,
  PROVIDER_MODULE_CACHE_REVISION,
  type ProviderExtension,
} from '../src/lib/storage/extensionStorage';
import {mainStorage} from '../src/lib/storage/StorageService';

const provider: ProviderExtension = {
  value: 'animeunity',
  display_name: 'AnimeUnity',
  source: {author: 'Nokitomo', url: 'https://providers.test'},
  version: '1.3.21',
  icon: '',
  disabled: false,
  type: 'anime',
  installed: true,
};

const cacheCompleteModules = () => {
  extensionStorage.cacheProviderModules({
    value: provider.value,
    sourceAuthor: provider.source?.author,
    version: provider.version,
    cachedAt: Date.now() - 25 * 60 * 60 * 1000,
    cacheRevision: PROVIDER_MODULE_CACHE_REVISION,
    modules: {
      posts: 'posts',
      meta: 'meta',
      stream: 'stream',
      catalog: 'catalog',
    },
  });
};

describe('provider update checks', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mainStorage.clearAll();
    extensionStorage.setInstalledProviders([provider]);
    jest.spyOn(extensionManager, 'initialize').mockResolvedValue(undefined);
  });

  it('does not update a complete module cache only because it is old', async () => {
    cacheCompleteModules();
    jest.spyOn(extensionManager, 'fetchManifest').mockResolvedValue([provider]);
    const updateSpy = jest
      .spyOn(updateProvidersService, 'updateProviders')
      .mockResolvedValue({updated: [], failed: []});

    const updates = await updateProvidersService.checkForUpdatesAndAutoUpdate();

    expect(updates).toEqual([
      expect.objectContaining({
        currentVersion: provider.version,
        newVersion: provider.version,
        hasUpdate: false,
      }),
    ]);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('still detects a newer manifest version', async () => {
    cacheCompleteModules();
    const newer = {...provider, version: '1.3.22'};
    jest.spyOn(extensionManager, 'fetchManifest').mockResolvedValue([newer]);

    const updates = await updateProvidersService.checkForUpdatesManual();

    expect(updates).toEqual([
      expect.objectContaining({
        currentVersion: provider.version,
        newVersion: newer.version,
        hasUpdate: true,
      }),
    ]);
  });

  it('still repairs a missing module cache at the same version', async () => {
    jest.spyOn(extensionManager, 'fetchManifest').mockResolvedValue([provider]);

    const updates = await updateProvidersService.checkForUpdatesManual();

    expect(updates).toEqual([
      expect.objectContaining({
        currentVersion: provider.version,
        newVersion: provider.version,
        hasUpdate: true,
      }),
    ]);
  });
});
