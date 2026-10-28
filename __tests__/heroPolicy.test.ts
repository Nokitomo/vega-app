import {describe, it, expect} from '@jest/globals';
import {isPresentableHero, wouldDegradeHero, uniqueHeroPosts} from '../src/lib/utils/heroPolicy';

const post = (link: string, title = 'Same title') => ({link, title, image: 'image'});
const complete = {title: 'Work', synopsis: 'Synopsis', logo: 'logo', tags: ['Drama']};

describe('hero metadata eligibility', () => {
  it('rejects empty cached fallbacks but accepts legitimately missing logos', () => {
    expect(isPresentableHero({title: '', synopsis: ''})).toBe(false);
    expect(isPresentableHero({title: 'Work'})).toBe(false);
    expect(isPresentableHero({name: 'Work', synopsis: 'Synopsis'})).toBe(true);
  });
  it('preserves usable metadata when a refresh loses fields', () => {
    expect(wouldDegradeHero(complete, {...complete, logo: undefined})).toBe(true);
    expect(wouldDegradeHero(complete, {...complete, tags: []})).toBe(true);
    expect(wouldDegradeHero(complete, {...complete, synopsis: ''})).toBe(true);
    expect(wouldDegradeHero(complete, {...complete, title: 'Updated'})).toBe(false);
  });
});

describe('hero work deduplication', () => {
  it('groups seasons, episodes and changed domains without changing the first route', () => {
    const first = post('https://streamingunity.old/titles/42/a/season-1');
    expect(uniqueHeroPosts([first, post('https://streamingunity.new/titles/42/a/season-2'),
      post('https://streamingunity.new/titles/43/b')], 'streamingunity')).toEqual([
      first, post('https://streamingunity.new/titles/43/b'),
    ]);
  });
  it('does not merge different works just because titles match', () => {
    expect(uniqueHeroPosts([post('/anime/12'), post('/anime/13')], 'animeunity')).toHaveLength(2);
  });
  it('uses external anime IDs and transitively connected language variants', () => {
    const first = {...post('/anime/12'), artworkHints: {malId: 99}};
    expect(uniqueHeroPosts([first, {...post('/anime/13'), artworkHints: {malId: 99}}],
      'animeunity')).toEqual([first]);
    const bridge = {...post('/anime/14'), variants: [
      {...post('/anime/12'), status: 'subbed' as const, statusKey: 'Subbed' as const},
      {...post('/anime/13'), status: 'dubbed' as const, statusKey: 'Dubbed' as const},
    ]};
    expect(uniqueHeroPosts([first, post('/anime/13'), bridge], 'animeunity')).toEqual([first]);
  });
  it('recognizes anime IDs carried inside StreamCenter routes', () => {
    const route = (id: number) => 'streamcenter:v1:meta:animeunity:' +
      encodeURIComponent(JSON.stringify({url: `/anime/${id}`, anilistId: 55}));
    expect(uniqueHeroPosts([post(route(1)), post(route(2))], 'streamcenter')).toHaveLength(1);
  });
  it('unwraps StreamCenter routes, preserving original navigation and variants', () => {
    const route = 'streamcenter:v1:meta:streamingunity:' + encodeURIComponent(JSON.stringify({url:
      'https://streamingunity.new/titles/42/a/season-2', title: 'Different label'}));
    const first = post('https://streamingunity.old/titles/42/a');
    expect(uniqueHeroPosts([first, post(route)], 'streamcenter')).toEqual([first]);
  });
});
