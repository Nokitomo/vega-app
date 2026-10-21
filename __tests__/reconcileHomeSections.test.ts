import {expect, it} from '@jest/globals';
import {reconcileHomeSections} from '../src/lib/utils/reconcileHomeSections';

const section = (
  filter: string,
  Posts: {link: string}[],
  isLoading = false,
  error?: string,
) => ({filter, title: filter, Posts, isLoading, error});

it('reuses the list and its rows when visible data and state are unchanged', () => {
  const emptyPosts: {link: string}[] = [];
  const posts = [{link: '/one'}];
  const previous = [section('empty', emptyPosts, true), section('loaded', posts)];
  const next = [section('empty', emptyPosts, true), section('loaded', posts)];

  expect(reconcileHomeSections({scope: 'animeunity:v1', data: previous}, 'animeunity:v1', next))
    .toBe(previous);
});

it('updates only the section whose cards change', () => {
  const emptyPosts: {link: string}[] = [];
  const previous = [section('empty', emptyPosts), section('loaded', [{link: '/one'}])];
  const next = [section('empty', emptyPosts), section('loaded', [{link: '/two'}])];

  const result = reconcileHomeSections({scope: 'animeunity:v1', data: previous}, 'animeunity:v1', next);
  expect(result).not.toBe(previous);
  expect(result[0]).toBe(previous[0]);
  expect(result[1]).toBe(next[1]);
});

it('shows loading and error transitions even when posts are unchanged', () => {
  const emptyPosts: {link: string}[] = [];
  const loading = [section('upcoming', emptyPosts, true)];
  const failed = [section('upcoming', emptyPosts, false, 'Request failed')];
  const result = reconcileHomeSections({scope: 'animeunity:v1', data: loading}, 'animeunity:v1', failed);

  expect(result).not.toBe(loading);
  expect(result[0]).toBe(failed[0]);
  expect(result[0].isLoading).toBe(false);
  expect(result[0].error).toBe('Request failed');
});

it('does not reuse rows across provider revisions or a changed catalog order', () => {
  const posts = [{link: '/one'}];
  const previous = [section('latest', posts), section('archive', posts)];
  const same = [section('latest', posts), section('archive', posts)];
  const reordered = [section('archive', posts), section('latest', posts)];

  expect(reconcileHomeSections({scope: 'animeunity:v1', data: previous}, 'animeunity:v2', same))
    .toBe(same);
  const result = reconcileHomeSections({scope: 'animeunity:v1', data: previous}, 'animeunity:v1', reordered);
  expect(result).not.toBe(previous);
  expect(result[0]).not.toBe(previous[0]);
  expect(result[1]).not.toBe(previous[1]);
});
