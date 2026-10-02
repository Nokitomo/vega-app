export interface TitleSuggestion {
  id?: string;
  title: string;
  type: 'movie' | 'tv';
  year?: number;
  source: 'imdb' | 'omdb';
}

interface IMDbSuggestionItem {
  id?: string;
  l?: string;
  q?: string;
  qid?: string;
  y?: number;
}

const IMDb_SUGGESTIONS_BASE_URL =
  'https://v3.sg.media-imdb.com/suggestion/titles';
const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 10;

export const fetchIMDbSuggestions = async (
  query: string,
  signal?: AbortSignal,
): Promise<TitleSuggestion[]> => {
  const cleanQuery = query.trim().toLowerCase();
  if (cleanQuery.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const firstCharacter = /^[a-z0-9]/.test(cleanQuery)
    ? cleanQuery.charAt(0)
    : 'x';
  const url = `${IMDb_SUGGESTIONS_BASE_URL}/${encodeURIComponent(
    firstCharacter,
  )}/${encodeURIComponent(cleanQuery)}.json`;

  const controller = new AbortController();
  const abortRequest = () => controller.abort();
  signal?.addEventListener('abort', abortRequest, {once: true});
  const timeout = setTimeout(abortRequest, 5000);

  try {
    const response = await fetch(url, {
      headers: {Accept: 'application/json'},
      signal: controller.signal,
    });
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as {d?: IMDbSuggestionItem[]};
    const items = data.d;
    if (!Array.isArray(items)) {
      return [];
    }

    const seenTitles = new Set<string>();
    const suggestions: TitleSuggestion[] = [];

    for (const item of items) {
      const title = item.l?.trim();
      if (!title) {
        continue;
      }

      const normalizedTitle = title.toLocaleLowerCase();
      if (seenTitles.has(normalizedTitle)) {
        continue;
      }
      seenTitles.add(normalizedTitle);

      const category = `${item.q || ''} ${item.qid || ''}`.toLowerCase();
      const isTv =
        category.includes('tv') ||
        category.includes('series') ||
        category.includes('episode');

      suggestions.push({
        id: item.id,
        title,
        type: isTv ? 'tv' : 'movie',
        year: item.y,
        source: 'imdb',
      });

      if (suggestions.length >= MAX_SUGGESTIONS) {
        break;
      }
    }

    return suggestions;
  } catch (error) {
    if (controller.signal.aborted || signal?.aborted) {
      return [];
    }
    console.warn('IMDb suggestions request failed:', error);
    return [];
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortRequest);
  }
};
