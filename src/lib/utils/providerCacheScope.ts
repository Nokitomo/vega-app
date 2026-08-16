import {extensionStorage} from '../storage/extensionStorage';
import {extensionManager} from '../services/ExtensionManager';

const normalizeScopePart = (value: unknown, fallback: string): string => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

export const getProviderCacheScope = (providerValue: string): string => {
  if (!providerValue) {
    return 'default:unknown:legacy';
  }
  const normalizedValue = normalizeScopePart(providerValue, 'unknown');
  const module = extensionManager.getProviderModules(providerValue);
  const installed = extensionStorage
    .getInstalledProviders()
    .find(provider => provider.value === providerValue);
  const source = normalizeScopePart(
    module?.sourceAuthor || installed?.source?.author,
    'default',
  );
  const version = normalizeScopePart(
    module?.version || installed?.version,
    'legacy',
  );
  return `${source}:${normalizedValue}:${version}`;
};

export const buildProviderCacheKey = (
  namespace: string,
  providerValue: string,
  identifier: string,
): string =>
  `${namespace}:${getProviderCacheScope(providerValue)}:${identifier}`;
