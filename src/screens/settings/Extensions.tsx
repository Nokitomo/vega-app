import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SettingsStackParamList} from '../../App';
import {
  MaterialCommunityIcons,
  MaterialIcons,
  Feather,
  AntDesign,
} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import useContentStore from '../../lib/zustand/contentStore';
import {
  extensionStorage,
  ProviderExtension,
  ProviderSource,
} from '../../lib/storage/extensionStorage';
import {extensionManager} from '../../lib/services/ExtensionManager';
import {
  updateProvidersService,
  UpdateInfo,
} from '../../lib/services/UpdateProviders';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {settingsStorage} from '../../lib/storage';
import RenderProviderFlagIcon from '../../components/RenderProviderFLagIcon';
import {useTranslation} from 'react-i18next';
import ProviderSourceManager from './components/ProviderSourceManager';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Extensions'>;

type TabType = 'installed' | 'available';

const dedupeProviders = (providers: ProviderExtension[]) => {
  const seen = new Set<string>();
  return providers.filter(provider => {
    const value = provider?.value;
    const key = `${provider?.source?.author || 'legacy'}:${value}`;
    if (!value || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const getProviderKey = (provider?: ProviderExtension | null) =>
  provider?.value
    ? `${provider.source?.author || 'legacy'}:${provider.value}`
    : '';

const isSameProvider = (
  left?: ProviderExtension | null,
  right?: ProviderExtension | null,
) => {
  if (!left?.value || !right?.value || left.value !== right.value) {
    return false;
  }

  const leftAuthor = left.source?.author;
  const rightAuthor = right.source?.author;
  return !leftAuthor || !rightAuthor || leftAuthor === rightAuthor;
};

const Extensions = ({navigation}: Props) => {
  const {t} = useTranslation();
  const {primary} = useThemeStore(state => state);
  const {
    provider: activeExtensionProvider,
    setProvider: setActiveExtensionProvider,
    installedProviders,
    availableProviders,
    setInstalledProviders,
    setAvailableProviders,
  } = useContentStore(state => state);
  const [activeTab, setActiveTab] = useState<TabType>(
    installedProviders?.length > 0 ? 'installed' : 'available',
  );
  const [installingProvider, setInstallingProvider] = useState<string | null>(
    null,
  );
  const [updatingProvider, setUpdatingProvider] = useState<string | null>(null);
  const [updateInfos, setUpdateInfos] = useState<UpdateInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSourceAuthor, setActiveSourceAuthor] = useState<string>(
    extensionStorage.getProviderSource()?.author || '',
  );
  // Load providers on component mount
  useEffect(() => {
    const initializeExtensions = async () => {
      try {
        await extensionManager.initialize();
        const source = extensionStorage.getProviderSource();
        const author = source?.author || '';
        setActiveSourceAuthor(author);
        loadProviders(author);
        await checkForUpdates();

        // Try to fetch latest providers if we don't have any
        if (author && (!availableProviders || availableProviders.length === 0)) {
          await refreshProviders(author);
        }
      } catch (error) {
        // Still try to load from cache if initialization fails
        loadProviders();
      }
    };

    initializeExtensions();
  }, []);
  const loadProviders = (author?: string) => {
    const selectedAuthor =
      author || extensionStorage.getProviderSource()?.author || '';
    const installed = dedupeProviders(
      extensionStorage.getInstalledProviders() || [],
    );
    const available = selectedAuthor
      ? dedupeProviders(extensionStorage.getAvailableProviders(selectedAuthor))
      : [];
    setInstalledProviders(installed);
    setAvailableProviders(available.filter(item => item && !item.disabled));
    setActiveSourceAuthor(selectedAuthor);
  };
  const checkForUpdates = async () => {
    const source = extensionStorage.getProviderSource();
    if (!source) {
      setUpdateInfos([]);
      return;
    }

    try {
      const updates = await updateProvidersService.checkForUpdatesManual();
      setUpdateInfos(updates);
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  const handleUpdateProvider = async (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert(t('Error'), t('Invalid provider data'));
      return;
    }

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    const providerKey = getProviderKey(provider);
    setUpdatingProvider(providerKey);
    try {
      const success = await updateProvidersService.updateProvider(provider);
      if (success) {
        loadProviders();
        await checkForUpdates();

        Alert.alert(
          t('Success'),
          t('{{provider}} has been updated successfully!', {
            provider: provider.display_name,
          }),
        );

        // Update the active provider if it was the one being updated
        if (isSameProvider(activeExtensionProvider, provider)) {
          setActiveExtensionProvider(provider);
        }
      } else {
        Alert.alert(
          t('Error'),
          t('Failed to update provider. Please try again.'),
        );
      }
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert(
        t('Error'),
        t('Failed to update provider. Please try again.'),
      );
    } finally {
      setUpdatingProvider(null);
    }
  };

  const handleTabChange = (tab: TabType) => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectTick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    setActiveTab(tab);
  };
  const handleInstallProvider = async (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert(t('Error'), t('Invalid provider data'));
      return;
    }

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    const providerKey = getProviderKey(provider);
    setInstallingProvider(providerKey);
    try {
      await extensionManager.installProvider(provider);
      loadProviders();

      Alert.alert(
        t('Success'),
        t('{{provider}} has been installed successfully!', {
          provider: provider.display_name,
        }),
      );
      setInstalledProviders(extensionStorage.getInstalledProviders() || []);
      if (
        !activeExtensionProvider ||
        !isSameProvider(activeExtensionProvider, provider)
      ) {
        setActiveExtensionProvider(provider);
      }
    } catch (error) {
      console.error('Installation error:', error);
      Alert.alert(
        t('Error'),
        t('Failed to install provider. Please try again.'),
      );
    } finally {
      setInstallingProvider(null);
    }
  };
  const handleUninstallProvider = (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert(t('Error'), t('Invalid provider data'));
      return;
    }

    Alert.alert(
      t('Uninstall Provider'),
      t('Are you sure you want to uninstall {{provider}}?', {
        provider: provider.display_name || t('this provider'),
      }),
      [
        {text: t('Cancel'), style: 'cancel'},
        {
          text: t('Uninstall'),
          style: 'destructive',
          onPress: () => {
            extensionStorage.uninstallProvider(
              provider.value,
              provider.source?.author,
            );
            loadProviders();
            setInstalledProviders(
              extensionStorage.getInstalledProviders() || [],
            );

            // If this was the active provider, clear it
            if (isSameProvider(activeExtensionProvider, provider)) {
              setActiveExtensionProvider(
                extensionStorage.getInstalledProviders()[0] || {
                  value: '',
                  display_name: '',
                  icon: '',
                  disabled: false,
                  installed: false,
                  type: 'global',
                  version: '',
                },
              );
            }
          },
        },
      ],
    );
  };
  const handleSetActiveProvider = (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert(t('Error'), t('Invalid provider data'));
      return;
    }

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    if (provider.source?.author) {
      extensionStorage.setDefaultProviderSource(provider.source.author);
      setActiveSourceAuthor(provider.source.author);
    }
    setActiveExtensionProvider(provider);
  };
  const refreshProviders = async (sourceAuthor: string) => {
    setRefreshing(true);
    try {
      if (!sourceAuthor) {
        setAvailableProviders([]);
        return;
      }

      const source = extensionStorage
        .getProviderSources()
        .find(item => item.author === sourceAuthor);

      if (!source) {
        setAvailableProviders([]);
        return;
      }

      const providers = await extensionManager.fetchManifest(source, true);
      const dedupedProviders = dedupeProviders(providers || []);

      // Update available providers in storage and state
      extensionStorage.setAvailableProviders(sourceAuthor, dedupedProviders);
      setAvailableProviders(dedupedProviders);

      loadProviders(sourceAuthor);
      await checkForUpdates();
    } catch (error) {
      console.error('Refresh error:', error);
      Alert.alert(
        t('Error'),
        t(
          'Failed to refresh providers list. Please check your internet connection.',
        ),
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await refreshProviders(activeSourceAuthor);
  };
  const renderProviderCard = ({item}: {item: ProviderExtension}) => {
    if (!item || !item.value) {
      return null;
    }
    const itemKey = getProviderKey(item);
    const isActive = isSameProvider(activeExtensionProvider, item);
    const isInstalled = extensionStorage.isProviderInstalled(
      item.value,
      item.source?.author,
    );
    const isInstalling = installingProvider === itemKey;
    const isUpdating = updatingProvider === itemKey;
    const updateInfo = updateInfos.find(
      info => isSameProvider(info.provider, item),
    );
    const hasUpdate = updateInfo?.hasUpdate || false;

    return (
      <View
        className="bg-tertiary rounded-2xl p-5 py-3 mb-4 mx-4 shadow-lg border border-quaternary"
        style={{elevation: 4}}>
        <View className="flex-row items-center mb-4 gap-4 justify-between">
          {/* Left: Icon */}
          {item.icon ? (
            <Image
              source={{uri: item.icon}}
              className="w-12 h-12 rounded-xl border-2 border-primary bg-quaternary"
              style={{resizeMode: 'cover'}}
            />
          ) : (
            <View className="px-3 py-2 bg-quaternary rounded-xl border border-gray-700">
              <RenderProviderFlagIcon type={item.type} />
            </View>
          )}
          {/* Middle: Info */}
          <View className="flex-1 mx-3">
            <View className="flex-row items-center flex-wrap">
              <Text className="text-white text-lg font-bold tracking-wide">
                {item.display_name || t('Unknown Provider')}
              </Text>
              {hasUpdate && updateInfo && (
                <View
                  style={{backgroundColor: primary}}
                  className="px-2 py-0.5 rounded-full ml-1">
                  <Text className="text-xs text-white font-semibold bg-gray-800">
                    {t('Update')}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-gray-400 text-sm ">
              {t('Version')}{' '}
              <Text className="text-white font-medium">
                {item.version || t('Unknown')}
              </Text>{' '}
              • {item.type || t('Unknown')}
            </Text>
            {item.source?.author && (
              <Text className="text-gray-500 text-xs" numberOfLines={1}>
                {item.source.author}
              </Text>
            )}
          </View>
          {/* Right: Buttons */}
          <View className="flex-row gap-3 items-center">
            {activeTab === 'installed' ? (
              <>
                <TouchableOpacity
                  onPress={() => handleSetActiveProvider(item)}
                  className={`w-9 h-9 rounded-full items-center justify-center ${
                    isActive ? 'bg-green-600' : 'bg-gray-700'
                  }`}
                  style={{opacity: isActive ? 1 : 0.9}}>
                  <MaterialIcons
                    name={isActive ? 'check-circle' : 'radio-button-unchecked'}
                    size={20}
                    color="white"
                  />
                </TouchableOpacity>
                {hasUpdate && (
                  <TouchableOpacity
                    onPress={() => handleUpdateProvider(updateInfo!.provider)}
                    disabled={isUpdating}
                    className="w-9 h-9 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: primary,
                      opacity: isUpdating ? 0.7 : 1,
                    }}>
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <MaterialCommunityIcons
                        name="update"
                        size={20}
                        color="white"
                      />
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handleUninstallProvider(item)}
                  className="w-9 h-9 rounded-full items-center justify-center bg-red-600">
                  <MaterialCommunityIcons
                    name="delete"
                    size={20}
                    color="white"
                  />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => handleInstallProvider(item)}
                disabled={isInstalled || isInstalling}
                className={'w-9 h-9 rounded-full items-center justify-center'}
                style={{
                  opacity: isInstalling ? 0.7 : 1,
                  backgroundColor: isInstalled ? 'gray' : primary,
                }}>
                {isInstalling ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <MaterialCommunityIcons
                    name={isInstalled ? 'check' : 'download'}
                    size={20}
                    color="white"
                  />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };
  const currentData = useMemo(() => {
    const source =
      activeTab === 'installed' ? installedProviders : availableProviders;
    return dedupeProviders((source || []).filter(item => item && item.value));
  }, [activeTab, installedProviders, availableProviders]);

  return (
    <View className="flex-1 bg-black pt-10 pb-16">
      <StatusBar backgroundColor="black" barStyle="light-content" />
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-gray-800">
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <AntDesign name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-semibold">
          {t('Providers')}
        </Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Feather name="refresh-cw" size={24} color={primary} />
        </TouchableOpacity>
      </View>
      {/* Tabs */}
      <View className="flex-row bg-quaternary mx-4 mt-4 rounded-xl">
        <TouchableOpacity
          onPress={() => handleTabChange('installed')}
          className="flex-1 py-3 rounded-xl"
          style={{
            backgroundColor:
              activeTab === 'installed' ? primary : 'transparent',
          }}>
          <Text
            className={`text-center font-medium ${
              activeTab === 'installed' ? 'text-white' : 'text-gray-400'
            }`}>
            {t('Installed ({{count}})', {
              count: (installedProviders || []).length,
            })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleTabChange('available')}
          className="flex-1 py-3 rounded-xl"
          style={{
            backgroundColor:
              activeTab === 'available' ? primary : 'transparent',
          }}>
          <Text
            className={`text-center font-medium ${
              activeTab === 'available' ? 'text-white' : 'text-gray-400'
            }`}>
            {t('Available ({{count}})', {
              count: (availableProviders || []).length,
            })}
          </Text>
        </TouchableOpacity>
      </View>

      <ProviderSourceManager
        visible={activeTab === 'available'}
        primary={primary}
        onSourceChanged={async (
          source: ProviderSource | undefined,
          options?: {skipRefresh?: boolean},
        ) => {
          const author = source?.author || '';
          setActiveSourceAuthor(author);
          loadProviders(author);
          if (options?.skipRefresh) {
            await checkForUpdates();
            return;
          }
          await refreshProviders(author);
        }}
      />
      {/* Provider list */}
      <FlatList
        data={currentData}
        keyExtractor={(item, index) =>
          item?.value
            ? `${activeTab}-${getProviderKey(item)}`
            : `provider-${index}`
        }
        renderItem={renderProviderCard}
        className="flex-1 mt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[primary]}
            tintColor={primary}
            progressBackgroundColor="black"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <MaterialCommunityIcons
              name="package-variant"
              size={64}
              color="gray"
            />
            <Text className="text-gray-400 text-lg mt-4">
              {activeTab === 'installed'
                ? t('No providers installed')
                : t('No providers available')}
            </Text>
            <Text className="text-gray-500 text-sm mt-2 text-center px-8">
              {activeTab === 'installed'
                ? t('Install providers from the Available tab to get started')
                : t('Pull to refresh to check for available providers')}
            </Text>
          </View>
        }
      />
    </View>
  );
};

export default Extensions;
