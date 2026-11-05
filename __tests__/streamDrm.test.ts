import {describe, expect, it} from '@jest/globals';
import {
  assertUnprotectedStream,
  DRM_INVALID,
  DRM_PLAYER_ONLY,
  DRM_UNSUPPORTED,
  getPlayerDrm,
  getStreamVideoType,
} from '../src/lib/utils/streamDrm';
import type {StreamDrm} from '../src/lib/providers/types';

// Public example keys, never production credentials.
const key = '00112233445566778899aabbccddeeff';
const kid = '00112233-4455-6677-8899-aabbccddeeff';

describe('DRM stream configuration', () => {
  it('leaves ordinary streams untouched', () => {
    expect(getPlayerDrm(undefined, 'android')).toBeUndefined();
    expect(getPlayerDrm(undefined, 'ios')).toBeUndefined();
    expect(() => assertUnprotectedStream({})).not.toThrow();
  });

  it('converts ClearKey UUID/hex to unpadded base64url JWK without a network license', () => {
    const config = getPlayerDrm(
      {type: 'clearkey', clearKeys: [{kid, key}]},
      'android',
    );
    expect(config?.licenseServer).toBeUndefined();
    expect(config?.multiDrm).toBe(false);
    expect(JSON.parse(config!.clearKeyResponse!)).toEqual({
      type: 'temporary',
      keys: [
        {
          kty: 'oct',
          kid: 'ABEiM0RVZneImaq7zN3u_w',
          k: 'ABEiM0RVZneImaq7zN3u_w',
        },
      ],
    });
  });

  it('accepts multiple base64 and base64url keys', () => {
    const config = getPlayerDrm(
      {
        type: 'clearkey',
        clearKeys: [
          {kid: 'ABEiM0RVZneImaq7zN3u/w==', key: 'ABEiM0RVZneImaq7zN3u_w'},
          {kid: 'ffffffffffffffffffffffffffffffff', key},
        ],
      },
      'android',
    );
    expect(JSON.parse(config!.clearKeyResponse!).keys).toHaveLength(2);
  });

  it.each(['widevine', 'playready', 'clearkey'] as const)(
    'passes %s license headers and key parameters separately',
    type => {
      const drm = Object.freeze({
        type,
        licenseUrl: 'https://license.example.test/',
        licenseHeaders: {Authorization: 'test-token'},
        keyRequestParameters: {custom: 'value'},
      });
      const config = getPlayerDrm(drm, 'android');
      expect(config?.licenseServer).toBe(drm.licenseUrl);
      expect(config?.headers).toEqual({Authorization: 'test-token'});
      expect(config?.keyRequestParameters).toEqual({custom: 'value'});
      expect(config?.clearKeyResponse).toBeUndefined();
    },
  );

  it('requires a FairPlay certificate on iOS and rejects unsupported platform combinations', () => {
    const fairplay: StreamDrm = {
      type: 'fairplay',
      licenseUrl: 'https://license.example.test/',
      certificateUrl: 'https://certificate.example.test/',
      contentId: 'demo',
    };
    expect(getPlayerDrm(fairplay, 'ios')?.contentId).toBe('demo');
    expect(() => getPlayerDrm(fairplay, 'android')).toThrow(DRM_UNSUPPORTED);
    expect(() => getPlayerDrm({type: 'widevine'}, 'ios')).toThrow(
      DRM_UNSUPPORTED,
    );
  });

  it.each([
    {type: 'clearkey', clearKeys: []},
    {type: 'clearkey', clearKeys: [{kid, key: 'secret-invalid-key'}]},
    {
      type: 'clearkey',
      clearKeys: [{kid, key}],
      licenseUrl: 'https://example.test',
    },
    {type: 'widevine', clearKeys: [{kid, key}]},
    {type: 'widevine', licenseUrl: 'file:///secret'},
    {
      type: 'widevine',
      licenseUrl: 'https://example.test',
      licenseHeaders: {Token: 'a\r\nb'},
    },
    {type: 'unknown'},
  ])('rejects invalid configuration with a redacted error', drm => {
    expect(() => getPlayerDrm(drm as StreamDrm, 'android')).toThrow(
      DRM_INVALID,
    );
  });

  it('keeps DRM streams away from URL-only cast/download paths', () => {
    expect(() => assertUnprotectedStream({drm: {type: 'clearkey'}})).toThrow(
      DRM_PLAYER_ONLY,
    );
  });

  it('uses DASH/HLS types even when the URL has no extension', () => {
    expect(
      getStreamVideoType({
        type: 'dash',
        link: 'https://example.test/video',
        server: 'demo',
      }),
    ).toBe('mpd');
    expect(
      getStreamVideoType({
        type: 'hls',
        link: 'https://example.test/video',
        server: 'demo',
      }),
    ).toBe('m3u8');
    expect(
      getStreamVideoType({
        type: 'mp4',
        link: 'https://example.test/video',
        server: 'demo',
      }),
    ).toBeUndefined();
  });
});
