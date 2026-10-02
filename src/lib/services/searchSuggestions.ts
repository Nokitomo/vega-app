import type {OMDBResult} from '../../types/omdb';
import {fetchIMDbSuggestions, type TitleSuggestion} from './imdbSuggestions';
import {searchOMDB} from './omdb';

const MAX_SUGGESTIONS = 10;

const mapOMDbResult = (item: OMDBResult): TitleSuggestion => ({
  id: item.imdbID,
  title: item.Title,
  type: item.Type === 'movie' ? 'movie' : 'tv',
  year: Number.parseInt(item.Year, 10) || undefined,
  source: 'omdb',
});

export const fetchTitleSuggestions = async (
  query: string,
  signal?: AbortSignal,
  {omdbApiKey}: {omdbApiKey?: string} = {},
): Promise<TitleSuggestion[]> => {
  const imdbSuggestions = await fetchIMDbSuggestions(query, signal);
  if (imdbSuggestions.length > 0 || signal?.aborted) {
    return imdbSuggestions;
  }

  const omdbResults = await searchOMDB(query, {signal, apiKey: omdbApiKey});
  return omdbResults.slice(0, MAX_SUGGESTIONS).map(mapOMDbResult);
};
