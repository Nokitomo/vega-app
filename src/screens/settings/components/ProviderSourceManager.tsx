import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {MaterialCommunityIcons, MaterialIcons} from '@expo/vector-icons';
import {Dropdown} from 'react-native-element-dropdown';
import {useTranslation} from 'react-i18next';
import * as NavigationBar from 'expo-navigation-bar';
import {
  extensionStorage,
  ProviderSource,
} from '../../../lib/storage/extensionStorage';
import {extensionManager} from '../../../lib/services/ExtensionManager';
import {createProviderSource} from '../../../lib/utils/helpers';
import {socialLinks} from '../../../lib/constants';

type Props = {
  primary: string;
  visible: boolean;
  onSourceChanged: (
    source: ProviderSource | undefined,
    options?: {skipRefresh?: boolean},
  ) => void | Promise<void>;
};

type SourceDropdownItem = {
  label: string;
  value: string;
  url: string;
};

const syncDarkNavigationBar = () => {
  if (Platform.OS !== 'android') {
    return;
  }

  NavigationBar.setStyle('dark');
  NavigationBar.setVisibilityAsync('visible').catch(() => {});
};

const ProviderSourceManager = ({primary, visible, onSourceChanged}: Props) => {
  const {t} = useTranslation();
  const [sources, setSources] = useState<ProviderSource[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isDropdownFocused, setIsDropdownFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isValidatingSource, setIsValidatingSource] = useState(false);

  const defaultSource = useMemo(() => {
    return sources.find(item => item.isDefault) || sources[0];
  }, [sources]);

  const dropdownData: SourceDropdownItem[] = useMemo(
    () =>
      sources.map(source => ({
        label: source.author,
        value: source.author,
        url: source.url,
      })),
    [sources],
  );

  const reloadSources = () => {
    setSources(extensionStorage.getProviderSources());
  };

  useEffect(() => {
    if (!visible) {
      return;
    }

    syncDarkNavigationBar();

    const currentSources = extensionStorage.getProviderSources();
    setSources(currentSources);

    if (currentSources.length === 0) {
      setShowAddDialog(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    syncDarkNavigationBar();

    const timer = setTimeout(syncDarkNavigationBar, 80);
    return () => clearTimeout(timer);
  }, [visible, showAddDialog, isDropdownFocused]);

  useEffect(() => {
    if (!showAddDialog) {
      setKeyboardHeight(0);
      return;
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', event => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [showAddDialog]);

  const dismissDialog = () => {
    setShowAddDialog(false);
    setInputValue('');
  };

  const closeDialog = () => {
    if (isValidatingSource) {
      return;
    }
    dismissDialog();
  };

  const handleSelectSource = async (source: ProviderSource) => {
    extensionStorage.setDefaultProviderSource(source.author);
    reloadSources();
    await onSourceChanged(extensionStorage.getProviderSource());
  };

  const handleConfirmAdd = async () => {
    if (isValidatingSource) {
      return;
    }

    setIsValidatingSource(true);
    try {
      const parsedSource = createProviderSource(inputValue);
      const providers = await extensionManager.fetchManifest(
        parsedSource,
        true,
      );

      if (providers.length === 0) {
        throw new Error('Provider source manifest is empty');
      }

      extensionStorage.addProviderSources(
        parsedSource.author,
        parsedSource.url,
      );
      extensionStorage.setDefaultProviderSource(parsedSource.author);
      dismissDialog();
      reloadSources();
      await onSourceChanged(extensionStorage.getProviderSource(), {
        skipRefresh: true,
      });
    } catch (error) {
      Alert.alert(
        t('Invalid source'),
        t('Provider source could not be loaded. Check the URL and try again.'),
      );
    } finally {
      setIsValidatingSource(false);
    }
  };

  const handleRemoveSource = (author: string) => {
    if (sources.length <= 1) {
      Alert.alert(t('Cannot remove'), t('At least one source must remain.'));
      return;
    }

    Alert.alert(
      t('Remove source'),
      t('Remove {{source}} from provider sources?', {source: author}),
      [
        {text: t('Cancel'), style: 'cancel'},
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: async () => {
            const installedForSource = extensionStorage
              .getInstalledProviders()
              .filter(provider => provider.source?.author === author);

            installedForSource.forEach(provider => {
              extensionStorage.uninstallProvider(provider.value, author);
            });

            extensionStorage.removeProviderSource(author);
            reloadSources();
            await onSourceChanged(extensionStorage.getProviderSource());
          },
        },
      ],
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <View className="mx-4 mt-4">
      <View className="flex-row items-center gap-2">
        <View className="flex-1 bg-tertiary rounded-xl px-3 py-2 border border-quaternary">
          <View className="flex-row items-center mb-1">
            <Text className="text-gray-400 text-xs">
              {t('Provider Source')}
            </Text>
            {defaultSource && (
              <MaterialCommunityIcons
                name="check-circle"
                size={14}
                color={primary}
                style={{marginLeft: 6}}
              />
            )}
          </View>

          <Dropdown
            style={{minHeight: 34}}
            data={dropdownData}
            labelField="label"
            valueField="value"
            value={defaultSource?.author}
            placeholder={t('Select a provider source')}
            placeholderStyle={{color: '#9CA3AF'}}
            selectedTextStyle={{
              color: 'white',
              fontSize: 15,
              fontWeight: '600',
            }}
            containerStyle={{
              backgroundColor: '#171717',
              borderColor: '#2B2B2B',
              borderWidth: 1,
              borderRadius: 12,
              overflow: 'hidden',
            }}
            activeColor="#262626"
            itemContainerStyle={{backgroundColor: '#171717'}}
            iconStyle={{width: 20, height: 20}}
            onFocus={() => setIsDropdownFocused(true)}
            onBlur={() => setIsDropdownFocused(false)}
            backgroundColor="rgba(0,0,0,0)"
            onChange={item => {
              const selected = sources.find(
                source => source.author === item.value,
              );
              if (selected) {
                handleSelectSource(selected);
              }
            }}
            renderRightIcon={() => (
              <MaterialIcons
                name={isDropdownFocused ? 'expand-less' : 'expand-more'}
                size={22}
                color="#9CA3AF"
              />
            )}
            renderItem={item => {
              const isSelected = item.value === defaultSource?.author;
              return (
                <View className="px-4 py-3 border-b border-quaternary">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-white font-medium">
                        {item.label}
                      </Text>
                      <Text className="text-gray-400 text-xs" numberOfLines={1}>
                        {item.url}
                      </Text>
                    </View>
                    {isSelected ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={20}
                        color={primary}
                      />
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleRemoveSource(item.value)}>
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={20}
                          color="#F87171"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </View>

        <TouchableOpacity
          className="w-11 h-11 rounded-xl items-center justify-center"
          style={{backgroundColor: primary}}
          onPress={() => setShowAddDialog(true)}>
          <MaterialCommunityIcons name="plus" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showAddDialog}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeDialog}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            className="flex-1 bg-black/70"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: keyboardHeight > 0 ? 'flex-start' : 'center',
              paddingHorizontal: 24,
              paddingTop: keyboardHeight > 0 ? 48 : 24,
              paddingBottom: keyboardHeight > 0 ? keyboardHeight + 24 : 24,
            }}
            keyboardShouldPersistTaps="handled">
            <View
              className="w-full bg-tertiary rounded-2xl p-4 border border-quaternary"
              style={{maxHeight: '92%'}}>
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  className="text-white text-base font-semibold flex-1"
                  numberOfLines={1}>
                  {t('Add Source')}
                </Text>
                <TouchableOpacity onPress={closeDialog}>
                  <MaterialCommunityIcons
                    name="close"
                    size={22}
                    color={isValidatingSource ? '#4B5563' : '#9CA3AF'}
                  />
                </TouchableOpacity>
              </View>
              <Text className="text-white text-sm font-medium">
                {t('Enter source name or url to add provider')}
              </Text>
              <Text className="text-gray-400 text-sm leading-5 mt-2">
                {t('How to get source url check instructions')}{' '}
                <Text
                  className="text-blue-400 text-sm leading-5"
                  onPress={() =>
                    Linking.openURL(socialLinks.github + '#vega-app')
                  }>
                  {t('here')}
                </Text>
              </Text>
              <TextInput
                className="bg-quaternary rounded-lg px-4 text-white border border-gray-700 mt-3"
                style={{minHeight: 52, textAlignVertical: 'center'}}
                placeholder=" "
                placeholderTextColor="#6B7280"
                value={inputValue}
                onChangeText={setInputValue}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
              <View className="flex-row gap-2 mt-3">
                <TouchableOpacity
                  className="flex-1 rounded-lg px-4 py-3 items-center bg-gray-700"
                  disabled={isValidatingSource}
                  style={{opacity: isValidatingSource ? 0.6 : 1}}
                  onPress={closeDialog}>
                  <Text className="text-white font-medium">{t('Cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 rounded-lg px-4 py-3 items-center"
                  disabled={isValidatingSource}
                  style={{
                    backgroundColor: primary,
                    opacity: isValidatingSource ? 0.7 : 1,
                  }}
                  onPress={handleConfirmAdd}>
                  {isValidatingSource ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white font-medium">
                      {t('Confirm')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default ProviderSourceManager;
