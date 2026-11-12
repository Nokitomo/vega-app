import {mainStorage} from '../storage/StorageService';
import type {CatalogRef} from './types';

const KEY = 'catalog-source-identities:v1';
let cachedRevision = -1;
let cachedMap: Record<string, string> = {};
function identities() {
  const revision = mainStorage.getKeyRevision(KEY);
  if (revision !== cachedRevision) {
    cachedMap = mainStorage.getObject<Record<string, string>>(KEY) || {};
    cachedRevision = revision;
  }
  return cachedMap;
}
// Only use mappings explicitly registered from an installed catalog. A numeric
// ID by itself is ambiguous across providers and is never inferred globally.
export function sourceIdentity(link: string): string | undefined {
  const match = link.match(/\/(?:it\/)?titles\/(\d+)(?:\D|$)/i);
  if (!match) {
    return undefined;
  }
  if (
    link.startsWith('/') ||
    /^https:\/\/(?:www\.)?(?:streamingunity|streamingcommunity)[a-z]*\./i.test(
      link,
    )
  ) {
    return `streamingunity:${match[1]}`;
  }
  return undefined;
}
export function catalogIdentity(link: string): string | undefined {
  const map = identities();
  return (
    map?.[link] ||
    (sourceIdentity(link) ? map?.[sourceIdentity(link)!] : undefined)
  );
}
export function registerCatalogIdentity(
  ref: CatalogRef,
  links: string[],
  sourceIds: string[],
) {
  const map = {...identities()};
  const key = ref.workId;
  let changed = false;
  for (const link of [key, ...links, ...sourceIds]) {
    if (map[link] !== key) {
      map[link] = key;
      changed = true;
    }
  }
  if (changed) {
    mainStorage.setObject(KEY, map);
  }
}
