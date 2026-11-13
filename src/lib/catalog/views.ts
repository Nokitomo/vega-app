import * as RNFS from '@dr.pogodin/react-native-fs';
import {openCatalogDatabase} from './connection';

// Disposable projections, separate from the publisher's immutable records.
export const catalogViewsFile = (revision: string) =>
  `views-${revision}-1.sqlite`;
const building = new Map<string, Promise<string>>();
type Checkpoint = (progress?: {completed: number; total: number}) => void;

export function ensureCatalogViews(
  sourceFile: string,
  root: string,
  revision: string,
  checkpoint: Checkpoint = () => {},
  lite = false,
): Promise<string> {
  const file = catalogViewsFile(revision);
  const key = `${root}/${file}`;
  const existing = building.get(key);
  if (existing) {
    return existing;
  }
  const task = prepare(sourceFile, root, revision, checkpoint, lite).finally(() =>
    building.delete(key),
  );
  building.set(key, task);
  return task;
}

async function prepare(
  sourceFile: string,
  root: string,
  revision: string,
  checkpoint: Checkpoint,
  lite: boolean,
) {
  const file = catalogViewsFile(revision);
  const target = `${root}/${file}`;
  if (await RNFS.exists(target)) {
    const cached = await openCatalogDatabase(file, root);
    try {
      const meta = await cached.getFirstAsync<{
        revision: string;
        count: number;
      }>('SELECT revision,count FROM ready');
      const count = await cached.getFirstAsync<{n: number}>(
        'SELECT count(*) n FROM works',
      );
      if (meta?.revision === revision && meta.count === count?.n) {
        return file;
      }
    } catch {
      // An interrupted or incompatible derived cache can always be rebuilt.
    } finally {
      await cached.closeAsync();
    }
    await RNFS.unlink(target);
  }
  checkpoint();
  const temporary = `${file}.building`;
  const path = `${root}/${temporary}`;
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
  if (await RNFS.exists(`${path}-journal`)) {
    await RNFS.unlink(`${path}-journal`);
  }
  const db = await openCatalogDatabase(temporary, root);
  let closed = false;
  try {
    await db.execAsync(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=NORMAL;
      PRAGMA cache_size=-8192; PRAGMA temp_store=FILE; PRAGMA trusted_schema=OFF;
      CREATE TABLE works(id TEXT PRIMARY KEY,type TEXT,year INTEGER,title,added,views REAL,genres TEXT);
      CREATE TABLE image_rules(field TEXT,scope TEXT,source TEXT,language TEXT);
      CREATE TABLE ready(revision TEXT,count INTEGER);
      CREATE TABLE view_input(id TEXT PRIMARY KEY,payload TEXT);`);
    await db.runAsync(
      'ATTACH DATABASE ? AS published',
      `${root}/${sourceFile}`,
    );
    const source = await db.getAllAsync<{key: string; value: string}>(
      "SELECT key,value FROM published.metadata WHERE key IN ('revision','activeCount')",
    );
    const meta = Object.fromEntries(
      source.map(row => [row.key, JSON.parse(row.value)]),
    );
    if (meta.revision !== revision) {
      throw new Error('catalog.invalidDatabase');
    }
    checkpoint();
    let total = 1;
    if (lite) {
      await db.execAsync(`INSERT INTO works
        SELECT id,json_extract(info,'$.type'),CAST(json_extract(info,'$.year') AS INTEGER),
          coalesce(json_extract(info,'$.title'),json_extract(info,'$.name')),
          json_extract(info,'$.created_at'),
          CAST(coalesce(json_extract(info,'$.views'),json_extract(info,'$.views_count'),0) AS REAL),
          coalesce(json_extract(info,'$.genres'),'[]')
        FROM published.works WHERE active=1;
        INSERT INTO image_rules SELECT field,scope,source,language FROM published.image_rules;
        DROP TABLE view_input;`);
    } else {
      const maximum = await db.getFirstAsync<{n: number}>(
        'SELECT coalesce(max(rowid),0) n FROM published.records',
      );
      if (!maximum || !Number.isSafeInteger(maximum.n) || maximum.n < 0) {
        throw new Error('catalog.invalidDatabase');
      }
      const batch = 5000;
      total = Math.ceil(maximum.n / batch) + 1;
      // One sequential pass over physical rows. Sparse kind indexes otherwise
      // cause expensive random I/O on a large mobile database. Each bounded batch
      // yields to JS so cancellation and foreground checks remain responsive.
      for (let after = 0; after < maximum.n; after += batch) {
        checkpoint({completed: Math.floor(after / batch), total});
        await db.runAsync(
          `INSERT OR IGNORE INTO view_input SELECT
          CASE WHEN kind='work' THEN id ELSE 'rule:' || json_array(json_extract(payload,'$.field'),json_extract(payload,'$.scope'),json_extract(payload,'$.source'),json_extract(payload,'$.language')) END,
          CASE WHEN kind='work' THEN json_array(
            json_extract(payload,'$.info.type'),CAST(json_extract(payload,'$.info.year') AS INTEGER),
            coalesce(json_extract(payload,'$.info.title'),json_extract(payload,'$.info.name')),
            json_extract(payload,'$.info.created_at'),
            CAST(coalesce(json_extract(payload,'$.info.views'),json_extract(payload,'$.info.views_count'),0) AS REAL),
            coalesce(json_extract(payload,'$.info.genres'),'[]') || '') END
          FROM published.records NOT INDEXED WHERE rowid>? AND rowid<=? AND
          ((kind='work' AND json_extract(payload,'$.active')=1) OR
           (kind='artwork_assignment' AND json_extract(payload,'$.eligible')=1))`,
          after,
          after + batch,
        );
      }
      checkpoint({completed: total - 1, total});
      await db.execAsync(`INSERT INTO works SELECT id,
        json_extract(payload,'$[0]'),json_extract(payload,'$[1]'),json_extract(payload,'$[2]'),
        json_extract(payload,'$[3]'),json_extract(payload,'$[4]'),json_extract(payload,'$[5]')
        FROM view_input WHERE payload IS NOT NULL;
        INSERT INTO image_rules SELECT json_extract(substr(id,6),'$[0]'),json_extract(substr(id,6),'$[1]'),
          json_extract(substr(id,6),'$[2]'),json_extract(substr(id,6),'$[3]') FROM view_input WHERE payload IS NULL;
        DROP TABLE view_input;`);
    }
    await db.execAsync(`
      CREATE INDEX works_added ON works(added DESC,id);
      CREATE INDEX works_type_added ON works(type,added DESC,id);
      CREATE INDEX works_views ON works(views DESC,id);
      CREATE INDEX works_title ON works(title COLLATE NOCASE,id);
      CREATE INDEX works_year ON works(year DESC,id);`);
    checkpoint({completed: total, total});
    const count = await db.getFirstAsync<{n: number}>(
      'SELECT count(*) n FROM works',
    );
    if (!count || count.n !== meta.activeCount) {
      throw new Error('catalog.invalidDatabase');
    }
    await db.runAsync('INSERT INTO ready VALUES(?,?)', revision, count.n);
    await db.execAsync('DETACH DATABASE published;');
    await db.closeAsync();
    closed = true;
    checkpoint();
    await RNFS.moveFile(path, target);
    return file;
  } finally {
    try {
      if (!closed) {
        await db.closeAsync();
      }
    } finally {
      if (await RNFS.exists(path)) {
        await RNFS.unlink(path);
      }
      if (await RNFS.exists(`${path}-journal`)) {
        await RNFS.unlink(`${path}-journal`);
      }
    }
  }
}
