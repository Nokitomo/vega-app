import {describe, expect, it} from '@jest/globals';
import {
  buildArchiveFilter,
  createEmptyArchiveFilterSelection,
  hasActiveArchiveFilters,
  parseArchiveFilterSelection,
} from '../src/lib/utils/archiveFilters';

describe('archive filters', () => {
  it('parses the provider query into editable values', () => {
    expect(
      parseArchiveFilterSelection(
        'archive?order=rating&type=tv&genres=51,9&dubbed=true',
      ),
    ).toMatchObject({
      order: 'rating',
      type: 'tv',
      genres: ['51', '9'],
      dubbed: true,
    });
  });

  it('builds an encoded archive query and resets to the base path', () => {
    const filter = buildArchiveFilter('archive?order=rating', {
      title: 'One Piece',
      year: '1999',
      order: 'popularity',
      genres: ['51', '21'],
      dubbed: true,
    });

    expect(filter).toBe(
      'archive?title=One+Piece&year=1999&order=popularity&genres=51%2C21&dubbed=true',
    );
    const empty = createEmptyArchiveFilterSelection();
    expect(buildArchiveFilter(filter, empty)).toBe('archive');
    expect(hasActiveArchiveFilters(empty)).toBe(false);
  });
});
