import * as RNFS from '@dr.pogodin/react-native-fs';
import * as Crypto from 'expo-crypto';
import {AppState} from 'react-native';
import {type SQLiteDatabase} from 'expo-sqlite';
import {openCatalogDatabase} from './connection';
import {catalogNative} from './native';
import {parseManifest, planDownload, recordKinds} from './manifest';
import {useCatalogStore} from './store';
import {closeCatalog, readCatalog, cleanupDormantCatalogs} from './reader';
import type {CatalogManifest, TransferState} from './types';
import {settingsStorage} from '../storage/SettingsStorage';
import {ensureCatalogViews} from './views';
import i18n from '../../i18n';

let installing: Promise<void> | undefined;
let cancellationRequested = false;
const PAUSED_KEY = 'catalog-preparation-paused:v1';
export const isCatalogPreparationPaused = () =>
  settingsStorage.getBool(PAUSED_KEY);
const phase = (value: TransferState['phase'], bytes = 0, total = 0) => {
  const state = useCatalogStore.getState();
  state.setTransfer({
    ...state.transfer,
    status: 'installing',
    phase: value,
    bytes,
    total,
    updatedAt: Date.now(),
  });
};
const reserve = 256 * 1024 ** 2;
const hash = (value: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
const ensureForeground = () => {
  if (cancellationRequested) {
    throw new Error('catalog.preparationPaused');
  }
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
  // Snapshots are publisher-validated and byte-for-byte SHA-256 verified before
  // opening. Repeating full B-tree/FK scans here costs minutes on mobile devices.
  // Deltas preserve the verified base, validate each upsert hash, enforce FKs in
  // their transaction and verify the complete target logical revision below.
  if (logical) {
    phase(
      'verifyRevision',
      0,
      Object.values(expected.counts).reduce((n, count) => n + count, 0),
    );
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
  }
  const search = await db.getFirstAsync<{n: number}>(
    'SELECT count(*) n FROM search',
  );
  if (search?.n !== expected.activeCount) {
    throw new Error('catalog.invalidDatabase');
  }
  if (logical) {
    const native = catalogNative();
    await native.beginHash('cinema-schema-1');
    let after: string | undefined;
    let verified = 0;
    // Project the hashes sequentially before paging. Following the published
    // TEXT primary-key index directly would cause millions of random lookups
    // into large JSON rows. TEMP stays on disk and never changes active data.
    await db.execAsync(`CREATE TEMP TABLE catalog_revision_hashes(
      id TEXT PRIMARY KEY COLLATE BINARY,hash TEXT NOT NULL) WITHOUT ROWID;
      INSERT INTO catalog_revision_hashes SELECT id,hash FROM records NOT INDEXED ORDER BY id COLLATE BINARY;`);
    try {
      for (;;) {
        ensureForeground();
        const rows: Array<{id: string; hash: string}> =
          after === undefined
            ? await db.getAllAsync(
                'SELECT id,hash FROM catalog_revision_hashes ORDER BY id COLLATE BINARY LIMIT 2000',
              )
            : await db.getAllAsync(
                'SELECT id,hash FROM catalog_revision_hashes WHERE id COLLATE BINARY > ? ORDER BY id COLLATE BINARY LIMIT 2000',
                after,
              );
        if (!rows.length) {
          break;
        }
        await native.appendHash(rows.map(row => row.hash));
        verified += rows.length;
        after = rows[rows.length - 1].id;
        phase(
          'verifyRevision',
          verified,
          Object.values(expected.counts).reduce((n, count) => n + count, 0),
        );
      }
      ensureForeground();
      if ((await native.finishHash()) !== expected.revision) {
        throw new Error('catalog.invalidDatabase');
      }
    } finally {
      await db.execAsync('DROP TABLE IF EXISTS temp.catalog_revision_hashes');
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
  phase('applyDelta');
  await native.openLines(file);
  let header: any;
  try {
    // This staging connection has one owner. Use the same connection so the
    // foreign_keys pragma is retained (exclusive helper opens another handle).
    await db.withTransactionAsync(async () => {
      const tx = db;
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
  } catch (error) {
    if (error instanceof Error && /^catalog\.[a-zA-Z]+$/.test(error.message)) {
      throw error;
    }
    // A malformed record or an SQL constraint failure invalidates this delta.
    // The staging copy is discarded and the caller requests a full snapshot.
    throw new Error('catalog.invalidDelta');
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
  settingsStorage.setBool(PAUSED_KEY, false);
  useCatalogStore
    .getState()
    .setTransfer({status: 'queued', bytes: 0, total: 0});
  await configureCatalogTransfer();
  await catalogNative().start(false);
}
export async function resumeCatalogPreparation() {
  settingsStorage.setBool(PAUSED_KEY, false);
  return installPendingCatalog();
}
export async function pauseCatalogPreparation() {
  if (!installing || useCatalogStore.getState().transfer.phase === 'activate') {
    return;
  }
  cancellationRequested = true;
  settingsStorage.setBool(PAUSED_KEY, true);
  phase('stopping');
  await catalogNative().cancelPreparation();
  await installing.catch(() => {});
}
export async function discardCatalogDownload() {
  await pauseCatalogPreparation();
  await catalogNative().cancel();
  settingsStorage.setBool(PAUSED_KEY, false);
  await cleanupDormantCatalogs();
  useCatalogStore.getState().setTransfer({status: 'idle', bytes: 0, total: 0});
}
export function installPendingCatalog(): Promise<void> {
  if (installing) {
    return installing;
  }
  if (isCatalogPreparationPaused()) {
    useCatalogStore.getState().setTransfer({
      status: 'paused',
      bytes: 0,
      total: 0,
      error: 'catalog.preparationPaused',
    });
    return Promise.resolve();
  }
  cancellationRequested = false;
  installing = install()
    .catch(error => {
      const code =
        error instanceof Error && /^catalog\.[a-zA-Z]+$/.test(error.message)
          ? error.message
          : 'catalog.transferFailed';
      const paused =
        code === 'catalog.preparationPaused' ||
        code === 'catalog.foregroundRequired';
      if (paused) {
        settingsStorage.setBool(PAUSED_KEY, true);
      }
      useCatalogStore.getState().setTransfer({
        status: paused ? 'paused' : 'error',
        bytes: 0,
        total: 0,
        error: paused ? 'catalog.preparationPaused' : code,
      });
      if (!paused) {
        throw error;
      }
    })
    .finally(() => {
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
    useCatalogStore
      .getState()
      .setTransfer({status: 'ready', bytes: 0, total: 0});
    return;
  }
  if (!native.prepareFile) {
    throw new Error('catalog.nativeRequired');
  }
  const root = await native.root();
  const snapshot = assets[0].sha256 === m.snapshot.sha256;
  // A deterministic staging path lets a verified snapshot survive an interrupted
  // activation. It is never trusted on resume without a fresh raw SHA-256 check.
  const file = snapshot
    ? `catalog-${m.revision}.sqlite`
    : `catalog-${m.revision}-${Date.now().toString(16)}.sqlite`;
  const path = `${root}/${file}`;
  let db: SQLiteDatabase | undefined;
  let activated = false;
  let reusableSnapshot = false;
  let retainSnapshot = false;
  let ended = false;
  let progressTotalKnown = true;
  await native.beginPreparation();
  useCatalogStore.getState().setTransfer({
    status: 'installing',
    phase: 'hashDownload',
    bytes: 0,
    total: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  });
  const subscription = AppState.addEventListener('change', value => {
    if (!activated && value !== 'active') {
      pauseCatalogPreparation().catch(() => {});
    }
  });
  const timer = setInterval(() => {
    native
      .preparationStatus()
      .then(progress => {
        const state = useCatalogStore.getState();
        if (
          !ended &&
          !cancellationRequested &&
          progress.active &&
          state.transfer.status === 'installing' &&
          state.transfer.phase === progress.phase
        ) {
          phase(
            progress.phase,
            progress.bytes,
            progressTotalKnown ? progress.total : 0,
          );
        }
      })
      .catch(() => {});
  }, 500);
  const prepare = async (
    mode: 'hash' | 'extract' | 'copy',
    source: string,
    target: string,
    limit: number,
    label: NonNullable<TransferState['phase']>,
    totalKnown = true,
  ) => {
    ensureForeground();
    progressTotalKnown = totalKnown;
    phase(label, 0, totalKnown ? limit : 0);
    const result = await native.prepareFile(mode, source, target, limit, label);
    ensureForeground();
    return result;
  };
  try {
    if (snapshot && (await RNFS.exists(path))) {
      if (
        Number((await RNFS.stat(path)).size) === m.snapshot.uncompressedBytes
      ) {
        reusableSnapshot =
          (await prepare(
            'hash',
            path,
            '',
            m.snapshot.uncompressedBytes,
            'hashPrepared',
          )) === m.snapshot.uncompressedSha256;
      }
      if (!reusableSnapshot) {
        await RNFS.unlink(path);
      }
    }
    const required =
      (reusableSnapshot
        ? 0
        : m.snapshot.uncompressedBytes * (snapshot ? 1 : 3)) + reserve;
    if ((await RNFS.getFSInfo()).freeSpace < required) {
      throw new Error('catalog.noSpace');
    }
    if (!reusableSnapshot) {
      for (const asset of assets) {
        const compressed = `${root}/${asset.sha256}.gz`;
        if (
          Number((await RNFS.stat(compressed)).size) !== asset.bytes ||
          (await prepare(
            'hash',
            compressed,
            '',
            asset.bytes,
            'hashDownload',
          )) !== asset.sha256
        ) {
          throw new Error('catalog.checksum');
        }
      }
      if (snapshot) {
        const digest = await prepare(
          'extract',
          `${root}/${m.snapshot.sha256}.gz`,
          path,
          m.snapshot.uncompressedBytes,
          'extract',
        );
        if (
          Number((await RNFS.stat(path)).size) !==
            m.snapshot.uncompressedBytes ||
          digest !== m.snapshot.uncompressedSha256
        ) {
          throw new Error('catalog.checksum');
        }
        reusableSnapshot = true;
      } else {
        if (!installed) {
          throw new Error('catalog.notInstalled');
        }
        await prepare(
          'copy',
          `${root}/${installed.file}`,
          path,
          Number((await RNFS.stat(`${root}/${installed.file}`)).size),
          'copyBase',
        );
      }
    }
    ensureForeground();
    phase('validate');
    db = await openCatalogDatabase(file, root);
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
          await prepare(
            'extract',
            `${root}/${asset.sha256}.gz`,
            lines,
            m.snapshot.uncompressedBytes * 2,
            'extract',
            false,
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
      // The last delta header must also agree with the published manifest.
      await verify(db, m, false);
    }
    ensureForeground();
    phase('index');
    let lastIndexProgress = 0;
    await ensureCatalogViews(file, root, m.revision, progress => {
      ensureForeground();
      if (
        progress &&
        (Date.now() - lastIndexProgress >= 500 ||
          progress.completed === progress.total)
      ) {
        phase('index', progress.completed, progress.total);
        lastIndexProgress = Date.now();
      }
    });
    ensureForeground();
    phase('activate');
    await db.closeAsync();
    db = undefined;
    const installedBytes = Number((await RNFS.stat(path)).size);
    ensureForeground();
    useCatalogStore.getState().setInstalled({
      revision: m.revision,
      file,
      bytes: installedBytes,
      installedAt: Date.now(),
    });
    activated = true;
    await readCatalog(async active => {
      await active.getFirstAsync('SELECT key FROM metadata LIMIT 1');
    }).catch(() => {});
    await native.acknowledge();
    await configureCatalogTransfer();
    useCatalogStore
      .getState()
      .setTransfer({status: 'ready', bytes: 0, total: 0});
  } catch (error) {
    retainSnapshot =
      reusableSnapshot &&
      error instanceof Error &&
      ['catalog.preparationPaused', 'catalog.foregroundRequired'].includes(
        error.message,
      );
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
    ended = true;
    clearInterval(timer);
    subscription.remove();
    try {
      await db?.closeAsync();
    } finally {
      if (!activated && !retainSnapshot && (await RNFS.exists(path))) {
        await RNFS.unlink(path);
      }
    }
  }
}
export async function removeCatalog() {
  if (installing) {
    throw new Error('catalog.busy');
  }
  await catalogNative().cancel();
  settingsStorage.setBool(PAUSED_KEY, false);
  await closeCatalog();
  useCatalogStore.getState().setInstalled(null);
  useCatalogStore.getState().setPreferences({
    ...useCatalogStore.getState().preferences,
    selected: false,
  });
  await configureCatalogTransfer();
  const root = await catalogNative().root();
  for (const file of await RNFS.readDir(root)) {
    if (
      /^(catalog-[a-f0-9-]+\.sqlite(?:-journal)?|views-[a-f0-9]{64}-\d+\.sqlite(?:\.building)?(?:-journal)?|[a-f0-9]{64}\.gz(?:\.part)?|delta\.ndjson)$/.test(
        file.name,
      )
    ) {
      await RNFS.unlink(file.path);
    }
  }
  useCatalogStore.getState().setTransfer({status: 'idle', bytes: 0, total: 0});
}
