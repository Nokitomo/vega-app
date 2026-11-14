import type {Post} from '../providers/types';
import {settingsStorage} from '../storage/SettingsStorage';
import {perfNow, perfTrace} from '../utils/perfTrace';
import {selectImages} from './artwork';
import {catalogHeroSummaries, catalogLiteArtwork, catalogRandomActiveIds} from './reader';
import {useCatalogStore} from './store';

const fields = ['logo', 'background', 'poster'] as const;
const batchSize = 32;
const rotationSize = 10; // Six slides plus four reserves for broken image URLs.

type Day = {day: string; posts: Post[]};
type Rotation = {signature: string; days: Day[]};

export function cinemaHeroDay(date = new Date(), offset = 0) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
  return `${local.getFullYear()}-${local.getMonth() + 1}-${local.getDate()}`;
}

function readRotation(): Rotation | undefined {
  try {
    const value = JSON.parse(settingsStorage.getCinemaHeroRotation() ?? 'null') as Rotation | null;
    if (value && typeof value.signature === 'string' && Array.isArray(value.days) &&
      value.days.every(entry => typeof entry.day === 'string' && Array.isArray(entry.posts) &&
        entry.posts.every(post => typeof post.link === 'string' && post.catalogRef?.workId === post.link))) {
      return value;
    }
  } catch {
    // A damaged rotation is replaced on the next successful selection.
  }
}

export async function loadCinemaHeroRotation(date: Date, revision: string, generation: number) {
  const started = perfNow();
  const day = cinemaHeroDay(date);
  const yesterday = cinemaHeroDay(date, -1);
  const beforeYesterday = cinemaHeroDay(date, -2);
  const {preferences} = useCatalogStore.getState();
  const signature = JSON.stringify([revision, ...fields.map(field => preferences.order[field])]);
  const stored = readRotation();
  const today = stored?.days.find(entry => entry.day === day);
  if (today && stored?.signature === signature) {
    perfTrace('cinema_hero_selection', {cached: true, count: today.posts.length, durationMs: Math.round(perfNow() - started)});
    return today.posts;
  }

  const previous = stored?.days.find(entry => entry.day === yesterday);
  const older = stored?.days.find(entry => entry.day === beforeYesterday);
  const previousIds = new Set(previous?.posts.map(post => post.link));
  const olderIds = new Set(older?.posts.map(post => post.link));
  const posts: Post[] = [];
  const checkBatch = async (batch: string[]) => {
    if (!batch.length || posts.length >= rotationSize) {return;}
    const [summaries, artwork] = await Promise.all([catalogHeroSummaries(batch), catalogLiteArtwork(batch, fields)]);
    const byId = new Map(summaries.map(work => [work.id, work]));
    for (const id of batch) {
      const work = byId.get(id);
      const rows = artwork.get(id);
      if (!work || !rows) {continue;}
      const hasImage = (field: typeof fields[number]) => selectImages(
        rows.filter(row => row.field === field && row.url.trim()), field, preferences,
        {originalLanguage: work.language ?? ''},
      ).length > 0;
      if (hasImage('logo') && (hasImage('background') || hasImage('poster'))) {
        posts.push({link: id, title: work.title, image: '', catalogRef: {catalogId: 'cinema', workId: id}});
        if (posts.length === rotationSize) {break;}
      }
    }
  };
  const todayIds = new Set(today?.posts.map(post => post.link));
  await checkBatch([...todayIds]);
  const excluded = new Set([...todayIds, ...previousIds, ...olderIds]);
  while (posts.length < rotationSize && useCatalogStore.getState().generation === generation) {
    const batch = await catalogRandomActiveIds(excluded, batchSize);
    await checkBatch(batch);
    batch.forEach(id => excluded.add(id));
    if (batch.length < batchSize) {break;}
  }
  await checkBatch([...olderIds].filter(id => !previousIds.has(id) && !todayIds.has(id)));
  await checkBatch([...previousIds].filter(id => !todayIds.has(id)));
  if (useCatalogStore.getState().generation !== generation || cinemaHeroDay() !== day) {return posts;}
  const days = [{day, posts}, ...[previous, older].filter((entry): entry is Day => !!entry)];
  settingsStorage.setCinemaHeroRotation(JSON.stringify({signature, days}));
  perfTrace('cinema_hero_selection', {cached: false, count: posts.length, durationMs: Math.round(perfNow() - started)});
  return posts;
}
