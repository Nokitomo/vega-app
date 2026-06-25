import {
  View,
  Text,
  Linking,
  TouchableOpacity,
  TouchableNativeFeedback,
  ScrollView,
  Dimensions,
} from 'react-native';
import React, {useCallback, useMemo} from 'react';
import {
  settingsStorage,
  cacheStorageService,
  ProviderExtension,
  extensionStorage,
} from '../../lib/storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../../lib/zustand/contentStore';
import {socialLinks} from '../../lib/constants';
import {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import {SettingsStackParamList, TabStackParamList} from '../../App';
import {
  MaterialCommunityIcons,
  AntDesign,
  Feather,
  MaterialIcons,
} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import useWatchHistoryStore from '../../lib/zustand/watchHistrory';
import Animated, {FadeInDown, FadeInUp, Layout} from 'react-native-reanimated';
import {useNavigation} from '@react-navigation/native';
import RenderProviderFlagIcon from '../../components/RenderProviderFLagIcon';
import {useTranslation} from 'react-i18next';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Settings'>;

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

const Settings = ({navigation}: Props) => {
  const {t} = useTranslation();
  const tabNavigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const {primary} = useThemeStore(state => state);
  const {provider, setProvider, installedProviders} = useContentStore(
    state => state,
  );
  const {clearHistory} = useWatchHistoryStore(state => state);

  const handleProviderSelect = useCallback(
    (item: ProviderExtension) => {
      if (item.source?.author) {
        extensionStorage.setDefaultProviderSource(item.source.author);
      }
      setProvider(item);
      // Add haptic feedback
      if (settingsStorage.isHapticFeedbackEnabled()) {
        ReactNativeHapticFeedback.trigger('virtualKey', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
      // Navigate to home screen
      tabNavigation.navigate('HomeStack');
    },
    [setProvider, tabNavigation],
  );

  const renderProviderItem = useCallback(
    (item: ProviderExtension, isSelected: boolean) => (
      <TouchableOpacity
        key={getProviderKey(item)}
        onPress={() => handleProviderSelect(item)}
        className={`mr-3 rounded-lg ${
          isSelected ? 'bg-[#333333]' : 'bg-[#262626]'
        }`}
        style={{
          width: Dimensions.get('window').width * 0.3, // Shows 2.5 items
          height: 65, // Increased height
          borderWidth: 1.5,
          borderColor: isSelected ? primary : '#333333',
        }}>
        <View className="flex-col items-center justify-center h-full p-2">
          <RenderProviderFlagIcon type={item.type} />
          <Text
            numberOfLines={1}
            className="text-white text-xs font-medium text-center mt-2">
            {item.display_name}
          </Text>
          {isSelected && (
            <Text style={{position: 'absolute', top: 6, right: 6}}>
              <MaterialIcons name="check-circle" size={16} color={primary} />
            </Text>
          )}
        </View>
      </TouchableOpacity>
    ),
    [handleProviderSelect, primary],
  );

  const providersList = useMemo(
    () =>
      installedProviders.map(item =>
        renderProviderItem(item, isSameProvider(provider, item)),
      ),
    [installedProviders, provider, renderProviderItem],
  );

  const clearCacheHandler = useCallback(() => {
    console.log('[Settings] Clear Cache pressed');
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    cacheStorageService.clearAll();
    console.log('[Settings] Cache cleared');
  }, []);

  const clearHistoryHandler = useCallback(() => {
    console.log('[Settings] Clear Watch History pressed');
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    clearHistory();
    console.log('[Settings] Watch history cleared');
  }, [clearHistory]);

  const AnimatedSection = ({
    delay,
    children,
  }: {
    delay: number;
    children: React.ReactNode;
  }) => (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      layout={Layout.springify()}>
      {children}
    </Animated.View>
  );

  return (
    <Animated.ScrollView
      className="w-full h-full bg-black"
      showsVerticalScrollIndicator={false}
      bounces={true}
      overScrollMode="always"
      entering={FadeInUp.springify()}
      layout={Layout.springify()}
      contentContainerStyle={{
        paddingTop: 15,
        paddingBottom: 24,
        flexGrow: 1,
      }}>
      <View className="p-5">
        <Animated.View entering={FadeInUp.springify()}>
          <Text className="text-2xl font-bold text-white mb-6">
            {t('Settings')}
          </Text>
        </Animated.View>

        {/* Content provider section */}
        <AnimatedSection delay={100}>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">
              {t('Content Provider')}
            </Text>
            <View className="bg-[#1A1A1A] rounded-xl py-4">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 10,
                }}>
                {providersList}
                {installedProviders.length === 0 && (
                  <Text className="text-gray-500 text-sm">
                    {t('No providers installed')}
                  </Text>
                )}
              </ScrollView>
            </View>
            {/* Extensions */}
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden mb-3">
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('Extensions')}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4">
                  <View
                    className="flex-row items-center flex-1"
                    style={{minWidth: 0}}>
                    <MaterialCommunityIcons
                      name="puzzle"
                      size={22}
                      color={primary}
                    />
                    <Text
                      className="text-white ml-3 text-base"
                      numberOfLines={1}
                      style={{flexShrink: 1}}>
                      {t('Provider Manager')}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>
            </View>
          </View>
        </AnimatedSection>

        {/* Main options section */}
        <AnimatedSection delay={200}>
          <View className="mb-6">
            <Text className="text-gray-400 text-sm mb-3">{t('Options')}</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              {/* Downloads */}
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('Downloads')}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons
                      name="folder-download"
                      size={22}
                      color={primary}
                    />
                    <Text className="text-white ml-3 text-base">
                      {t('Downloads')}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* Subtitle Style */}
              <TouchableNativeFeedback
                onPress={async () => {
                  navigation.navigate('SubTitlesPreferences');
                }}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons
                      name="subtitles"
                      size={22}
                      color={primary}
                    />
                    <Text className="text-white ml-3 text-base">
                      {t('Subtitle Style')}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* Disable Providers */}
              {/* <TouchableNativeFeedback
                onPress={() => navigation.navigate('DisableProviders')}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                  <View className="flex-row items-center">
                    <MaterialIcons name="block" size={22} color={primary} />
                    <Text className="text-white ml-3 text-base">
                      Disable Providers in Search
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback> */}

              {/* Watch History */}
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('WatchHistoryStack')}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                  <View
                    className="flex-row items-center flex-1"
                    style={{minWidth: 0}}>
                    <MaterialCommunityIcons
                      name="history"
                      size={22}
                      color={primary}
                    />
                    <Text
                      className="text-white ml-3 text-base"
                      numberOfLines={1}
                      style={{flexShrink: 1}}>
                      {t('Watch History')}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* Preferences */}
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('Preferences')}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4">
                  <View className="flex-row items-center">
                    <MaterialIcons
                      name="room-preferences"
                      size={22}
                      color={primary}
                    />
                    <Text className="text-white ml-3 text-base">
                      {t('Preferences')}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>
            </View>
          </View>
        </AnimatedSection>

        {/* Data Management section */}
        <AnimatedSection delay={300}>
          <View className="mb-6">
            <Text className="text-gray-400 text-sm mb-3">
              {t('Data Management')}
            </Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              {/* Clear Cache */}
              <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                <Text className="text-white text-base">{t('Clear Cache')}</Text>
                <TouchableOpacity
                  className="bg-[#262626] px-4 py-2 rounded-lg"
                  onPress={clearCacheHandler}>
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={20}
                    color={primary}
                  />
                </TouchableOpacity>
              </View>

              {/* Clear Watch History */}
              <View className="flex-row items-center justify-between p-4">
                <Text className="text-white text-base flex-1" numberOfLines={1}>
                  {t('Clear Watch History')}
                </Text>
                <TouchableOpacity
                  className="bg-[#262626] px-4 py-2 rounded-lg"
                  onPress={clearHistoryHandler}>
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={20}
                    color={primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </AnimatedSection>

        {/* About & GitHub section */}
        <AnimatedSection delay={400}>
          <View className="mb-6">
            <Text className="text-gray-400 text-sm mb-3">{t('About')}</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              {/* About */}
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('About')}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                  <View className="flex-row items-center">
                    <Feather name="info" size={22} color={primary} />
                    <Text className="text-white ml-3 text-base">
                      {t('About')}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* GitHub */}
              <TouchableNativeFeedback
                onPress={() => Linking.openURL(socialLinks.github)}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                  <View className="flex-row items-center">
                    <AntDesign name="github" size={22} color={primary} />
                    <Text className="text-white ml-3 text-base">
                      {t('Give a star ⭐')}
                    </Text>
                  </View>
                  <Feather name="external-link" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* sponsore */}
              <TouchableNativeFeedback
                onPress={() => Linking.openURL(socialLinks.sponsor)}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4">
                  <View className="flex-row items-center">
                    <AntDesign name="heart" size={22} color="#ff69b4" />
                    <Text className="text-white ml-3 text-base">
                      {t('Sponsor Project')}
                    </Text>
                  </View>
                  <Feather name="external-link" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>
            </View>
          </View>
        </AnimatedSection>
      </View>
    </Animated.ScrollView>
  );
};

export default Settings;
