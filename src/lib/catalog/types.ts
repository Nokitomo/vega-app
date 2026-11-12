export type CatalogRef = {catalogId: 'cinema'; workId: string};
export type ImageField =
  | 'poster'
  | 'background'
  | 'logo'
  | 'seasonPoster'
  | 'episodeThumbnail';
export type CatalogSection = {
  id: string;
  title: string;
  enabled: boolean;
  type: '' | 'movie' | 'tv';
  genres: string[];
  fromYear?: number;
  toYear?: number;
  sort: 'title' | 'year' | 'added' | 'views';
};
export type CatalogPreferences = {
  version: 1;
  selected: boolean;
  automatic: boolean;
  cellular: boolean;
  order: Record<ImageField, string[]>;
  quality: Record<ImageField, string>;
  sections: CatalogSection[];
  heroSection: string;
};
export type Asset = {name: string; url: string; bytes: number; sha256: string};
export type DeltaAsset = Asset & {fromRevision: string; toRevision: string};
export type CatalogManifest = {
  catalogId: 'cinema';
  schemaVersion: 1;
  minimumReaderVersion: number;
  revision: string;
  validationOnly: false;
  counts: Record<string, number>;
  activeCount: number;
  snapshot: Asset & {uncompressedBytes: number; uncompressedSha256: string};
  deltas: DeltaAsset[];
};
export type CatalogRecord<T = Record<string, unknown>> = {
  id: string;
  payload: T;
};
export type Artwork = {
  id: string;
  url: string;
  source: string;
  field: string;
  language: string | null;
  scope: string;
  season: number | null;
  episode: number | null;
  eligible: boolean;
  forced: boolean;
  rank: number;
  width?: number;
  height?: number;
};
export type Work = {
  active: boolean;
  replacedBy?: string;
  sourceIds?: Record<string, unknown>;
  info: Record<string, unknown>;
  metadataPolicy?: Record<string, unknown>;
};
export type InstalledCatalog = {
  revision: string;
  file: string;
  bytes: number;
  installedAt: number;
};
export type TransferState = {
  status:
    | 'idle'
    | 'queued'
    | 'downloading'
    | 'paused'
    | 'downloaded'
    | 'installing'
    | 'ready'
    | 'error';
  bytes: number;
  total: number;
  error?: string;
  phase?:
    | 'hashDownload'
    | 'extract'
    | 'hashPrepared'
    | 'copyBase'
    | 'validate'
    | 'index'
    | 'applyDelta'
    | 'verifyRevision'
    | 'prepareRevision'
    | 'activate'
    | 'stopping';
  startedAt?: number;
  updatedAt?: number;
};
