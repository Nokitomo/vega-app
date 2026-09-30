import {beforeEach, describe, expect, it} from '@jest/globals';
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

describe('provider settings modules', () => {
  beforeEach(() => {
    mainStorage.clearAll();
    providerKvStorage.clearAll();
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

  it('detects missing, stale, or incomplete provider module caches', () => {
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

    expect(isProviderModuleCurrent(currentModule, provider, now)).toBe(true);
    expect(
      isProviderModuleCurrent(
        {...currentModule, cacheRevision: undefined},
        provider,
        now,
      ),
    ).toBe(false);
    expect(
      isProviderModuleCurrent(
        {...currentModule, cachedAt: now - 25 * 60 * 60 * 1000},
        provider,
        now,
      ),
    ).toBe(false);
    expect(
      isProviderModuleCurrent(
        {...currentModule, modules: {...currentModule.modules, meta: ''}},
        provider,
        now,
      ),
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
});
