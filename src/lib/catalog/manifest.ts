import type {Asset, CatalogManifest, DeltaAsset} from './types';
export const CATALOG_MANIFEST_URL =
  'https://raw.githubusercontent.com/Nokitomo/database/cinema-sqlite-lite/manifest.json';
const sha = /^[a-f0-9]{64}$/;
const kinds = [
  'alias',
  'artwork',
  'artwork_assignment',
  'artwork_inventory',
  'configuration',
  'episode',
  'external_id',
  'season',
  'source',
  'source_episode',
  'source_season',
  'work',
];
export const recordKinds = new Set(kinds);
export function isCatalogAssetUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.search &&
      !u.hash &&
      u.hostname === 'github.com' &&
      /^\/Nokitomo\/database\/releases\/download\/cinema-sqlite(?:-lite)?-v1-[a-f0-9]{64}\/[^/]+\.gz$/.test(
        u.pathname,
      )
    );
  } catch {
    return false;
  }
}
function asset(value: any): value is Asset {
  return (
    value &&
    /^[a-zA-Z0-9._-]+\.gz$/.test(value.name) &&
    sha.test(value.sha256) &&
    Number.isSafeInteger(value.bytes) &&
    value.bytes > 0 &&
    value.bytes <= 16 * 1024 ** 3 &&
    isCatalogAssetUrl(value.url) &&
    new URL(value.url).pathname.endsWith('/' + value.name)
  );
}
export function parseManifest(value: unknown): CatalogManifest {
  const m = value as CatalogManifest;
  const lite = m?.format === 'vega-cinema-lite-v1';
  if (lite) {
    const raw = value as CatalogManifest & {detailPath?: string};
    if (
      raw.catalogId !== 'cinema' ||
      raw.schemaVersion !== 1 ||
      !/^[a-f0-9]{40}$/.test(raw.sourceCommit || '') ||
      raw.detailPath !== 'cinema/data/items/{workId}.json' ||
      !raw.origins ||
      typeof raw.origins !== 'object' ||
      Array.isArray(raw.origins) ||
      !Object.values(raw.origins).every(
        origin =>
          typeof origin === 'string' && /^https:\/\/[^/]+$/.test(origin),
      ) ||
      !sha.test(raw.revision) ||
      !asset(raw.snapshot) ||
      !new URL(raw.snapshot.url).pathname.includes('/cinema-sqlite-lite-v1-') ||
      raw.snapshot.name !== 'cinema.sqlite.gz' ||
      !sha.test(raw.snapshot.uncompressedSha256) ||
      !Number.isSafeInteger(raw.snapshot.uncompressedBytes) ||
      raw.snapshot.uncompressedBytes <= 0 ||
      raw.snapshot.uncompressedBytes > 32 * 1024 ** 3 ||
      !raw.counts ||
      !['works', 'artwork', 'image_rules'].every(
        k => Number.isSafeInteger(raw.counts[k]) && raw.counts[k] >= 0,
      ) ||
      !Number.isSafeInteger(raw.activeCount) ||
      raw.activeCount < 0 ||
      raw.activeCount > raw.counts.works
    ) {
      throw new Error('catalog.invalidManifest');
    }
    return {...raw, minimumReaderVersion: 1, validationOnly: false, deltas: []};
  }
  if (
    !m ||
    m.format !== undefined ||
    m.catalogId !== 'cinema' ||
    m.schemaVersion !== 1 ||
    m.minimumReaderVersion !== 1 ||
    m.validationOnly !== false ||
    !sha.test(m.revision) ||
    !asset(m.snapshot) ||
    new URL(m.snapshot.url).pathname.includes('/cinema-sqlite-lite-v1-') ||
    !sha.test(m.snapshot.uncompressedSha256) ||
    !Number.isSafeInteger(m.snapshot.uncompressedBytes) ||
    m.snapshot.uncompressedBytes <= 0 ||
    m.snapshot.uncompressedBytes > 32 * 1024 ** 3 ||
    !Number.isSafeInteger(m.activeCount) ||
    m.activeCount < 0 ||
    !m.counts ||
    !Number.isSafeInteger(m.counts.work) ||
    m.counts.work < 0 ||
    !Object.entries(m.counts).every(
      ([k, n]) => recordKinds.has(k) && Number.isSafeInteger(n) && n >= 0,
    ) ||
    !Array.isArray(m.deltas) ||
    m.deltas.length > 100 ||
    !m.deltas.every(
      d =>
        asset(d) &&
        !new URL(d.url).pathname.includes('/cinema-sqlite-lite-v1-') &&
        sha.test(d.fromRevision) &&
        sha.test(d.toRevision),
    )
  ) {
    throw new Error('catalog.invalidManifest');
  }
  return m;
}
export function planDownload(m: CatalogManifest, revision?: string): Asset[] {
  if (revision === m.revision) {
    return [];
  }
  let index = -1;
  m.deltas.forEach((d, i) => {
    if (d.fromRevision === revision) {
      index = i;
    }
  });
  const chain: DeltaAsset[] = [];
  let current = revision;
  for (let i = index; i >= 0 && i < m.deltas.length; i++) {
    const d = m.deltas[i];
    if (d.fromRevision !== current) {
      break;
    }
    chain.push(d);
    current = d.toRevision;
    if (current === m.revision) {
      if (chain.reduce((n, a) => n + a.bytes, 0) < m.snapshot.bytes) {
        return chain;
      }
      break;
    }
  }
  return [m.snapshot];
}
