import {describe, expect, it} from '@jest/globals';
import {hasStreamRequestHeaders} from '../src/lib/utils/streamHeaders';

describe('stream request headers', () => {
  it('detects only meaningful provider headers', () => {
    expect(hasStreamRequestHeaders()).toBe(false);
    expect(hasStreamRequestHeaders({headers: {}})).toBe(false);
    expect(hasStreamRequestHeaders({headers: {Referer: ''}})).toBe(false);
    expect(
      hasStreamRequestHeaders({
        headers: {Referer: 'https://streamingunity.example/'},
      }),
    ).toBe(true);
  });
});
