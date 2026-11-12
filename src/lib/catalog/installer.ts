import * as RNFS from '@dr.pogodin/react-native-fs';
import * as Crypto from 'expo-crypto';
import {AppState} from 'react-native';
import {openDatabaseAsync, type SQLiteDatabase} from 'expo-sqlite';
import {catalogNative} from './native';
import {parseManifest, planDownload, recordKinds} from './manifest';
import {useCatalogStore} from './store';
import {closeCatalog, readCatalog} from './reader';
import type {CatalogManifest} from './types';
import i18n from '../../i18n';

let installing: Promise<void> | undefined;
const reserve = 256 * 1024 ** 2;
const hash = (value: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
const ensureForeground = () => {
  if (AppState.currentState !== 'active') {
    throw new Error('catalog.foregroundRequired');
  }
};

async function metadata(db: SQLiteDatabase): Promise<Record<string, any>> {
  return Object.fromEntries(
    (
      await db.getAllAsync<{key: string; value: string}>(
        'SELECT key,value FROM metadata',
      )
    ).map(r => [r.key, JSON.parse(r.value)]),
  );
}
async function verify(
  db: SQLiteDatabase,
  expected: Pick<CatalogManifest, 'revision' | 'counts' | 'activeCount'>,
  logical: boolean,
) {
  const meta = await metadata(db);
  if (
    meta.catalogId !== 'cinema' ||
    meta.schemaVersion !== 1 ||
    meta.minimumReaderVersion !== 1 ||
    meta.validationOnly !== false ||
    meta.revision !== expected.revision ||
    meta.activeCount !== expected.activeCount
  ) {
    throw new Error('catalog.invalidDatabase');
  }
  const version = await db.getFirstAsync<{user_version: number}>(
    'PRAGMA user_version',
  );
  const columns = await db.getAllAsync<{name: string}>(
    'PRAGMA table_info(records)',
  );
  const relations = await db.getAllAsync<{
    table: string;
    from: string;
    to: string;
  }>('PRAGMA foreign_key_list(records)');
  const trigger = await db.getFirstAsync(
    "SELECT name FROM sqlite_master WHERE type='trigger' LIMIT 1",
  );
  const searchSchema = await db.getFirstAsync<{sql: string}>(
    "SELECT sql FROM sqlite_master WHERE name='search' AND type='table'",
  );
  if (
    version?.user_version !== 1 ||
    columns.map(c => c.name).join(',') !==
      'id,kind,work_id,parent_id,artwork_id,payload,hash' ||
    relations.length !== 3 ||
    !['work_id', 'parent_id', 'artwork_id'].every(from =>
      relations.some(
        r => r.table === 'records' && r.to === 'id' && r.from === from,
      ),
    ) ||
    trigger ||
    !/\bUSING\s+fts5\s*\(/i.test(searchSchema?.sql || '') ||
    [...recordKinds].some(
      k => (meta.counts?.[k] || 0) !== (expected.counts[k] || 0),
    )
  ) {
    throw new Error('catalog.invalidDatabase');
  }
  const integrity = await db.getFirstAsync<Record<string, string>>(
    'PRAGMA integrity_check',
  );
  if (
    !integrity ||
    Object.values(integrity)[0] !== 'ok' ||
    (await db.getFirstAsync('PRAGMA foreign_key_check'))
  ) {
    throw new Error('catalog.invalidDatabase');
  }
  const counts = await db.getAllAsync<{kind: string; count: number}>(
    'SELECT kind,count(*) count FROM records GROUP BY kind',
  );
  if (
    counts.some(
      r => !recordKinds.has(r.kind) || r.count !== expected.counts[r.kind],
    ) ||
    [...recordKinds].some(
      k =>
        (counts.find(r => r.kind === k)?.count || 0) !==
        (expected.counts[k] || 0),
    )
  ) {
    throw new Error('catalog.invalidDatabase');
  }
  const search = await db.getFirstAsync<{n: number}>(
    'SELECT count(*) n FROM search',
  );
  if (search?.n !== expected.activeCount) {
    throw new Error('catalog.invalidDatabase');
  }
  await db.execAsync("INSERT INTO search(search) VALUES('integrity-check');");
  if (logical) {
    const native = catalogNative();
    await native.beginHash('cinema-schema-1');
    let batch: string[] = [];
    for await (const row of db.getEachAsync<{hash: string}>(
      'SELECT hash FROM records NOT INDEXED ORDER BY id COLLATE BINARY',
    )) {
      batch.push(row.hash);
      if (batch.length === 2000) {
        ensureForeground();
        await native.appendHash(batch);
        batch = [];
      }
    }
    await native.appendHash(batch);
    if ((await native.finishHash()) !== expected.revision) {
      throw new Error('catalog.invalidDatabase');
    }
  }
}
async function applyDelta(
  db: SQLiteDatabase,
  file: string,
  from: string,
  to: string,
) {
  const native = catalogNative();
  await native.openLines(file);
  let header: any;
  try {
    await db.withExclusiveTransactionAsync(async tx => {
      await tx.execAsync('PRAGMA defer_foreign_keys=ON;');
      const statement = await tx.prepareAsync(
        'INSERT INTO records VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,work_id=excluded.work_id,parent_id=excluded.parent_id,artwork_id=excluded.artwork_id,payload=excluded.payload,hash=excluded.hash',
      );
      try {
        for (;;) {
          ensureForeground();
          const lines = await native.readLines();
          if (!lines.length) {
            break;
          }
          for (const line of lines) {
            const change = JSON.parse(line);
            if (!header) {
              header = change;
              if (
                header.format !== 'vega-cinema-delta-v1' ||
                header.baseRevision !== from ||
                header.target?.revision !== to ||
                header.target.catalogId !== 'cinema' ||
                header.target.schemaVersion !== 1 ||
                header.target.validationOnly !== false
              ) {
                throw new Error('catalog.invalidDelta');
              }
            } else if (
              Object.keys(change).length === 1 &&
              Array.isArray(change.upsert)
            ) {
              const row = change.upsert;
              if (
                row.length !== 7 ||
                !recordKinds.has(row[1]) ||
                typeof row[0] !== 'string' ||
                typeof row[5] !== 'string' ||
                !row
                  .slice(2, 5)
                  .every((v: unknown) => v === null || typeof v === 'string') ||
                (await hash(JSON.stringify(row.slice(0, 6)))) !== row[6]
              ) {
                throw new Error('catalog.invalidDelta');
              }
              JSON.parse(row[5]);
              const result = await statement.executeAsync(row);
              await result.getAllAsync();
            } else if (
              Object.keys(change).length === 1 &&
              typeof change.delete === 'string'
            ) {
              await tx.runAsync(
                'DELETE FROM records WHERE id=?',
                change.delete,
              );
            } else {
              throw new Error('catalog.invalidDelta');
            }
          }
        }
      } finally {
        await statement.finalizeAsync();
      }
      if (!header) {
        throw new Error('catalog.invalidDelta');
      }
      await tx.execAsync(`DELETE FROM search; INSERT INTO search SELECT id,
        coalesce(json_extract(payload,'$.info.title'),json_extract(payload,'$.info.name'),''),
        coalesce(json_extract(payload,'$.info.original_name'),json_extract(payload,'$.info.original_title'),''),
        coalesce(json_extract(payload,'$.info.synopsis'),'') FROM records WHERE kind='work' AND json_extract(payload,'$.active')=1;
        DELETE FROM metadata;`);
      for (const [key, value] of Object.entries(header.target)) {
        await tx.runAsync(
          'INSERT INTO metadata VALUES(?,?)',
          key,
          JSON.stringify(value),
        );
      }
    });
    await verify(db, header.target, true);
  } finally {
    await native.closeLines();
  }
}

export async function configureCatalogTransfer() {
  const {preferences: p, installed} = useCatalogStore.getState();
  await catalogNative().configure(
    !!installed && p.automatic,
    p.cellular,
    installed?.revision || '',
    i18n.t('catalog.downloadTitle'),
  );
}
export async function startCatalogDownload() {
  await configureCatalogTransfer();
  await catalogNative().start(false);
}
export function installPendingCatalog(): Promise<void> {
  if (installing) {
    return installing;
  }
  installing = install().finally(() => {
    installing = undefined;
  });
  return installing;
}
async function install() {
  ensureForeground();
  const native = catalogNative();
  const raw = await native.pending();
  if (!raw) {
    return;
  }
  const m = parseManifest(JSON.parse(raw));
  const {installed} = useCatalogStore.getState();
  const assets = planDownload(m, installed?.revision);
  if (!assets.length) {
    await native.acknowledge();
    return;
  }
  const root = await native.root();
  const snapshot =
    assets[0].name === m.snapshot.name &&
    assets[0].sha256 === m.snapshot.sha256;
  const required = m.snapshot.uncompressedBytes * (snapshot ? 1 : 3) + reserve;
  if ((await RNFS.getFSInfo()).freeSpace < required) {
    throw new Error('catalog.noSpace');
  }
  const file = `catalog-${m.revision}-${Date.now().toString(16)}.sqlite`;
  const path = `${root}/${file}`;
  let db: SQLiteDatabase | undefined;
  let activated = false;
  useCatalogStore
    .getState()
    .setTransfer({status: 'installing', bytes: 0, total: 0});
  try {
    for (const asset of assets) {
      const compressed = `${root}/${asset.sha256}.gz`;
      if (
        Number((await RNFS.stat(compressed)).size) !== asset.bytes ||
        (await RNFS.hash(compressed, 'sha256')) !== asset.sha256
      ) {
        throw new Error('catalog.checksum');
      }
    }
    if (snapshot) {
      await native.gunzip(
        `${root}/${m.snapshot.sha256}.gz`,
        path,
        m.snapshot.uncompressedBytes,
      );
      if (
        Number((await RNFS.stat(path)).size) !== m.snapshot.uncompressedBytes ||
        (await RNFS.hash(path, 'sha256')) !== m.snapshot.uncompressedSha256
      ) {
        throw new Error('catalog.checksum');
      }
    } else {
      if (!installed) {
        throw new Error('catalog.notInstalled');
      }
      // Active generations are query-only and never have a WAL writer.
      await RNFS.copyFile(`${root}/${installed.file}`, path);
    }
    ensureForeground();
    db = await openDatabaseAsync(file, {useNewConnection: true}, root);
    await db.execAsync(
      'PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF; PRAGMA journal_mode=DELETE; PRAGMA cache_size=-8192; PRAGMA temp_store=FILE;',
    );
    if (snapshot) {
      await verify(db, m, false);
    } else {
      for (const asset of assets) {
        const delta = m.deltas.find(d => d.sha256 === asset.sha256)!;
        const lines = `${root}/delta.ndjson`;
        try {
          await native.gunzip(
            `${root}/${asset.sha256}.gz`,
            lines,
            m.snapshot.uncompressedBytes * 2,
          );
          if ((await metadata(db)).revision !== delta.fromRevision) {
            throw new Error('catalog.invalidDelta');
          }
          await applyDelta(db, lines, delta.fromRevision, delta.toRevision);
        } finally {
          if (await RNFS.exists(lines)) {
            await RNFS.unlink(lines);
          }
        }
      }
    }
    await db.closeAsync();
    db = undefined;
    ensureForeground();
    useCatalogStore
      .getState()
      .setInstalled({
        revision: m.revision,
        file,
        bytes: Number((await RNFS.stat(path)).size),
        installedAt: Date.now(),
      });
    activated = true;
    // Open the newly selected generation so retiring readers close and release
    // their files. Failure of housekeeping must not roll back a valid pointer.
    await readCatalog(async active => {
      await active.getFirstAsync('SELECT key FROM metadata LIMIT 1');
    }).catch(() => {});
    await native.acknowledge();
    await configureCatalogTransfer();
    useCatalogStore
      .getState()
      .setTransfer({status: 'ready', bytes: 0, total: 0});
  } catch (error) {
    if (
      !snapshot &&
      error instanceof Error &&
      [
        'catalog.invalidDelta',
        'catalog.invalidDatabase',
        'catalog.checksum',
      ].includes(error.message)
    ) {
      await native.cancel();
      await native.start(true);
    }
    throw error;
  } finally {
    await db?.closeAsync();
    if (!activated && (await RNFS.exists(path))) {
      await RNFS.unlink(path);
    }
  }
}
export async function removeCatalog() {
  if (installing) {
    throw new Error('catalog.busy');
  }
  await catalogNative().cancel();
  await closeCatalog();
  useCatalogStore.getState().setInstalled(null);
  useCatalogStore
    .getState()
    .setPreferences({
      ...useCatalogStore.getState().preferences,
      selected: false,
    });
  await configureCatalogTransfer();
  const root = await catalogNative().root();
  for (const file of await RNFS.readDir(root)) {
    if (
      /^(catalog-[a-f0-9-]+\.sqlite(?:-journal)?|[a-f0-9]{64}\.gz(?:\.part)?|delta\.ndjson)$/.test(
        file.name,
      )
    ) {
      await RNFS.unlink(file.path);
    }
  }
}
