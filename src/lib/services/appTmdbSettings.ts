import {providerManager} from './ProviderManager';
import {clearTmdbProviderMetadata} from '../storage/MetadataDatabase';
import {setAppTmdbApiKey} from '../storage/tmdbApiKeyStorage';

export const saveAppTmdbApiKey = (value: string): boolean => {
  const changed = setAppTmdbApiKey(value);
  if (changed) {
    clearTmdbProviderMetadata();
    providerManager.clearRuntimeCaches();
  }
  return changed;
};
