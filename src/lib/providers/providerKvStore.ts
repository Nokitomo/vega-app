import {ProviderKvStore} from './types';
import {providerKvStorage} from '../storage/StorageService';

const MAX_KEY_LENGTH = 256;
const MAX_VALUE_LENGTH = 1_000_000;

const validateKey = (key: string): string => {
  if (typeof key !== 'string' || !key.trim() || key.length > MAX_KEY_LENGTH) {
    throw new Error(
      `Invalid provider storage key: expected 1-${MAX_KEY_LENGTH} characters`,
    );
  }
  return key;
};

const encodeScopePart = (value: string) => encodeURIComponent(value.trim());

export const getProviderKvPrefix = (
  providerValue: string,
  sourceAuthor?: string,
): string =>
  `provider:${encodeScopePart(sourceAuthor || 'legacy')}:${encodeScopePart(
    providerValue,
  )}:`;

export const getProviderKvKey = (
  providerValue: string,
  key: string,
  sourceAuthor?: string,
): string => `${getProviderKvPrefix(providerValue, sourceAuthor)}${validateKey(key)}`;

export const createProviderKvStore = (
  providerValue: string,
  sourceAuthor?: string,
): ProviderKvStore => {
  const prefix = getProviderKvPrefix(providerValue, sourceAuthor);
  const storageKey = (key: string) => `${prefix}${validateKey(key)}`;

  return {
    get: async <T = unknown>(key: string): Promise<T | undefined> => {
      const raw = providerKvStorage.getString(storageKey(key));
      if (raw === undefined) {
        return undefined;
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },
    set: async (key: string, value: unknown): Promise<void> => {
      if (value === undefined) {
        providerKvStorage.delete(storageKey(key));
        return;
      }
      const serialized = JSON.stringify(value);
      if (serialized === undefined) {
        throw new Error('Provider storage values must be JSON-serializable');
      }
      if (serialized.length > MAX_VALUE_LENGTH) {
        throw new Error(
          `Provider storage value exceeds ${MAX_VALUE_LENGTH} characters`,
        );
      }
      providerKvStorage.setString(storageKey(key), serialized);
    },
    delete: async (key: string): Promise<boolean> => {
      const scopedKey = storageKey(key);
      const existed = providerKvStorage.contains(scopedKey);
      providerKvStorage.delete(scopedKey);
      return existed;
    },
    keys: async (): Promise<string[]> => {
      const keys = await providerKvStorage.getKeys();
      return keys
        .filter(key => key.startsWith(prefix))
        .map(key => key.slice(prefix.length));
    },
    clear: async (): Promise<void> => {
      const keys = await providerKvStorage.getKeys();
      keys
        .filter(key => key.startsWith(prefix))
        .forEach(key => providerKvStorage.delete(key));
    },
  };
};

export const clearProviderKvStore = async (
  providerValue: string,
  sourceAuthor?: string,
): Promise<void> =>
  createProviderKvStore(providerValue, sourceAuthor).clear();
