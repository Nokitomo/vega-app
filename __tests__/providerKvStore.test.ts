import {beforeEach, describe, expect, it} from '@jest/globals';
import {
  clearProviderKvStore,
  createProviderKvStore,
} from '../src/lib/providers/providerKvStore';
import {
  cacheStorage,
  mainStorage,
  providerKvStorage,
  secureStorage,
} from '../src/lib/storage/StorageService';
import {setAppTmdbApiKey} from '../src/lib/storage/tmdbApiKeyStorage';
import {createProviderContext} from '../src/lib/providers/providerContext';

describe('provider KV store', () => {
  beforeEach(() => {
    providerKvStorage.clearAll();
    secureStorage.clearAll();
    mainStorage.clearAll();
    cacheStorage.clearAll();
  });

  it('shares the app TMDB key only with the three supported providers', async () => {
    setAppTmdbApiKey('  common-key  ');
    expect(secureStorage.getString('tmdbApiKey')).toBe('common-key');
    expect(mainStorage.getString('tmdbApiKey')).toBeUndefined();
    for (const provider of ['animeunity', 'streamingunity', 'streamcenter']) {
      const store = createProviderKvStore(provider, 'Nokitomo');
      await expect(store.get('tmdbApiKey')).resolves.toBe('common-key');
      await store.set('localSetting', 'untouched');
      await store.clear();
      await expect(store.get('tmdbApiKey')).resolves.toBe('common-key');
    }
    await expect(
      createProviderKvStore('torrentio', 'Nokitomo').get('tmdbApiKey'),
    ).resolves.toBeUndefined();
    setAppTmdbApiKey('');
    await expect(
      createProviderKvStore('animeunity', 'Nokitomo').get('tmdbApiKey'),
    ).resolves.toBeUndefined();
  });

  it('does not reuse provider persistent metadata after the app key changes', () => {
    const oldContext = createProviderContext('animeunity', 'Nokitomo');
    oldContext.cache?.setString('artwork', 'old-result');
    expect(oldContext.cache?.getString('artwork')).toBe('old-result');
    setAppTmdbApiKey('new-key');
    const newContext = createProviderContext('animeunity', 'Nokitomo');
    expect(newContext.cache?.getString('artwork')).toBeUndefined();
    expect(createProviderContext('streamcenter', 'Nokitomo').cache?.getString('artwork'))
      .toBeUndefined();
  });

  it('stores JSON values and lists provider-local keys', async () => {
    const store = createProviderKvStore('torrentio', 'Nokitomo');

    await store.set('token', 'secret');
    await store.set('filters', ['720', '1080']);

    await expect(store.get('token')).resolves.toBe('secret');
    await expect(store.get('filters')).resolves.toEqual(['720', '1080']);
    await expect(store.keys()).resolves.toEqual(
      expect.arrayContaining(['token', 'filters']),
    );
  });

  it('isolates providers and sources with the same setting key', async () => {
    const first = createProviderKvStore('torrentio', 'Nokitomo');
    const second = createProviderKvStore('torrentio', 'AnotherSource');
    const third = createProviderKvStore('animeunity', 'Nokitomo');

    await first.set('token', 'first');
    await second.set('token', 'second');
    await third.set('token', 'third');

    await expect(first.get('token')).resolves.toBe('first');
    await expect(second.get('token')).resolves.toBe('second');
    await expect(third.get('token')).resolves.toBe('third');
  });

  it('clears only the selected provider scope', async () => {
    const torrentio = createProviderKvStore('torrentio', 'Nokitomo');
    const anime = createProviderKvStore('animeunity', 'Nokitomo');
    await torrentio.set('token', 'secret');
    await anime.set('token', 'keep');

    await clearProviderKvStore('torrentio', 'Nokitomo');

    await expect(torrentio.get('token')).resolves.toBeUndefined();
    await expect(anime.get('token')).resolves.toBe('keep');
  });

  it('rejects empty keys and removes undefined values', async () => {
    const store = createProviderKvStore('torrentio', 'Nokitomo');
    await expect(store.set('', 'value')).rejects.toThrow(/Invalid/);
    await store.set('optional', 'value');
    await store.set('optional', undefined);
    await expect(store.get('optional')).resolves.toBeUndefined();
  });
});
