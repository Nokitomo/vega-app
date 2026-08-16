export interface ArchiveFilterSelection {
  title?: string;
  year?: string;
  order?: string;
  status?: string;
  type?: string;
  season?: string;
  genres: string[];
  dubbed?: boolean;
  random?: boolean;
}

const parseBoolean = (value: string | null): boolean | undefined => {
  if (value == null) {
    return undefined;
  }
  return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
};

export const createEmptyArchiveFilterSelection = (): ArchiveFilterSelection => ({
  genres: [],
});

export const parseArchiveFilterSelection = (
  filter: string,
): ArchiveFilterSelection => {
  const [, rawQuery = ''] = String(filter || '').split('?', 2);
  const params = new URLSearchParams(rawQuery);
  const genres = (params.get('genres') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  return {
    title: params.get('title') || undefined,
    year: params.get('year') || undefined,
    order: params.get('order') || undefined,
    status: params.get('status') || undefined,
    type: params.get('type') || undefined,
    season: params.get('season') || undefined,
    genres,
    dubbed: parseBoolean(params.get('dubbed')),
    random: parseBoolean(params.get('random')),
  };
};

export const buildArchiveFilter = (
  baseFilter: string,
  selection: ArchiveFilterSelection,
): string => {
  const path = String(baseFilter || 'archive').split('?', 1)[0] || 'archive';
  const params = new URLSearchParams();
  const add = (key: string, value?: string) => {
    const normalized = String(value || '').trim();
    if (normalized) {
      params.set(key, normalized);
    }
  };

  add('title', selection.title);
  add('type', selection.type);
  add('year', selection.year);
  add('order', selection.order);
  add('status', selection.status);
  if (selection.genres.length > 0) {
    params.set('genres', selection.genres.join(','));
  }
  add('season', selection.season);
  if (selection.dubbed) {
    params.set('dubbed', 'true');
  }
  if (selection.random) {
    params.set('random', 'true');
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

export const hasActiveArchiveFilters = (
  selection: ArchiveFilterSelection,
): boolean =>
  !!(
    selection.title ||
    selection.year ||
    selection.order ||
    selection.status ||
    selection.type ||
    selection.season ||
    selection.genres.length > 0 ||
    selection.dubbed ||
    selection.random
  );
