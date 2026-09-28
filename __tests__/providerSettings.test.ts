import {beforeEach, describe, expect, it} from '@jest/globals';
import {providerManager} from '../src/lib/services/ProviderManager';
import {extensionStorage} from '../src/lib/storage/extensionStorage';
import {createProviderKvStore} from '../src/lib/providers/providerKvStore';
import {mainStorage, providerKvStorage} from '../src/lib/storage/StorageService';

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
});
