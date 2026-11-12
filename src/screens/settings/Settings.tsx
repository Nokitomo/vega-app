import {SafeAreaView} from 'react-native-safe-area-context';
import {settingsPresentation} from '../../components/settingsPresentation';
import {
  View,
  Text,
  Linking,
  TouchableOpacity,
  TouchableNativeFeedback,
  ScrollView,
  useWindowDimensions,
  Alert,
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
import {clearProviderFileCache} from '../../lib/providers/providerFileCache';
import {providerManager} from '../../lib/services/ProviderManager';
import {perfTrace} from '../../lib/utils/perfTrace';

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
  const {width, fontScale} = useWindowDimensions();
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
      perfTrace('provider_selected', {provider: item.value});
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
          width: Math.min(180, Math.max(120, width * 0.3)),
          minHeight: 65 * Math.max(1, fontScale),
          borderWidth: 1.5,
          borderColor: isSelected ? primary : '#333333',
        }}>
        <View className="flex-col items-center justify-center p-2">
          <RenderProviderFlagIcon type={item.type} />
          <Text
            style={settingsPresentation.medium}
            numberOfLines={1}
            className="text-white text-xs font-medium text-center mt-2">
            {item.display_name}
          </Text>
          {isSelected && (
            <Text
              style={[
                settingsPresentation.body,
                {position: 'absolute', top: 6, right: 6},
              ]}>
              <MaterialIcons name="check-circle" size={16} color={primary} />
            </Text>
          )}
        </View>
      </TouchableOpacity>
    ),
    [handleProviderSelect, primary, width, fontScale],
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
    providerManager.clearRuntimeCaches();
    clearProviderFileCache().catch(error => {
      console.warn('Failed to clear provider file cache:', error);
    });
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
    Alert.alert(
      t('Clear Watch History'),
      t(
        'Delete all watch history? This also clears Continue Watching and all saved progress.',
      ),
      [
        {text: t('Cancel'), style: 'cancel'},
        {text: t('Clear All'), style: 'destructive', onPress: clearHistory},
      ],
    );
  }, [clearHistory, t]);

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
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={settingsPresentation.page}>
      <Animated.ScrollView
        className="w-full h-full bg-black"
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="always"
        entering={FadeInUp.springify()}
        layout={Layout.springify()}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: 24,
          flexGrow: 1,
        }}>
        <View className="p-5">
          <Animated.View entering={FadeInUp.springify()}>
            <Text
              style={settingsPresentation.title}
              className="text-2xl font-bold text-white mb-6">
              {t('Settings')}
            </Text>
          </Animated.View>

          {/* Content provider section */}
          <AnimatedSection delay={100}>
            <View className="mb-6 flex-col gap-3">
              <Text
                style={settingsPresentation.body}
                className="text-gray-400 text-sm mb-1">
                {t('Content Provider')}
              </Text>
              <View className="bg-[#141519] rounded-none py-4">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 10,
                  }}>
                  {providersList}
                  {installedProviders.length === 0 && (
                    <Text
                      style={settingsPresentation.body}
                      className="text-gray-500 text-sm">
                      {t('No providers installed')}
                    </Text>
                  )}
                </ScrollView>
              </View>
              {/* Extensions */}
              <TouchableOpacity accessibilityRole="button" style={{minHeight: 56, padding: 16}} onPress={() => navigation.navigate('CatalogSettings')}>
                <Text style={[settingsPresentation.body, {color: primary}]}>{t('catalog.title')}</Text>
              </TouchableOpacity>
              <View className="bg-[#141519] rounded-none overflow-hidden mb-3">
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
                        style={[settingsPresentation.body, {flexShrink: 1}]}>
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
              <Text
                style={settingsPresentation.body}
                className="text-gray-400 text-sm mb-3">
                {t('Options')}
              </Text>
              <View className="bg-[#141519] rounded-none overflow-hidden">
                {/* Account */}
                <TouchableNativeFeedback
                  onPress={() => navigation.navigate('Account')}
                  background={TouchableNativeFeedback.Ripple('#333333', false)}>
                  <View className="flex-row items-center justify-between p-4 border-b border-[#23252b]">
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons
                        name="account-circle-outline"
                        size={22}
                        color={primary}
                      />
                      <Text
                        style={settingsPresentation.body}
                        className="text-white ml-3 text-base">
                        {t('Account')}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="gray" />
                  </View>
                </TouchableNativeFeedback>

                {/* Downloads */}
                <TouchableNativeFeedback
                  onPress={() => navigation.navigate('Downloads')}
                  background={TouchableNativeFeedback.Ripple('#333333', false)}>
                  <View className="flex-row items-center justify-between p-4 border-b border-[#23252b]">
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons
                        name="folder-download"
                        size={22}
                        color={primary}
                      />
                      <Text
                        style={settingsPresentation.body}
                        className="text-white ml-3 text-base">
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
                  <View className="flex-row items-center justify-between p-4 border-b border-[#23252b]">
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons
                        name="subtitles"
                        size={22}
                        color={primary}
                      />
                      <Text
                        style={settingsPresentation.body}
                        className="text-white ml-3 text-base">
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
                <View className="flex-row items-center justify-between p-4 border-b border-[#23252b]">
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
                  <View className="flex-row items-center justify-between p-4 border-b border-[#23252b]">
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
                        style={[settingsPresentation.body, {flexShrink: 1}]}>
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
                      <Text
                        style={settingsPresentation.body}
                        className="text-white ml-3 text-base">
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
              <Text
                style={settingsPresentation.body}
                className="text-gray-400 text-sm mb-3">
                {t('Data Management')}
              </Text>
              <View className="bg-[#141519] rounded-none overflow-hidden">
                {/* Clear Cache */}
                <View className="flex-row items-center justify-between p-4 border-b border-[#23252b]">
                  <Text
                    style={settingsPresentation.body}
                    className="text-white text-base">
                    {t('Clear Cache')}
                  </Text>
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
                  <Text
                    style={settingsPresentation.body}
                    className="text-white text-base flex-1"
                    numberOfLines={1}>
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
              <Text
                style={settingsPresentation.body}
                className="text-gray-400 text-sm mb-3">
                {t('About')}
              </Text>
              <View className="bg-[#141519] rounded-none overflow-hidden">
                {/* About */}
                <TouchableNativeFeedback
                  onPress={() => navigation.navigate('About')}
                  background={TouchableNativeFeedback.Ripple('#333333', false)}>
                  <View className="flex-row items-center justify-between p-4 border-b border-[#23252b]">
                    <View className="flex-row items-center">
                      <Feather name="info" size={22} color={primary} />
                      <Text
                        style={settingsPresentation.body}
                        className="text-white ml-3 text-base">
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
                  <View className="flex-row items-center justify-between p-4 border-b border-[#23252b]">
                    <View className="flex-row items-center">
                      <AntDesign name="github" size={22} color={primary} />
                      <Text
                        style={settingsPresentation.body}
                        className="text-white ml-3 text-base">
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
                      <Text
                        style={settingsPresentation.body}
                        className="text-white ml-3 text-base">
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
    </SafeAreaView>
  );
};

export default Settings;
