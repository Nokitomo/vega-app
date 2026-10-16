import * as SQLite from 'expo-sqlite';
import {extensionStorage} from './extensionStorage';

export type MetadataRecord<T> = {
  value: T;
  updatedAt: number;
  checkedAt: number;
  providerVersion: string;
};

type MetadataRow = {
  value_json: string;
  updated_at: number;
  checked_at: number;
  provider_version: string;
};

let database: SQLite.SQLiteDatabase | undefined;
let initializationFailed = false;

const providerNamespace = (provider: string): string => {
  if (!provider) {
    return '';
  }
  const installed = extensionStorage
    .getInstalledProviders()
    .find(item => item.value === provider);
  return `${
    installed?.source?.author || extensionStorage.getProviderSource()?.author ||
    'default'
  }:${provider}`;
};

const openDatabase = (): SQLite.SQLiteDatabase | undefined => {
  if (database || initializationFailed) {
    return database;
  }
  try {
    const opened = SQLite.openDatabaseSync('vega-metadata.db');
    opened.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS metadata_records (
        kind TEXT NOT NULL,
        provider TEXT NOT NULL,
        identity TEXT NOT NULL,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        checked_at INTEGER NOT NULL,
        provider_version TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (kind, provider, identity)
      );
    `);
    database = opened;
  } catch (error) {
    initializationFailed = true;
    console.warn('Metadata database unavailable; using existing cache:', error);
  }
  return database;
};

/** Stable identity across provider domain and package revisions. */
export const metadataIdentity = (provider: string, link: string): string => {
  const value = String(link || '').trim();
  if (provider === 'animeunity') {
    const id = value.match(/\/(?:anime|info_api)\/(\d+)(?:\D|$)/i)?.[1];
    if (id) {
      return `anime:${id}`;
    }
  }
  if (provider === 'streamingunity') {
    const id = value.match(/\/titles\/(\d+)(?:\D|$)/i)?.[1];
    if (id) {
      const season = value.match(/\/season-(\d+)(?:\D|$)/i)?.[1];
      return season ? `title:${id}:season:${season}` : `title:${id}`;
    }
  }
  return value;
};

export const readMetadata = <T>(
  kind: string,
  provider: string,
  identity: string,
): MetadataRecord<T> | undefined => {
  const db = openDatabase();
  if (!db || !identity) {
    return undefined;
  }
  try {
    const row = db.getFirstSync<MetadataRow>(
      'SELECT value_json, updated_at, checked_at, provider_version FROM metadata_records WHERE kind = ? AND provider = ? AND identity = ?',
      [kind, providerNamespace(provider), metadataIdentity(provider, identity)],
    );
    if (!row) {
      return undefined;
    }
    return {
      value: JSON.parse(row.value_json) as T,
      updatedAt: row.updated_at,
      checkedAt: row.checked_at,
      providerVersion: row.provider_version,
    };
  } catch (error) {
    console.warn('Metadata database read failed:', error);
    return undefined;
  }
};

export const writeMetadata = <T>(
  kind: string,
  provider: string,
  identity: string,
  value: T,
  providerVersion = '',
): void => {
  const db = openDatabase();
  if (!db || !identity) {
    return;
  }
  const now = Date.now();
  try {
    db.runSync(
      `INSERT INTO metadata_records
       (kind, provider, identity, value_json, updated_at, checked_at, provider_version)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(kind, provider, identity) DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at,
         checked_at = excluded.checked_at,
         provider_version = excluded.provider_version`,
      [
        kind,
        providerNamespace(provider),
        metadataIdentity(provider, identity),
        JSON.stringify(value),
        now,
        now,
        providerVersion,
      ],
    );
  } catch (error) {
    console.warn('Metadata database write failed:', error);
  }
};

export const markMetadataChecked = (
  kind: string,
  provider: string,
  identity: string,
  providerVersion?: string,
): void => {
  const db = openDatabase();
  if (!db || !identity) {
    return;
  }
  try {
    db.runSync(
      `UPDATE metadata_records SET checked_at = ?,
       provider_version = COALESCE(?, provider_version)
       WHERE kind = ? AND provider = ? AND identity = ?`,
      [
        Date.now(),
        providerVersion ?? null,
        kind,
        providerNamespace(provider),
        metadataIdentity(provider, identity),
      ],
    );
  } catch (error) {
    console.warn('Metadata database check timestamp update failed:', error);
  }
};

export const removeMetadata = (
  kind: string,
  provider: string,
  identity: string,
): void => {
  const db = openDatabase();
  if (!db || !identity) {
    return;
  }
  try {
    db.runSync(
      'DELETE FROM metadata_records WHERE kind = ? AND provider = ? AND identity = ?',
      [kind, providerNamespace(provider), metadataIdentity(provider, identity)],
    );
  } catch (error) {
    console.warn('Metadata database delete failed:', error);
  }
};

/** The user's explicit Clear Cache action also clears durable metadata. */
export const clearMetadataDatabase = (): void => {
  const db = openDatabase();
  if (!db) {return;}
  try {
    db.execSync('DELETE FROM metadata_records;');
  } catch (error) {
    console.warn('Metadata database clear failed:', error);
  }
};
