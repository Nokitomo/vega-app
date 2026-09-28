import axios from 'axios';
import {getBaseUrl} from './getBaseUrl';
import {headers} from './headers';
import * as cheerio from 'cheerio';
import {hubcloudExtracter} from './hubcloudExtractor';
import {gofileExtracter} from './gofileExtracter';
import {superVideoExtractor} from './superVideoExtractor';
import {gdFlixExtracter} from './gdflixExtractor';
import {ProviderContext} from './types';
import * as Crypto from 'expo-crypto';
import {openWebView} from '../services/wafResolver';
import {cacheStorage} from '../storage';
import {createProviderKvStore} from './providerKvStore';

/**
 * Context for provider functions.
 * This context is used to pass common dependencies to provider functions.
 */

const extractors = {
  hubcloudExtracter,
  gofileExtracter,
  superVideoExtractor,
  gdFlixExtracter,
};

export const createProviderContext = (
  providerValue: string,
  sourceAuthor?: string,
): ProviderContext => {
  const cachePrefix = `provider:${encodeURIComponent(
    sourceAuthor || 'legacy',
  )}:${encodeURIComponent(providerValue)}:`;

  return {
    axios,
    getBaseUrl,
    commonHeaders: headers,
    Crypto,
    cheerio,
    cache: {
      getString: key => cacheStorage.getString(`${cachePrefix}${key}`),
      setString: (key, value) =>
        cacheStorage.setString(`${cachePrefix}${key}`, value),
      delete: key => cacheStorage.delete(`${cachePrefix}${key}`),
    },
    kvStore: createProviderKvStore(providerValue, sourceAuthor),
    extractors,
    openWebView,
  };
};

export const providerContext: ProviderContext = createProviderContext('legacy');
