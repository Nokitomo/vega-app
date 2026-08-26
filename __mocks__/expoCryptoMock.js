module.exports = {
  CryptoDigestAlgorithm: {
    MD5: 'MD5',
    SHA1: 'SHA-1',
    SHA256: 'SHA-256',
    SHA384: 'SHA-384',
    SHA512: 'SHA-512',
  },
  CryptoEncoding: {BASE64: 'base64', HEX: 'hex'},
  digestStringAsync: jest.fn().mockResolvedValue('mock-digest'),
  getRandomBytes: jest.fn(length => new Uint8Array(length)),
  getRandomBytesAsync: jest.fn(async length => new Uint8Array(length)),
  randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
};
