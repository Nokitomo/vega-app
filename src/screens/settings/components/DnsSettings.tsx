import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
  Text,
  TextInput,
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
  validateCustomDohUrl,
} from '../../../lib/services/dns';
import {WarpStatus, warpService} from '../../../lib/services/warp';

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
  if (provider.id === 'custom') {
    return t('Custom');
  }
  return provider.name;
};

const DnsSettings = ({primary}: DnsSettingsProps) => {
  const {t} = useTranslation();
  const [providers, setProviders] = useState<DnsProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] =
    useState<DnsProviderId>('cloudflare');
  const [activeProviderId, setActiveProviderId] =
    useState<DnsProviderId>('cloudflare');
  const [customUrl, setCustomUrl] = useState('');
  const [savedCustomUrl, setSavedCustomUrl] = useState('');
  const [customUrlError, setCustomUrlError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>(null);
  const [warpStatus, setWarpStatus] = useState<WarpStatus | null>(null);
  const [isUpdatingWarp, setIsUpdatingWarp] = useState(false);

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
        setActiveProviderId(state.selectedProviderId);
        setCustomUrl(state.customUrl ?? '');
        setSavedCustomUrl(state.customUrl ?? '');
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

  useEffect(() => {
    let mounted = true;
    if (!warpService.isAvailable) {
      return () => {
        mounted = false;
      };
    }

    const refresh = () => {
      warpService
        .getStatus()
        .then(status => {
          if (mounted) {
            setWarpStatus(status);
          }
        })
        .catch(error => {
          console.warn('Unable to load WARP status:', error);
        });
    };

    refresh();
    const interval = setInterval(refresh, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
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
    if (isUpdating) {
      return;
    }

    if (providerId === selectedProviderId && providerId === activeProviderId) {
      return;
    }

    setSelectedProviderId(providerId);
    setCustomUrlError(null);
    setTestStatus(null);

    if (providerId === 'custom' && !savedCustomUrl) {
      return;
    }

    if (providerId === activeProviderId) {
      return;
    }

    setIsUpdating(true);

    try {
      await dnsService.setSelectedProvider(providerId);
      setActiveProviderId(providerId);
      ToastAndroid.show(t('DNS provider updated'), ToastAndroid.SHORT);
    } catch (error) {
      console.warn('Unable to update DNS provider:', error);
      setSelectedProviderId(activeProviderId);
      ToastAndroid.show(t('Failed to update DNS provider'), ToastAndroid.LONG);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCustomProviderApply = async () => {
    if (isUpdating) {
      return;
    }

    const validation = validateCustomDohUrl(customUrl);
    if (!validation.valid) {
      setCustomUrlError(
        validation.reason === 'empty'
          ? t('Custom DoH URL is required')
          : t(
              'Enter a valid HTTPS DoH URL without credentials, query parameters or fragments.',
            ),
      );
      return;
    }

    setIsUpdating(true);
    setCustomUrlError(null);
    setTestStatus(null);
    try {
      const normalizedUrl = await dnsService.setCustomProvider(
        validation.normalizedUrl,
      );
      setCustomUrl(normalizedUrl);
      setSavedCustomUrl(normalizedUrl);
      setSelectedProviderId('custom');
      setActiveProviderId('custom');
      ToastAndroid.show(t('DNS provider updated'), ToastAndroid.SHORT);
    } catch (error) {
      console.warn('Unable to update custom DNS provider:', error);
      setCustomUrlError(
        t(
          'Enter a valid HTTPS DoH URL without credentials, query parameters or fragments.',
        ),
      );
      ToastAndroid.show(t('Failed to update DNS provider'), ToastAndroid.LONG);
    } finally {
      setIsUpdating(false);
    }
  };

  const hasPendingConfiguration =
    selectedProviderId !== activeProviderId ||
    (selectedProviderId === 'custom' && customUrl.trim() !== savedCustomUrl);

  const handleTest = async () => {
    if (isTesting || isUpdating || hasPendingConfiguration) {
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

  const updateWarp = async (enabled: boolean) => {
    if (isUpdatingWarp) {
      return;
    }
    setIsUpdatingWarp(true);
    try {
      const status = await warpService.setEnabled(enabled);
      setWarpStatus(status);
      ToastAndroid.show(
        enabled ? t('WARP enabled') : t('WARP disabled'),
        ToastAndroid.SHORT,
      );
    } catch (error) {
      console.warn('Unable to update WARP:', error);
      setWarpStatus(current =>
        current ? {...current, state: 'error', running: false, port: null} : current,
      );
      ToastAndroid.show(t('Failed to update WARP'), ToastAndroid.LONG);
    } finally {
      setIsUpdatingWarp(false);
    }
  };

  const handleWarpToggle = (enabled: boolean) => {
    if (!enabled) {
      updateWarp(false);
      return;
    }

    Alert.alert(
      t('Enable WARP?'),
      t(
        'Vega will register an independent WARP client and route supported app traffic through Cloudflare. By continuing, you accept Cloudflare terms. This is not a device VPN.',
      ),
      [
        {text: t('Cancel'), style: 'cancel'},
        {text: t('Enable'), onPress: () => updateWarp(true)},
      ],
    );
  };

  return (
    <View className="mb-6">
      <Text className="text-gray-400 text-sm mb-3">{t('Network')}</Text>
      <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
        {warpService.isAvailable && (
          <View className="p-4 border-b border-[#262626]">
            <View className="flex-row items-center justify-between gap-4">
              <View className="flex-1">
                <Text className="text-white text-base font-medium">
                  {t('Cloudflare WARP')}
                </Text>
                <Text className="text-gray-400 text-xs mt-1">
                  {t(
                    'Route supported Vega requests and internal player traffic through WARP. It does not affect WebView, casting or other apps.',
                  )}
                </Text>
                <Text
                  className={`text-xs mt-2 ${
                    warpStatus?.running
                      ? 'text-green-400'
                      : warpStatus?.state === 'error'
                        ? 'text-red-400'
                        : 'text-gray-500'
                  }`}>
                  {isUpdatingWarp
                    ? t('WARP is connecting…')
                    : warpStatus?.running
                      ? t('WARP is active')
                      : warpStatus?.state === 'error'
                        ? t('WARP connection failed')
                        : t('WARP is inactive')}
                </Text>
              </View>
              {isUpdatingWarp ? (
                <ActivityIndicator color={primary} />
              ) : (
                <Switch
                  value={Boolean(warpStatus?.running)}
                  disabled={!warpStatus?.supported}
                  onValueChange={handleWarpToggle}
                  trackColor={{false: '#3A3A3A', true: primary}}
                  thumbColor="white"
                />
              )}
            </View>
          </View>
        )}
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
          {selectedProviderId === 'custom' && (
            <View className="mt-4">
              <Text className="text-gray-300 text-sm mb-2">
                {t('Custom DoH URL')}
              </Text>
              <TextInput
                value={customUrl}
                onChangeText={value => {
                  setCustomUrl(value);
                  setCustomUrlError(null);
                  setTestStatus(null);
                }}
                editable={!isUpdating}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                maxLength={2048}
                placeholder="https://resolver.example/dns-query"
                placeholderTextColor="#737373"
                className="bg-[#262626] text-white rounded-lg px-3 py-3"
              />
              <Text className="text-gray-500 text-xs mt-2">
                {t(
                  'Use an HTTPS DoH endpoint. Credentials, query parameters and fragments are not allowed.',
                )}
              </Text>
              {customUrlError && (
                <Text className="text-red-400 text-xs mt-2">
                  {customUrlError}
                </Text>
              )}
              <TouchableOpacity
                disabled={isUpdating}
                onPress={handleCustomProviderApply}
                style={{
                  backgroundColor: primary,
                  opacity: isUpdating ? 0.6 : 1,
                }}
                className="self-end px-4 py-2 rounded-lg min-w-24 items-center mt-3">
                {isUpdating ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-medium">{t('Apply')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
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
            disabled={
              isTesting || isUpdating || isLoading || hasPendingConfiguration
            }
            onPress={handleTest}
            style={{
              backgroundColor: primary,
              opacity:
                isTesting || isUpdating || isLoading || hasPendingConfiguration
                  ? 0.6
                  : 1,
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
