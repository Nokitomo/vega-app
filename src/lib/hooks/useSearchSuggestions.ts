import {useEffect, useState} from 'react';
import {
  fetchIMDbSuggestions,
  type TitleSuggestion,
} from '../services/imdbSuggestions';

const SUGGESTIONS_DEBOUNCE_MS = 250;

export const useSearchSuggestions = ({
  query,
  enabled = true,
  suppressed = false,
}: {
  query: string;
  enabled?: boolean;
  suppressed?: boolean;
}): TitleSuggestion[] => {
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([]);

  useEffect(() => {
    const cleanQuery = query.trim();
    if (!enabled || suppressed || cleanQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      fetchIMDbSuggestions(cleanQuery, controller.signal).then(results => {
        if (active && !controller.signal.aborted) {
          setSuggestions(results);
        }
      });
    }, SUGGESTIONS_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, query, suppressed]);

  return suggestions;
};
