import * as Crypto from 'expo-crypto';
import type {Artwork, CatalogRecord} from './types';
import {normalizeDetailArtwork} from './liteArtwork';

type Row = CatalogRecord<Record<string, unknown>>;
type Item = Record<string, unknown>;
type Season = Item & {number: number; episodes?: Item[]};
type Variant = Item & {id: string | number; seasons?: Season[]};
type Detail = {seasons: Season[]; providers: Record<string, Variant[]>};

export function detailRows(
  detail: unknown,
  work: string,
  kind: string,
  parent?: string,
): Row[] {
  const item = detail as Detail;
  const rows: Row[] = [];
  const add = (id: string, payload: Item, parentId: string) => {
    if (!parent || parentId === parent) {
      rows.push({id, payload});
    }
  };
  if (kind === 'season' || kind === 'episode') {
    for (const {episodes, ...season} of item.seasons) {
      const id = `${work}:season:${season.number}`;
      if (kind === 'season') {
        add(id, season, work);
      } else {
        for (const ep of episodes || []) {
          add(`${id}:episode:${ep.number}`, ep, id);
        }
      }
    }
  } else {
    for (const [provider, variants] of Object.entries(item.providers)) {
      for (const {seasons, ...variant} of variants) {
        const id = `${work}:source:${provider}:${variant.id}`;
        if (kind === 'source') {
          add(id, {provider, ...variant}, work);
        } else {
          for (const {episodes, ...season} of seasons || []) {
            const seasonId = `${id}:season:${season.number}`;
            if (kind === 'source_season') {
              add(seasonId, season, id);
            } else {
              for (const ep of episodes || []) {
                add(`${seasonId}:episode:${ep.number}`, ep, seasonId);
              }
            }
          }
        }
      }
    }
  }
  return rows.sort(
    (a, b) =>
      Number(a.payload.number) - Number(b.payload.number) ||
      (a.id < b.id ? -1 : Number(a.id !== b.id)),
  );
}

const normalized = new WeakMap<
  object,
  ReturnType<typeof normalizeDetailArtwork>
>();
export async function detailArtwork(
  detail: unknown,
  origins: Record<string, string>,
  scope: string,
  role: string,
  season?: number,
  episode?: number,
): Promise<Artwork[]> {
  const item = detail as object;
  let rows = normalized.get(item);
  if (!rows) {
    rows = normalizeDetailArtwork(item, origins);
    normalized.set(item, rows);
  }
  return Promise.all(
    rows
      .filter(
        ({payload}) =>
          payload.scope === scope &&
          payload.field === role &&
          payload.season === (season ?? null) &&
          payload.episode === (episode ?? null),
      )
      .map(
        async ({id, payload, url}) =>
          ({
            ...payload,
            url,
            id:
              'assignment:' +
              (await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                id,
              )),
          }) as Artwork,
      ),
  );
}
