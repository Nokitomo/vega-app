import type {Post} from '../providers/types';
import {streamCenterMetaOrigin} from '../services/streamCenterMetadata';

type HeroMetadata = {
  title?: string;
  name?: string;
  synopsis?: string;
  logo?: string;
  tags?: string[];
  artworkCandidates?: {logo?: string[]};
};

const text = (value?: string) => typeof value === 'string' && !!value.trim();

// Eligibility for this presentation, not a claim that missing fields are errors.
// A logo and genres are optional: some works legitimately have neither.
export const isPresentableHero = (value?: HeroMetadata): boolean =>
  !!value && (text(value.title) || text(value.name)) && text(value.synopsis);

export const hasHeroLogo = (value?: HeroMetadata): boolean =>
  text(value?.logo) || !!value?.artworkCandidates?.logo?.some(text);

export const wouldDegradeHero = (
  previous: HeroMetadata | undefined,
  next: HeroMetadata,
): boolean => isPresentableHero(previous) && (
  !isPresentableHero(next) ||
  (hasHeroLogo(previous) && !hasHeroLogo(next)) ||
  (!!previous?.tags?.length && !next.tags?.length)
);

const linkIdentity = (link: string, provider: string): string => {
  const origin = provider === 'streamcenter' ? streamCenterMetaOrigin(link) : undefined;
  const source = origin?.source || provider;
  const url = origin?.data.url || link;
  // Hero represents a work, so episode/season routes of a series share its ID.
  const id = source === 'animeunity'
    ? url.match(/\/(?:anime|info_api)\/(\d+)(?:\D|$)/i)?.[1]
    : source === 'streamingunity'
      ? url.match(/\/titles\/(\d+)(?:\D|$)/i)?.[1]
      : undefined;
  if (id) {return `${source}:${id}`;}
  return `${source}:url:${url.replace(/#.*$/, '').replace(/\/$/, '')}`;
};

const identities = (post: Post, provider: string): string[] => {
  const keys = [post.link, ...(post.variants || []).map(variant => variant.link)]
    .filter(Boolean).map(link => linkIdentity(link, provider));
  const route = provider === 'streamcenter' ? streamCenterMetaOrigin(post.link) : undefined;
  for (const [field, namespace] of [['anilistId', 'anilist'], ['malId', 'mal']]) {
    const id = Number(route?.data[field]);
    if (Number.isSafeInteger(id) && id > 0) {keys.push(`${namespace}:${id}`);}
  }
  if (post.artworkHints?.anilistId) {keys.push(`anilist:${post.artworkHints.anilistId}`);}
  if (post.artworkHints?.malId) {keys.push(`mal:${post.artworkHints.malId}`);}
  return keys;
};

/** Stable first representative; transitive variant aliases are also deduplicated.
 * Titles alone cannot distinguish remakes, films and series, so are not keys.
 */
export const uniqueHeroPosts = (posts: Array<Post | undefined>, provider: string): Post[] => {
  const groups: Array<{post: Post; keys: Set<string>}> = [];
  for (const post of posts) {
    if (!post?.link) {continue;}
    const keys = new Set(identities(post, provider));
    const matches = groups.filter(group => [...keys].some(key => group.keys.has(key)));
    const target = matches[0];
    if (!target) {
      groups.push({post, keys});
      continue;
    }
    keys.forEach(key => target.keys.add(key));
    for (const other of matches.slice(1)) {
      other.keys.forEach(key => target.keys.add(key));
      groups.splice(groups.indexOf(other), 1);
    }
  }
  return groups.map(group => group.post);
};
