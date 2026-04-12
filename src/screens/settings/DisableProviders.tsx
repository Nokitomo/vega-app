import {
  View,
  Text,
  ScrollView,
  StatusBar,
  Switch,
  TouchableOpacity,
} from 'react-native';
import React, {useState} from 'react';
import {providersStorage} from '../../lib/storage';
import useThemeStore from '../../lib/zustand/themeStore';
import {SvgUri} from 'react-native-svg';
import {useTranslation} from 'react-i18next';
import useContentStore from '../../lib/zustand/contentStore';

const DisableProviders = () => {
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const {installedProviders} = useContentStore(state => state);
  const [disabledProviders, setDisabledProviders] = useState<string[]>(
    providersStorage.getDisabledProviders(),
  );

  const toggleProvider = (providerId: string) => {
    const newDisabled = providersStorage.toggleProvider(providerId);
    setDisabledProviders(newDisabled);
  };

  const enableAll = () => {
    providersStorage.enableAllProviders();
    setDisabledProviders([]);
  };

  return (
    <ScrollView
      className="w-full h-full bg-black"
      contentContainerStyle={{
        paddingTop: StatusBar.currentHeight || 0,
      }}>
      <View className="p-5">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-white">
            {t('Disable Providers')}
          </Text>
          <TouchableOpacity
            onPress={enableAll}
            className="bg-[#262626] px-4 py-2 rounded-lg">
            <Text className="text-white text-xs">{t('Enable All')}</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-gray-400 text-sm mb-3">
          {t("Disabled providers won't appear in search results")}
        </Text>

        <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
          {installedProviders.map((provider, index) => (
            <View
              key={provider.value}
              className={`flex-row items-center justify-between p-4 ${
                index !== installedProviders.length - 1
                  ? 'border-b border-[#262626]'
                  : ''
              }`}>
              <View className="flex-row items-center">
                <View className="bg-[#262626] p-2 rounded-lg mr-3">
                  <SvgUri width={24} height={24} uri={provider.icon} />
                </View>
                <View>
                  <Text className="text-white text-base">
                    {provider.display_name}
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    {provider.type || t('Content Provider')}
                  </Text>
                </View>
              </View>
              <Switch
                thumbColor={
                  !disabledProviders.includes(provider.value) ? primary : 'gray'
                }
                value={!disabledProviders.includes(provider.value)}
                onValueChange={() => toggleProvider(provider.value)}
              />
            </View>
          ))}
        </View>

        <Text className="text-gray-400 text-xs text-center mt-4">
          {t('Changes will apply to new searches')}
        </Text>
      </View>
    </ScrollView>
  );
};

export default DisableProviders;
