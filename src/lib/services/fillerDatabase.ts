import {mainStorage} from '../storage';

const METADATA_URL =
  'https://api.github.com/repos/recloudstream/anime-db/contents/anime-db/src/main/resources/animedb.json?ref=master';
const RAW_HOST = 'raw.githubusercontent.com';
const CACHE_KEY = 'fillerDatabase.json.v1';
const SHA_KEY = 'fillerDatabase.sha.v1';
const LAST_CHECK_KEY = 'fillerDatabase.lastCheck.v1';
const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DATABASE_BYTES = 2 * 1024 * 1024;

type FillerMedia = {
  mapping?: {
    anilist_id?: number;
    imdb_id?: string;
    kitsu_id?: number;
    mal_id?: number;
    themoviedb_id?: number;
    season?: {tmdb?: number};
  };
  show: {title: string; filler: number[]};
};

export type FillerLookup = {
  title: string;
  malId?: number;
  anilistId?: number;
  kitsuId?: number;
  imdbId?: string;
  tmdbId?: number;
};

let memoryDatabase: FillerMedia[] | undefined;
let updatePromise: Promise<FillerMedia[] | undefined> | undefined;

const normalizeTitle = (title: string) =>
  title.replace(/[ :\-.!]/g, '').toLowerCase();

export const parseFillerDatabase = (raw: string): FillerMedia[] => {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Filler database is not an array');
  }
  const valid = parsed.filter(
    (item): item is FillerMedia =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as FillerMedia).show?.title === 'string' &&
      Array.isArray((item as FillerMedia).show?.filler) &&
      (item as FillerMedia).show.filler.every(Number.isFinite),
  );
  if (valid.length === 0) {
    throw new Error('Filler database contains no valid entries');
  }
  return valid;
};

const readCachedDatabase = (): FillerMedia[] | undefined => {
  if (memoryDatabase) {
    return memoryDatabase;
  }
  const raw = mainStorage.getString(CACHE_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    memoryDatabase = parseFillerDatabase(raw);
    return memoryDatabase;
  } catch {
    mainStorage.delete(CACHE_KEY);
    mainStorage.delete(SHA_KEY);
    return undefined;
  }
};

const downloadLatest = async (): Promise<FillerMedia[] | undefined> => {
  const cached = readCachedDatabase();
  const lastCheck = Number(mainStorage.getString(LAST_CHECK_KEY) || 0);
  if (cached && Date.now() - lastCheck < CHECK_INTERVAL_MS) {
    return cached;
  }
  try {
    const metadataResponse = await fetch(METADATA_URL, {
      headers: {Accept: 'application/vnd.github+json'},
    });
    if (!metadataResponse.ok) {
      throw new Error(`GitHub HTTP ${metadataResponse.status}`);
    }
    const metadata = (await metadataResponse.json()) as {
      sha?: string;
      size?: number;
      download_url?: string;
    };
    if (
      !metadata.sha ||
      !metadata.download_url ||
      !Number.isFinite(metadata.size) ||
      Number(metadata.size) > MAX_DATABASE_BYTES
    ) {
      throw new Error('Invalid filler database metadata');
    }
    const downloadUrl = new URL(metadata.download_url);
    if (downloadUrl.protocol !== 'https:' || downloadUrl.hostname !== RAW_HOST) {
      throw new Error('Unexpected filler database URL');
    }
    if (cached && mainStorage.getString(SHA_KEY) === metadata.sha) {
      mainStorage.setString(LAST_CHECK_KEY, String(Date.now()));
      return cached;
    }
    let databaseResponse = await fetch(downloadUrl.toString());
    if (!databaseResponse.ok) {
      databaseResponse = await fetch(METADATA_URL, {
        headers: {Accept: 'application/vnd.github.raw+json'},
      });
    }
    if (!databaseResponse.ok) {
      throw new Error(`Filler database HTTP ${databaseResponse.status}`);
    }
    const raw = await databaseResponse.text();
    if (raw.length > MAX_DATABASE_BYTES) {
      throw new Error('Filler database exceeds size limit');
    }
    const parsed = parseFillerDatabase(raw);
    mainStorage.setString(CACHE_KEY, raw);
    mainStorage.setString(SHA_KEY, metadata.sha);
    mainStorage.setString(LAST_CHECK_KEY, String(Date.now()));
    memoryDatabase = parsed;
    return parsed;
  } catch (error) {
    console.warn('Filler database update failed', error);
    return cached;
  }
};

export const findFillerEpisodes = (
  database: FillerMedia[],
  lookup: FillerLookup,
): Set<number> => {
  const media = database.find(item => item.mapping?.mal_id === lookup.malId) ||
    database.find(item => item.mapping?.anilist_id === lookup.anilistId) ||
    database.find(item => item.mapping?.kitsu_id === lookup.kitsuId) ||
    database.find(item => !!lookup.imdbId && item.mapping?.imdb_id === lookup.imdbId) ||
    database.find(
      item =>
        item.mapping?.themoviedb_id === lookup.tmdbId ||
        item.mapping?.season?.tmdb === lookup.tmdbId,
    ) ||
    database.find(item => normalizeTitle(item.show.title) === normalizeTitle(lookup.title));
  return new Set(media?.show.filler || []);
};

export const getFillerEpisodes = async (
  lookup: FillerLookup,
): Promise<Set<number>> => {
  updatePromise ||= downloadLatest().finally(() => {
    updatePromise = undefined;
  });
  const database = await updatePromise;
  return database ? findFillerEpisodes(database, lookup) : new Set();
};
