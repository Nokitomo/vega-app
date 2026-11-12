import {
  openDatabaseAsync,
  type SQLiteDatabase,
  type SQLiteBindValue,
} from 'expo-sqlite';
import {catalogNative} from './native';
import {useCatalogStore} from './store';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {registerCatalogIdentity} from './identity';
import type {
  Artwork,
  CatalogRecord,
  CatalogSection,
  ImageField,
  Work,
} from './types';

let connection: {file: string; db: Promise<SQLiteDatabase>} | undefined;
let readers = 0;
let retiring: Array<{file: string; db: Promise<SQLiteDatabase>}> = [];
async function acquire(): Promise<SQLiteDatabase> {
  const installed = useCatalogStore.getState().installed;
  if (!installed) {
    throw new Error('catalog.notInstalled');
  }
  if (connection?.file !== installed.file) {
    if (connection) {
      retiring.push(connection);
    }
    const db = catalogNative()
      .root()
      .then(async directory => {
        const opened = await openDatabaseAsync(
          installed.file,
          {useNewConnection: true},
          directory,
        );
        await opened.execAsync(
          'PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA cache_size=-8192;',
        );
        return opened;
      });
    connection = {file: installed.file, db};
  }
  return connection.db;
}
export async function readCatalog<T>(
  fn: (db: SQLiteDatabase) => Promise<T>,
): Promise<T> {
  readers++;
  try {
    return await fn(await acquire());
  } finally {
    readers--;
    if (!readers && retiring.length) {
      const closing = retiring;
      retiring = [];
      await Promise.all(
        closing.map(async p => {
          await (await p.db).closeAsync();
          const path = `${await catalogNative().root()}/${p.file}`;
          if (await RNFS.exists(path)) {
            await RNFS.unlink(path);
          }
        }),
      );
    }
  }
}
export async function closeCatalog(): Promise<void> {
  if (readers) {
    throw new Error('catalog.busy');
  }
  if (connection) {
    await (await connection.db).closeAsync();
    connection = undefined;
  }
}
export async function cleanupDormantCatalogs(): Promise<void> {
  const root = await catalogNative().root();
  const keep = new Set([
    useCatalogStore.getState().installed?.file,
    connection?.file,
    ...retiring.map(r => r.file),
  ]);
  for (const file of await RNFS.readDir(root)) {
    const base = file.name.replace(/-journal$/, '');
    if (
      /^catalog-[a-f0-9-]+\.sqlite(?:-journal)?$/.test(file.name) &&
      !keep.has(base)
    ) {
      await RNFS.unlink(file.path);
    }
  }
}
const unpack = <T>(r: {id: string; payload: string}): CatalogRecord<T> => ({
  id: r.id,
  payload: JSON.parse(r.payload),
});
export async function catalogWork(id: string): Promise<CatalogRecord<Work>> {
  return readCatalog(async db => {
    const seen = new Set<string>();
    while (!seen.has(id) && seen.size < 32) {
      seen.add(id);
      const r = await db.getFirstAsync<{id: string; payload: string}>(
        "SELECT id,payload FROM records WHERE id=? AND kind='work'",
        id,
      );
      if (!r) {
        break;
      }
      const work = unpack<Work>(r);
      if (!work.payload.replacedBy) {
        if (seen.size > 1) {
          registerCatalogIdentity(
            {catalogId: 'cinema', workId: id},
            [...seen],
            [],
          );
        }
        return work;
      }
      id = work.payload.replacedBy.startsWith('cinema:')
        ? work.payload.replacedBy
        : 'cinema:' + work.payload.replacedBy;
    }
    throw new Error('catalog.missingWork');
  });
}
export async function catalogChildren<T>(
  kind: 'season' | 'episode' | 'source' | 'source_season' | 'source_episode',
  work: string,
  parent?: string,
): Promise<CatalogRecord<T>[]> {
  return readCatalog(async db =>
    (
      await db.getAllAsync<{id: string; payload: string}>(
        `SELECT id,payload FROM records WHERE work_id=? AND kind=? ${parent ? 'AND parent_id=?' : ''} ORDER BY CAST(json_extract(payload,'$.number') AS REAL),id`,
        ...(parent ? [work, kind, parent] : [work, kind]),
      )
    ).map(unpack<T>),
  );
}
export async function catalogImages(
  work: string,
  field: ImageField,
  season?: number,
  episode?: number,
): Promise<Artwork[]> {
  const scope =
    field === 'seasonPoster'
      ? 'season'
      : field === 'episodeThumbnail'
        ? 'episode'
        : 'work';
  const role =
    field === 'seasonPoster'
      ? 'poster'
      : field === 'episodeThumbnail'
        ? 'thumbnail'
        : field;
  return readCatalog(async db =>
    (
      await db.getAllAsync<{id: string; payload: string; url: string}>(
        `SELECT a.id,a.payload,json_extract(i.payload,'$.url') url FROM records a JOIN records i ON i.id=a.artwork_id
     WHERE a.kind='artwork_assignment' AND a.work_id=? AND json_extract(a.payload,'$.eligible')=1
     AND json_extract(a.payload,'$.scope')=? AND json_extract(a.payload,'$.field')=?
     AND json_extract(a.payload,'$.season') IS ? AND json_extract(a.payload,'$.episode') IS ?`,
        work,
        scope,
        role,
        season ?? null,
        episode ?? null,
      )
    ).map(r => ({...JSON.parse(r.payload), id: r.id, url: r.url})),
  );
}
export async function catalogImageRules(): Promise<Record<string, string[]>> {
  return readCatalog(async db => {
    const rows = await db.getAllAsync<{
      field: string;
      scope: string;
      source: string;
      language: string | null;
    }>(
      `SELECT DISTINCT json_extract(payload,'$.field') field,json_extract(payload,'$.scope') scope,
       json_extract(payload,'$.source') source,json_extract(payload,'$.language') language
       FROM records WHERE kind='artwork_assignment' AND json_extract(payload,'$.eligible')=1`,
    );
    const result: Record<string, string[]> = {};
    rows.forEach(r => {
      const field =
        r.scope === 'season' && r.field === 'poster'
          ? 'seasonPoster'
          : r.scope === 'episode' && r.field === 'thumbnail'
            ? 'episodeThumbnail'
            : r.scope === 'work'
              ? r.field
              : '';
      if (!field) {
        return;
      }
      const rules = (result[field] ||= []);
      for (const rule of [
        `${r.source}:${r.language ?? 'unknown'}`,
        `${r.source}:*`,
        ...(r.source === 'tmdb' ? ['tmdb:original'] : []),
      ]) {
        if (!rules.includes(rule)) {
          rules.push(rule);
        }
      }
    });
    return result;
  });
}
export async function catalogList(
  section: CatalogSection,
  offset = 0,
  search?: string,
): Promise<CatalogRecord<Work>[]> {
  const params: SQLiteBindValue[] = [];
  const where = ["w.kind='work'", "json_extract(w.payload,'$.active')=1"];
  if (section.type) {
    where.push("json_extract(w.payload,'$.info.type')=?");
    params.push(section.type);
  }
  if (section.fromYear) {
    where.push("CAST(json_extract(w.payload,'$.info.year') AS INTEGER)>=?");
    params.push(section.fromYear);
  }
  if (section.toYear) {
    where.push("CAST(json_extract(w.payload,'$.info.year') AS INTEGER)<=?");
    params.push(section.toYear);
  }
  for (const genre of section.genres) {
    where.push(
      "EXISTS(SELECT 1 FROM json_each(w.payload,'$.info.genres') g WHERE CASE WHEN g.type='object' THEN json_extract(g.value,'$.name') ELSE g.value END=?)",
    );
    params.push(genre);
  }
  if (search !== undefined) {
    const tokens = search.trim().split(/\s+/).filter(Boolean).slice(0, 12);
    if (!tokens.length) {
      return [];
    }
    where.push('w.id IN (SELECT id FROM search WHERE search MATCH ?)');
    params.push(
      tokens.map(t => '"' + t.replace(/"/g, '""') + '"*').join(' AND '),
    );
  }
  const order = {
    title:
      "coalesce(json_extract(w.payload,'$.info.title'),json_extract(w.payload,'$.info.name')) COLLATE NOCASE",
    year: "CAST(json_extract(w.payload,'$.info.year') AS INTEGER) DESC",
    added: "json_extract(w.payload,'$.info.created_at') DESC",
    views:
      "CAST(coalesce(json_extract(w.payload,'$.info.views'),json_extract(w.payload,'$.info.views_count'),0) AS REAL) DESC",
  }[section.sort];
  return readCatalog(async db =>
    (
      await db.getAllAsync<{id: string; payload: string}>(
        `SELECT w.id,w.payload FROM records w WHERE ${where.join(' AND ')} ORDER BY ${order},w.id LIMIT 30 OFFSET ?`,
        ...params,
        Math.max(0, Math.floor(offset)),
      )
    ).map(unpack<Work>),
  );
}
