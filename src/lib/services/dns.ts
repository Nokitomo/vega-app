import {NativeModules, Platform} from 'react-native';

export type DnsProviderId =
  | 'system'
  | 'cloudflare'
  | 'google'
  | 'quad9'
  | 'adguard'
  | 'custom';

export type DnsProvider = {
  id: DnsProviderId;
  name: string;
  encrypted: boolean;
};

export type DnsState = {
  selectedProviderId: DnsProviderId;
  providers: DnsProvider[];
  customUrl: string | null;
};

export type DnsTestResult = {
  providerId: DnsProviderId;
  elapsedMs: number;
  addresses: string[];
};

type VegaDnsNativeModule = {
  getState: () => Promise<DnsState>;
  setSelectedProvider: (providerId: DnsProviderId) => Promise<string>;
  setCustomProvider: (url: string) => Promise<string>;
  testSelectedProvider: () => Promise<DnsTestResult>;
};

export type CustomDohUrlValidation =
  | {valid: true; normalizedUrl: string}
  | {
      valid: false;
      reason: 'empty' | 'tooLong' | 'invalid' | 'httpsOnly' | 'credentials' | 'queryOrFragment';
    };

const MAX_CUSTOM_DOH_URL_LENGTH = 2048;

export const validateCustomDohUrl = (value: string): CustomDohUrlValidation => {
  const candidate = value.trim();
  if (!candidate) {
    return {valid: false, reason: 'empty'};
  }
  if (candidate.length > MAX_CUSTOM_DOH_URL_LENGTH) {
    return {valid: false, reason: 'tooLong'};
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {valid: false, reason: 'invalid'};
  }

  if (parsed.protocol !== 'https:') {
    return {valid: false, reason: 'httpsOnly'};
  }
  if (!parsed.hostname) {
    return {valid: false, reason: 'invalid'};
  }
  if (parsed.username || parsed.password) {
    return {valid: false, reason: 'credentials'};
  }
  if (candidate.includes('?') || candidate.includes('#')) {
    return {valid: false, reason: 'queryOrFragment'};
  }

  return {valid: true, normalizedUrl: parsed.toString()};
};

const nativeModule = NativeModules.VegaDns as VegaDnsNativeModule | undefined;

const assertAvailable = (): VegaDnsNativeModule => {
  if (Platform.OS !== 'android' || !nativeModule) {
    throw new Error('DNS over HTTPS is unavailable on this platform');
  }
  return nativeModule;
};

export const dnsService = {
  isAvailable: Platform.OS === 'android' && Boolean(nativeModule),

  getState(): Promise<DnsState> {
    return assertAvailable().getState();
  },

  setSelectedProvider(providerId: DnsProviderId): Promise<string> {
    return assertAvailable().setSelectedProvider(providerId);
  },

  setCustomProvider(url: string): Promise<string> {
    return assertAvailable().setCustomProvider(url);
  },

  testSelectedProvider(): Promise<DnsTestResult> {
    return assertAvailable().testSelectedProvider();
  },
};
