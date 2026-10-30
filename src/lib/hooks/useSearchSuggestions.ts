import {useEffect, useState} from 'react';
import {type TitleSuggestion} from '../services/imdbSuggestions';
import {fetchTitleSuggestions} from '../services/searchSuggestions';

const SUGGESTIONS_DEBOUNCE_MS = 250;

export const useSearchSuggestions = ({
  query,
  enabled = true,
  suppressed = false,
}: {
  query: string;
  enabled?: boolean;
  suppressed?: boolean;
}) => {
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [resolvedQuery, setResolvedQuery] = useState('');

  useEffect(() => {
    const cleanQuery = query.trim();
    setSuggestions([]);
    setResolvedQuery(query);
    if (!enabled || suppressed || cleanQuery.length < 2) {
      setStatus('idle');
      return;
    }
    setStatus('loading');

    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      fetchTitleSuggestions(cleanQuery, controller.signal)
        .then(results => {
          if (active && !controller.signal.aborted) {
            setSuggestions(results);
            setStatus('ready');
          }
        })
        .catch(() => {
          if (active && !controller.signal.aborted) {
            setStatus('error');
          }
        });
    }, SUGGESTIONS_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, query, suppressed]);

  const eligible = enabled && !suppressed && query.trim().length >= 2;
  return {
    suggestions: eligible && resolvedQuery === query ? suggestions : [],
    status: !eligible
      ? ('idle' as const)
      : resolvedQuery !== query
        ? ('loading' as const)
        : status,
  };
};
