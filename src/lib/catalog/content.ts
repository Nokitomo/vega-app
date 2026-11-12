import {catalogChildren, catalogImages} from './reader';
import {selectImages} from './artwork';
import {useCatalogStore} from './store';
import type {CatalogRecord, Work, ImageField} from './types';
import type {EpisodeLink} from '../providers/types';

export const workTitle = (work: Work): string =>
  String(work.info.title || work.info.name || '');
export async function workImages(
  row: CatalogRecord<Work>,
  field: ImageField,
  season?: number,
  episode?: number,
  blocked = false,
): Promise<string[]> {
  const selected = selectImages(
    await catalogImages(row.id, field, season, episode),
    field,
    useCatalogStore.getState().preferences,
    {
      originalLanguage: String(row.payload.info.original_language || ''),
      blocked,
    },
  );
  return !selected.length && field === 'seasonPoster'
    ? workImages(row, 'poster')
    : selected;
}
export type CatalogSource = {
  id: string | number;
  provider: string;
  path: string;
  availability: string;
  info: Record<string, unknown>;
};
export type CatalogEpisode = {
  number: number;
  title?: string;
  synopsis?: string;
  thumbnail?: unknown;
  metadataSources?: Record<string, Record<string, unknown>>;
  playbackSources?: Array<{
    provider: string;
    titleId: string | number;
    season: number;
    episode: number;
    episodeId: string | number;
    availability: string;
  }>;
};
export function sourceLink(source: CatalogSource): string {
  // StreamingUnity resolves its current domain itself. Preserve the stable title path.
  return source.path || String(source.id);
}
export async function playbackEpisodes(
  work: CatalogRecord<Work>,
  source: CatalogRecord<CatalogSource>,
  season: CatalogRecord<{number: number}>,
  includeImages = true,
): Promise<EpisodeLink[]> {
  if (
    source.payload.provider !== 'streamingunity' ||
    source.payload.availability !== 'present'
  ) {
    return [];
  }
  const canonical = await catalogChildren<CatalogEpisode>(
    'episode',
    work.id,
    season.id,
  );
  const sourceSeasons = await catalogChildren<{number: number}>(
    'source_season',
    work.id,
    source.id,
  );
  const neededSeasons = new Set(
    canonical.flatMap(({payload: ep}) =>
      ep.playbackSources
        ? ep.playbackSources
            .filter(
              s =>
                s.provider === source.payload.provider &&
                String(s.titleId) === String(source.payload.id),
            )
            .map(s => s.season)
        : [season.payload.number],
    ),
  );
  const sourceRows = (
    await Promise.all(
      sourceSeasons
        .filter(s => neededSeasons.has(s.payload.number))
        .map(s =>
          catalogChildren<{number: number; id?: string | number}>(
            'source_episode',
            work.id,
            s.id,
          ).then(rows =>
            rows.map(r => ({...r.payload, season: s.payload.number})),
          ),
        ),
    )
  ).flat();
  const episodes: EpisodeLink[] = [];
  for (const {payload: ep} of canonical) {
    const ref = ep.playbackSources?.find(
      s =>
        s.provider === source.payload.provider &&
        String(s.titleId) === String(source.payload.id) &&
        s.availability === 'present',
    );
    if (ep.playbackSources && !ref) {
      continue;
    }
    // Without an explicit composition map, only a source which contributed this
    // canonical episode may supply coordinates. Never guess from the title.
    if (
      !ref &&
      !ep.metadataSources?.[`${source.payload.provider}:${source.payload.id}`]
    ) {
      continue;
    }
    const raw = sourceRows.find(
      r =>
        r.season === (ref?.season ?? season.payload.number) &&
        r.number === (ref?.episode ?? ep.number),
    );
    const id = ref?.episodeId ?? raw?.id;
    if (id == null || !/^\d+$/.test(String(id))) {
      continue;
    }
    const override = ep.metadataSources?.verifiedOverride;
    const blocked =
      !!override &&
      Object.prototype.hasOwnProperty.call(override, 'thumbnail') &&
      override.thumbnail === null;
    const images = includeImages
      ? await workImages(
          work,
          'episodeThumbnail',
          season.payload.number,
          ep.number,
          blocked,
        )
      : [];
    episodes.push({
      title: ep.title || String(ep.number),
      episodeNumber: ep.number,
      sourceEpisodeNumber: ref?.episode ?? raw?.number,
      seasonNumber: season.payload.number,
      synopsis: ep.synopsis || '',
      thumbnail: images[0],
      link: `${sourceLink(source.payload)}::${id}`,
    });
  }
  return episodes;
}

export async function loadCatalogSeason(ref: {
  workId: string;
  sourceId: string;
  seasonId: string;
}): Promise<EpisodeLink[]> {
  const {catalogWork} = await import('./reader');
  const work = await catalogWork(ref.workId);
  const source = (await catalogChildren<CatalogSource>('source', work.id)).find(
    s => s.id === ref.sourceId,
  );
  const season = (
    await catalogChildren<{number: number}>('season', work.id)
  ).find(s => s.id === ref.seasonId);
  if (!source || !season) {
    throw new Error('catalog.missingWork');
  }
  return playbackEpisodes(work, source, season, false);
}

export async function syncCatalogSeries(
  work: CatalogRecord<Work>,
  source: CatalogRecord<CatalogSource>,
) {
  const revision = useCatalogStore.getState().installed?.revision;
  const {setSeriesCatalog} = await import('../storage/SeriesCompletionStorage');
  const seasons = await catalogChildren<{number: number}>('season', work.id);
  const episodes: EpisodeLink[] = [];
  let complete = true;
  for (const season of seasons) {
    const playable = await playbackEpisodes(work, source, season, false);
    const canonical = await catalogChildren<CatalogEpisode>(
      'episode',
      work.id,
      season.id,
    );
    if (playable.length !== canonical.length) {
      complete = false;
    }
    episodes.push(...playable);
  }
  if (revision === useCatalogStore.getState().installed?.revision) {
    setSeriesCatalog(sourceLink(source.payload), episodes, complete);
  }
}
