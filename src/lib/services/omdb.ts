import {OMDBResult, OMDBResponse} from '../../types/omdb';
import Constants from 'expo-constants';

const BASE_URL = 'https://www.omdbapi.com/';
const REQUEST_TIMEOUT_MS = 5000;

const getConfiguredApiKey = (): string =>
  String(Constants.expoConfig?.extra?.omdbApiKey || '').trim();

export const searchOMDB = async (
  query: string,
  {
    signal,
    apiKey = getConfiguredApiKey(),
  }: {signal?: AbortSignal; apiKey?: string} = {},
): Promise<OMDBResult[]> => {
  const cleanQuery = query.trim();
  const cleanApiKey = apiKey.trim();
  if (!cleanQuery || !cleanApiKey) {
    return [];
  }

  const controller = new AbortController();
  const abortRequest = () => controller.abort();
  signal?.addEventListener('abort', abortRequest, {once: true});
  const timeout = setTimeout(abortRequest, REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(BASE_URL);
    url.searchParams.set('apikey', cleanApiKey);
    url.searchParams.set('s', cleanQuery);
    url.searchParams.set('r', 'json');
    const response = await fetch(url.toString(), {
      headers: {Accept: 'application/json'},
      signal: controller.signal,
    });
    if (!response.ok) {
      return [];
    }
    const data: OMDBResponse = await response.json();
    return data.Response === 'True' ? (data.Search ?? []) : [];
  } catch (error) {
    if (controller.signal.aborted || signal?.aborted) {
      return [];
    }
    console.warn('OMDb search request failed:', error);
    return [];
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortRequest);
  }
};
