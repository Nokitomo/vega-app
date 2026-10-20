import {extensionStorage, ExtensionKeys} from '../storage/extensionStorage';
import {extensionManager} from '../services/ExtensionManager';
import {measurePerfSync} from './perfTrace';
import {mainStorage} from '../storage/StorageService';
import {getTmdbCacheVersion, usesAppTmdbApiKey} from '../storage/tmdbApiKeyStorage';

const scopeCache = new Map<string, {revision: string; scope: string}>();

const getScopeRevision = (): string =>
  [
    ExtensionKeys.PROVIDER_MODULES,
    ExtensionKeys.INSTALLED_PROVIDERS,
    ExtensionKeys.PROVIDER_SOURCES,
  ]
    .map(key => mainStorage.getKeyRevision(key))
    .join(':') + `:${getTmdbCacheVersion()}`;

const normalizeScopePart = (value: unknown, fallback: string): string => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

export const getProviderCacheScope = (providerValue: string): string => {
  return measurePerfSync('provider_cache_scope', {provider: providerValue}, () => {
    if (!providerValue) {
      return 'default:unknown:legacy';
    }
    const storageRevision = getScopeRevision();
    const testMode = extensionManager.isTestModeEnabled();
    if (testMode) {
      scopeCache.delete(providerValue);
    }
    const cached = scopeCache.get(providerValue);
    if (!testMode && cached?.revision === storageRevision) {
      return cached.scope;
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
    const revision = normalizeScopePart(
      module?.cachedAt || installed?.lastUpdated,
      'legacy',
    );
    const tmdbVersion = usesAppTmdbApiKey(providerValue)
      ? `:tmdb${getTmdbCacheVersion()}`
      : '';
    const scope = `${source}:${normalizedValue}:${version}:${revision}${tmdbVersion}`;
    if (!testMode) {
      scopeCache.set(providerValue, {revision: storageRevision, scope});
    }
    return scope;
  });
};

export const buildProviderCacheKey = (
  namespace: string,
  providerValue: string,
  identifier: string,
): string =>
  `${namespace}:${getProviderCacheScope(providerValue)}:${identifier}`;
