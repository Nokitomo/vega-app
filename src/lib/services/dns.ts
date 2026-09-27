import {NativeModules, Platform} from 'react-native';

export type DnsProviderId = 'system' | 'cloudflare' | 'google' | 'quad9';

export type DnsProvider = {
  id: DnsProviderId;
  name: string;
  encrypted: boolean;
};

export type DnsState = {
  selectedProviderId: DnsProviderId;
  providers: DnsProvider[];
};

export type DnsTestResult = {
  providerId: DnsProviderId;
  elapsedMs: number;
  addresses: string[];
};

type VegaDnsNativeModule = {
  getState: () => Promise<DnsState>;
  setSelectedProvider: (providerId: DnsProviderId) => Promise<string>;
  testSelectedProvider: () => Promise<DnsTestResult>;
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

  testSelectedProvider(): Promise<DnsTestResult> {
    return assertAvailable().testSelectedProvider();
  },
};
