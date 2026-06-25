import {View, Text, ScrollView, TouchableOpacity} from 'react-native';
import React from 'react';
import useContentStore from '../lib/zustand/contentStore';
import useThemeStore from '../lib/zustand/themeStore';
import {BlurView} from 'expo-blur';
import {MaterialIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {ProviderExtension, extensionStorage} from '../lib/storage';

const getProviderKey = (item: ProviderExtension) =>
  `${item.source?.author || 'legacy'}:${item.value}`;

const isSameProvider = (left: ProviderExtension, right: ProviderExtension) => {
  if (left.value !== right.value) {
    return false;
  }

  const leftAuthor = left.source?.author;
  const rightAuthor = right.source?.author;
  return !leftAuthor || !rightAuthor || leftAuthor === rightAuthor;
};

const ProviderDrawer = ({onClose}: {onClose: () => void}) => {
  const {t} = useTranslation();
  const {provider, setProvider, installedProviders} = useContentStore(
    state => state,
  );
  const {primary} = useThemeStore(state => state);

  return (
    <BlurView
      intensity={90}
      experimentalBlurMethod="dimezisBlurView"
      blurReductionFactor={5}
      tint="dark"
      className="flex-1">
      <View className="mt-8 px-4 pb-4 border-b border-white/10">
        <Text className="text-white text-2xl font-bold">
          {t('Select Provider')}
        </Text>
        <Text className="text-gray-400 mt-1 text-sm">
          {t('Content source')}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-2">
        {installedProviders.map(item => {
          const isSelected = isSameProvider(provider, item);
          return (
            <TouchableOpacity
              key={getProviderKey(item)}
              onPress={() => {
                if (item.source?.author) {
                  extensionStorage.setDefaultProviderSource(item.source.author);
                }
                setProvider(item);
                onClose();
              }}
              className={`flex-row items-center justify-between p-4 my-1 rounded-lg ${
                isSelected ? 'bg-white/10' : 'bg-transparent'
              }`}>
              <View className="flex-row items-center">
                <MaterialIcons
                  name="movie"
                  size={20}
                  color={isSelected ? primary : '#888'}
                />
                <Text
                  className={`ml-3 text-base ${
                    isSelected ? 'text-white font-medium' : 'text-gray-400'
                  }`}>
                  {item.display_name}
                </Text>
              </View>
              {isSelected && (
                <MaterialIcons name="check" size={20} color={primary} />
              )}
            </TouchableOpacity>
          );
        })}
        <View className="h-16" />
      </ScrollView>
    </BlurView>
  );
};

export default ProviderDrawer;
