import {beforeEach, describe, expect, it} from '@jest/globals';
import {
  clearProviderKvStore,
  createProviderKvStore,
} from '../src/lib/providers/providerKvStore';
import {providerKvStorage} from '../src/lib/storage/StorageService';

describe('provider KV store', () => {
  beforeEach(() => {
    providerKvStorage.clearAll();
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
