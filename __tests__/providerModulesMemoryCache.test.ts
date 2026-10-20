import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {
  ExtensionKeys,
  extensionStorage,
  type ProviderModule,
} from '../src/lib/storage/extensionStorage';
import {mainStorage} from '../src/lib/storage/StorageService';

const moduleFor = (
  sourceAuthor: string | undefined,
  version: string,
): ProviderModule => ({
  value: 'streamingunity',
  sourceAuthor,
  version,
  modules: {meta: `meta-${version}`},
  cachedAt: Number(version.replace(/\D/g, '')) || 1,
});

describe('provider modules memory cache', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mainStorage.clearAll();
  });

  it('deserializes modules once while their storage revision is unchanged', () => {
    extensionStorage.cacheProviderModules(moduleFor('source-a', '1'));
    const read = jest.spyOn(mainStorage, 'getArray');

    expect(extensionStorage.getProviderModules('streamingunity', 'source-a')?.version).toBe('1');
    expect(extensionStorage.getProviderModules('streamingunity', 'source-a')?.version).toBe('1');
    expect(read.mock.calls.filter(([key]) => key === ExtensionKeys.PROVIDER_MODULES)).toHaveLength(1);
  });

  it('uses the active source without retaining a stale selection', () => {
    extensionStorage.addProviderSources('source-a', 'https://a.test');
    extensionStorage.addProviderSources('source-b', 'https://b.test');
    extensionStorage.cacheProviderModules(moduleFor('source-a', '1'));
    extensionStorage.cacheProviderModules(moduleFor('source-b', '2'));

    expect(extensionStorage.getProviderModules('streamingunity')?.version).toBe('1');
    extensionStorage.setDefaultProviderSource('source-b');
    expect(extensionStorage.getProviderModules('streamingunity')?.version).toBe('2');
    expect(extensionStorage.getProviderModules('streamingunity', 'source-a')?.version).toBe('1');
  });

  it('sees installs, updates, removals and direct storage changes', () => {
    extensionStorage.cacheProviderModules(moduleFor('source-a', '1'));
    expect(extensionStorage.getProviderModules('streamingunity', 'source-a')?.version).toBe('1');

    extensionStorage.cacheProviderModules(moduleFor('source-a', '2'));
    expect(extensionStorage.getProviderModules('streamingunity', 'source-a')?.version).toBe('2');

    mainStorage.setArray(ExtensionKeys.PROVIDER_MODULES, [moduleFor('source-a', '3')]);
    expect(extensionStorage.getProviderModules('streamingunity', 'source-a')?.version).toBe('3');

    extensionStorage.removeProviderModules('streamingunity', 'source-a');
    expect(extensionStorage.getProviderModules('streamingunity', 'source-a')).toBeUndefined();
  });

  it('drops the snapshot after clearing extension storage', () => {
    extensionStorage.cacheProviderModules(moduleFor('source-a', '1'));
    expect(extensionStorage.getProviderModules('streamingunity', 'source-a')).toBeDefined();

    extensionStorage.clearAll();
    expect(extensionStorage.getProviderModules('streamingunity', 'source-a')).toBeUndefined();
  });
});
