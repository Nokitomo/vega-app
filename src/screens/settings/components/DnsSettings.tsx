import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Platform,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import {Dropdown} from 'react-native-element-dropdown';
import {useTranslation} from 'react-i18next';
import {
  DnsProvider,
  DnsProviderId,
  dnsService,
} from '../../../lib/services/dns';

type DnsSettingsProps = {
  primary: string;
};

type TestStatus =
  | {kind: 'success'; latencyMs: number; addressCount: number}
  | {kind: 'error'}
  | null;

const getProviderLabel = (
  provider: DnsProvider,
  t: (key: string) => string,
): string => {
  if (provider.id === 'system') {
    return t('System DNS');
  }
  if (provider.id === 'quad9') {
    return t('Quad9 (unfiltered)');
  }
  return provider.name;
};

const DnsSettings = ({primary}: DnsSettingsProps) => {
  const {t} = useTranslation();
  const [providers, setProviders] = useState<DnsProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] =
    useState<DnsProviderId>('system');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>(null);

  useEffect(() => {
    let mounted = true;

    dnsService
      .getState()
      .then(state => {
        if (!mounted) {
          return;
        }
        setProviders(state.providers);
        setSelectedProviderId(state.selectedProviderId);
      })
      .catch(error => {
        console.warn('Unable to load DNS settings:', error);
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const options = useMemo(
    () =>
      providers.map(provider => ({
        label: getProviderLabel(provider, t),
        value: provider.id,
      })),
    [providers, t],
  );

  if (Platform.OS !== 'android' || !dnsService.isAvailable) {
    return null;
  }

  const handleProviderChange = async (providerId: DnsProviderId) => {
    if (providerId === selectedProviderId || isUpdating) {
      return;
    }

    const previousProviderId = selectedProviderId;
    setSelectedProviderId(providerId);
    setTestStatus(null);
    setIsUpdating(true);

    try {
      await dnsService.setSelectedProvider(providerId);
      ToastAndroid.show(t('DNS provider updated'), ToastAndroid.SHORT);
    } catch (error) {
      console.warn('Unable to update DNS provider:', error);
      setSelectedProviderId(previousProviderId);
      ToastAndroid.show(t('Failed to update DNS provider'), ToastAndroid.LONG);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTest = async () => {
    if (isTesting || isUpdating) {
      return;
    }

    setIsTesting(true);
    setTestStatus(null);
    try {
      const result = await dnsService.testSelectedProvider();
      setTestStatus({
        kind: 'success',
        latencyMs: Math.round(result.elapsedMs),
        addressCount: result.addresses.length,
      });
    } catch (error) {
      console.warn('DNS test failed:', error);
      setTestStatus({kind: 'error'});
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <View className="mb-6">
      <Text className="text-gray-400 text-sm mb-3">{t('Network')}</Text>
      <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
        <View className="p-4 border-b border-[#262626]">
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1">
              <Text className="text-white text-base font-medium">
                {t('DNS over HTTPS')}
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                {t('Encrypt DNS lookups used by Vega requests and the internal player.')}
              </Text>
            </View>
            <View className="w-48">
              {isLoading ? (
                <ActivityIndicator color={primary} />
              ) : (
                <Dropdown
                  selectedTextStyle={{
                    color: 'white',
                    fontSize: 14,
                    fontWeight: '500',
                    textAlign: 'right',
                  }}
                  containerStyle={{
                    backgroundColor: '#262626',
                    borderRadius: 8,
                    borderWidth: 0,
                    marginTop: 4,
                  }}
                  itemTextStyle={{color: 'white'}}
                  activeColor="#3A3A3A"
                  itemContainerStyle={{backgroundColor: '#262626'}}
                  style={{
                    backgroundColor: '#262626',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    opacity: isUpdating ? 0.6 : 1,
                  }}
                  iconStyle={{tintColor: 'white'}}
                  placeholderStyle={{color: 'white'}}
                  labelField="label"
                  valueField="value"
                  data={options}
                  value={selectedProviderId}
                  disable={isUpdating}
                  onChange={item => {
                    handleProviderChange(item.value as DnsProviderId);
                  }}
                />
              )}
            </View>
          </View>
          <Text className="text-gray-500 text-xs mt-3">
            {t('WebView, casting and external apps use their own DNS settings.')}
          </Text>
        </View>

        <View className="p-4 flex-row items-center justify-between gap-4">
          <View className="flex-1">
            <Text className="text-white text-base">{t('DNS diagnostics')}</Text>
            {testStatus?.kind === 'success' && (
              <Text className="text-green-400 text-xs mt-1">
                {t('DNS test successful in {{latency}} ms ({{count}} addresses)', {
                  latency: testStatus.latencyMs,
                  count: testStatus.addressCount,
                })}
              </Text>
            )}
            {testStatus?.kind === 'error' && (
              <Text className="text-red-400 text-xs mt-1">
                {t('DNS test failed')}
              </Text>
            )}
          </View>
          <TouchableOpacity
            disabled={isTesting || isUpdating || isLoading}
            onPress={handleTest}
            style={{
              backgroundColor: primary,
              opacity: isTesting || isUpdating || isLoading ? 0.6 : 1,
            }}
            className="px-4 py-2 rounded-lg min-w-24 items-center">
            {isTesting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text className="text-white font-medium">{t('Test DNS')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default DnsSettings;
