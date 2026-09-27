import {describe, expect, it} from '@jest/globals';
import {validateCustomDohUrl} from '../src/lib/services/dns';

describe('validateCustomDohUrl', () => {
  it('accepts and normalizes an HTTPS DoH endpoint', () => {
    expect(
      validateCustomDohUrl('  https://resolver.example/dns-query  '),
    ).toEqual({
      valid: true,
      normalizedUrl: 'https://resolver.example/dns-query',
    });
  });

  it('accepts a custom HTTPS port and path', () => {
    expect(validateCustomDohUrl('https://resolver.example:8443/doh')).toEqual({
      valid: true,
      normalizedUrl: 'https://resolver.example:8443/doh',
    });
  });

  it.each([
    ['', 'empty'],
    ['not-a-url', 'invalid'],
    ['http://resolver.example/dns-query', 'httpsOnly'],
    ['https://user:secret@resolver.example/dns-query', 'credentials'],
    ['https://resolver.example/dns-query?token=value', 'queryOrFragment'],
    ['https://resolver.example/dns-query#section', 'queryOrFragment'],
    ['https://resolver.example/dns-query?', 'queryOrFragment'],
    ['https://resolver.example/dns-query#', 'queryOrFragment'],
  ])('rejects %s with reason %s', (value, reason) => {
    expect(validateCustomDohUrl(value)).toEqual({valid: false, reason});
  });

  it('rejects an endpoint longer than the persisted limit', () => {
    const value = `https://resolver.example/${'a'.repeat(2048)}`;
    expect(validateCustomDohUrl(value)).toEqual({
      valid: false,
      reason: 'tooLong',
    });
  });
});
