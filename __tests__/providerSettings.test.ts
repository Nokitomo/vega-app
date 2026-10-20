import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {providerManager} from '../src/lib/services/ProviderManager';
import {
  extensionStorage,
  PROVIDER_MODULE_CACHE_REVISION,
} from '../src/lib/storage/extensionStorage';
import {createProviderKvStore} from '../src/lib/providers/providerKvStore';
import {
  mainStorage,
  providerKvStorage,
} from '../src/lib/storage/StorageService';
import {isProviderModuleCurrent} from '../src/lib/services/UpdateProviders';
import {getProviderCacheScope} from '../src/lib/utils/providerCacheScope';
import {setAppTmdbApiKey} from '../src/lib/storage/tmdbApiKeyStorage';
import {secureStorage} from '../src/lib/storage/StorageService';

describe('provider settings modules', () => {
  beforeEach(() => {
    mainStorage.clearAll();
    providerKvStorage.clearAll();
    secureStorage.clearAll();
  });

  it('hides the old TMDB setting from already installed provider modules', async () => {
    extensionStorage.cacheProviderModules({
      value: 'animeunity',
      sourceAuthor: 'Nokitomo',
      version: '1.3.27',
      cachedAt: 123,
      modules: {
        settings: `exports.getSettingsSchema = async () => [
          {key: 'tmdbApiKey', type: 'text', label: 'TMDB key'},
          {key: 'other', type: 'toggle', label: 'Other'}
        ];`,
      },
    });
    await expect(providerManager.getSettingsSchema({
      providerValue: 'animeunity', sourceAuthor: 'Nokitomo',
    })).resolves.toEqual([
      expect.objectContaining({key: 'other'}),
    ]);
  });

  it('refreshes only supported provider scopes when the app key changes', () => {
    const anime = getProviderCacheScope('animeunity');
    const streaming = getProviderCacheScope('streamingunity');
    const center = getProviderCacheScope('streamcenter');
    const other = getProviderCacheScope('torrentio');
    expect(setAppTmdbApiKey('new-key')).toBe(true);
    expect(getProviderCacheScope('animeunity')).not.toBe(anime);
    expect(getProviderCacheScope('streamingunity')).not.toBe(streaming);
    expect(getProviderCacheScope('streamcenter')).not.toBe(center);
    expect(getProviderCacheScope('torrentio')).toBe(other);
    expect(setAppTmdbApiKey('new-key')).toBe(false);
  });

  it('executes settings.js with a provider-scoped KV store', async () => {
    extensionStorage.cacheProviderModules({
      value: 'configurable',
      sourceAuthor: 'TestSource',
      version: '1.0.0',
      cachedAt: 123,
      modules: {
        settings: `
          exports.getSettingsSchema = async function ({ providerContext }) {
            await providerContext.kvStore.set('schema-loaded', true);
            return [{
              key: 'apiKey',
              type: 'text',
              label: 'API Key',
              secure: true,
              defaultValue: ''
            }];
          };
        `,
      },
    });

    const schema = await providerManager.getSettingsSchema({
      providerValue: 'configurable',
      sourceAuthor: 'TestSource',
    });

    expect(schema).toEqual([
      expect.objectContaining({key: 'apiKey', type: 'text', secure: true}),
    ]);
    await expect(
      createProviderKvStore('configurable', 'TestSource').get('schema-loaded'),
    ).resolves.toBe(true);
    await expect(
      createProviderKvStore('configurable', 'OtherSource').get('schema-loaded'),
    ).resolves.toBeUndefined();
  });

  it('repairs invalid modules while keeping complete older modules current', () => {
    const provider = {
      value: 'animeunity',
      display_name: 'AnimeUnity',
      source: {author: 'Nokitomo', url: 'https://providers.test'},
      version: '1.3.16',
      icon: '',
      disabled: false,
      type: 'anime' as const,
      installed: true,
    };
    const now = 2_000_000_000;
    const currentModule = {
      value: provider.value,
      sourceAuthor: provider.source.author,
      version: provider.version,
      cachedAt: now - 1_000,
      cacheRevision: PROVIDER_MODULE_CACHE_REVISION,
      modules: {
        posts: 'posts',
        meta: 'meta',
        stream: 'stream',
        catalog: 'catalog',
      },
    };

    expect(isProviderModuleCurrent(currentModule, provider)).toBe(true);
    expect(
      isProviderModuleCurrent(
        {...currentModule, cacheRevision: undefined},
        provider,
      ),
    ).toBe(false);
    expect(
      isProviderModuleCurrent(
        {...currentModule, cachedAt: now - 25 * 60 * 60 * 1000},
        provider,
      ),
    ).toBe(true);
    expect(
      isProviderModuleCurrent(
        {...currentModule, modules: {...currentModule.modules, meta: ''}},
        provider,
      ),
    ).toBe(false);
    expect(
      isProviderModuleCurrent(
        {...currentModule, sourceAuthor: 'OtherSource'},
        provider,
      ),
    ).toBe(false);
    expect(
      isProviderModuleCurrent({...currentModule, version: '1.3.15'}, provider),
    ).toBe(false);
  });

  it('changes persisted content cache scope when modules are refreshed', () => {
    extensionStorage.cacheProviderModules({
      value: 'animeunity',
      sourceAuthor: 'Nokitomo',
      version: '1.3.16',
      cachedAt: 100,
      cacheRevision: PROVIDER_MODULE_CACHE_REVISION,
      modules: {posts: 'p', meta: 'm', stream: 's', catalog: 'c'},
    });
    const before = getProviderCacheScope('animeunity');

    extensionStorage.cacheProviderModules({
      value: 'animeunity',
      sourceAuthor: 'Nokitomo',
      version: '1.3.16',
      cachedAt: 200,
      cacheRevision: PROVIDER_MODULE_CACHE_REVISION,
      modules: {posts: 'p2', meta: 'm2', stream: 's2', catalog: 'c2'},
    });

    expect(getProviderCacheScope('animeunity')).not.toBe(before);
  });

  it('reuses an unchanged scope without reading provider modules again', () => {
    extensionStorage.cacheProviderModules({
      value: 'animeunity',
      sourceAuthor: 'Nokitomo',
      version: '1.0.0',
      cachedAt: 100,
      modules: {meta: 'm'},
    });
    const readArray = jest.spyOn(mainStorage, 'getArray');
    try {
      const first = getProviderCacheScope('animeunity');
      const readsAfterFirst = readArray.mock.calls.length;
      expect(readsAfterFirst).toBeGreaterThan(0);
      expect(getProviderCacheScope('animeunity')).toBe(first);
      expect(readArray).toHaveBeenCalledTimes(readsAfterFirst);
    } finally {
      readArray.mockRestore();
    }
  });

  it('invalidates the scope on source changes and direct storage clearing', () => {
    extensionStorage.addProviderSources('First', 'https://first.test');
    extensionStorage.addProviderSources('Second', 'https://second.test');
    extensionStorage.cacheProviderModules({
      value: 'animeunity',
      sourceAuthor: 'First',
      version: '1.0.0',
      cachedAt: 100,
      modules: {meta: 'first'},
    });
    extensionStorage.cacheProviderModules({
      value: 'animeunity',
      sourceAuthor: 'Second',
      version: '2.0.0',
      cachedAt: 200,
      modules: {meta: 'second'},
    });

    expect(getProviderCacheScope('animeunity')).toBe('First:animeunity:1.0.0:100:tmdb0');
    extensionStorage.setDefaultProviderSource('Second');
    expect(getProviderCacheScope('animeunity')).toBe('Second:animeunity:2.0.0:200:tmdb0');

    mainStorage.clearAll();
    expect(getProviderCacheScope('animeunity')).toBe('default:animeunity:legacy:legacy:tmdb0');
  });

  it('updates the scope when an installed provider changes without modules', () => {
    const provider = {
      value: 'streamingunity',
      display_name: 'StreamingUnity',
      source: {author: 'Nokitomo', url: 'https://providers.test'},
      version: '1.0.0',
      icon: '',
      disabled: false,
      type: 'italy' as const,
      installed: true,
      lastUpdated: 100,
    };
    extensionStorage.setInstalledProviders([provider]);
    expect(getProviderCacheScope('streamingunity')).toBe(
      'Nokitomo:streamingunity:1.0.0:100:tmdb0',
    );
    extensionStorage.setInstalledProviders([
      {...provider, version: '1.0.1', lastUpdated: 200},
    ]);
    expect(getProviderCacheScope('streamingunity')).toBe(
      'Nokitomo:streamingunity:1.0.1:200:tmdb0',
    );
  });
});
