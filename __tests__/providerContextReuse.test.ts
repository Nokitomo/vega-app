import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {ProviderManager} from '../src/lib/services/ProviderManager';
import {createProviderContext} from '../src/lib/providers/providerContext';
import {extensionManager} from '../src/lib/services/ExtensionManager';
import type {ProviderContext} from '../src/lib/providers/types';

jest.mock('../src/lib/providers/providerContext', () => ({
  createProviderContext: jest.fn(() => ({})),
}));
jest.mock('../src/lib/services/ExtensionManager', () => ({
  extensionManager: {getProviderModules: jest.fn()},
}));

const createContext = jest.mocked(createProviderContext);
const getModules = jest.mocked(extensionManager.getProviderModules);
const contextOf = (manager: ProviderManager, provider: string) =>
  (
    manager as unknown as {
      getProviderContext: (value: string) => ProviderContext;
    }
  ).getProviderContext(provider);

describe('provider runtime context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getModules.mockReturnValue({
      value: 'animeunity',
      sourceAuthor: 'Nokitomo',
      version: '1.3.23',
      modules: {meta: 'bundle-v1'},
      cachedAt: Date.now(),
    });
  });

  it('shares one context for the same provider and invalidates on updates', () => {
    const manager = new ProviderManager();
    const first = contextOf(manager, 'animeunity');
    expect(contextOf(manager, 'animeunity')).toBe(first);
    expect(createContext).toHaveBeenCalledTimes(1);

    getModules.mockReturnValue({
      value: 'animeunity',
      sourceAuthor: 'Nokitomo',
      version: '1.3.24',
      modules: {meta: 'bundle-v2'},
      cachedAt: Date.now(),
    });
    expect(contextOf(manager, 'animeunity')).not.toBe(first);
    expect(createContext).toHaveBeenCalledTimes(2);
    manager.clearRuntimeCaches();
    contextOf(manager, 'animeunity');
    expect(createContext).toHaveBeenCalledTimes(3);
  });
});
