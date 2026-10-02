import Animated, {FadeIn} from 'react-native-reanimated';
import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import FontAwesome6 from '@expo/vector-icons/FontAwesome';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {HomeStackParamList, SearchStackParamList} from '../App';
import useContentStore from '../lib/zustand/contentStore';
import useHeroStore from '../lib/zustand/herostore';
import useUiSettingsStore from '../lib/zustand/uiSettingsStore';
import {Feather} from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useHeroMetadata} from '../lib/hooks/useHomePageData';
import {useTranslation} from 'react-i18next';
import RemoteLogo from './RemoteLogo';
import type {ArtworkCandidates} from '../lib/services/artworkSelection';
import SearchSuggestions from './SearchSuggestions';
import {useSearchSuggestions} from '../lib/hooks/useSearchSuggestions';
import {sanitizeSearchQuery} from '../lib/utils/helpers';

interface HeroProps {
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
  onImageError?: (link?: string) => void;
}

const PLACEHOLDER_IMAGE =
  'https://placehold.jp/24/363636/ffffff/500x500.png?text=Vega';

const Hero = memo(({isDrawerOpen, onOpenDrawer, onImageError}: HeroProps) => {
  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestionsSuppressed, setSuggestionsSuppressed] = useState(false);
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);
  const [logoCandidateIndex, setLogoCandidateIndex] = useState(0);
  const {t} = useTranslation();
  const {provider} = useContentStore(state => state);
  const {hero} = useHeroStore(state => state);

  const showHamburgerMenu = useUiSettingsStore(
    state => state.showHamburgerMenu,
  );
  const isDrawerDisabled = useUiSettingsStore(state => state.disableDrawer);

  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const searchNavigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();

  // Use React Query for hero metadata
  const {
    data: heroData,
    isLoading,
    error,
  } = useHeroMetadata(hero?.link || '', provider.value);

  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearchActive(false);
    setSearchText('');
    setSuggestionsSuppressed(false);
  }, []);

  const suggestions = useSearchSuggestions({
    query: searchText,
    enabled: searchActive,
    suppressed: suggestionsSuppressed,
  });

  const handleSearchTextChange = useCallback((text: string) => {
    setSuggestionsSuppressed(false);
    setSearchText(text);
  }, []);

  // Memoized handlers
  const handleSearchSubmit = useCallback(
    (text: string) => {
      const query = text.trim();
      if (!query) {
        return;
      }
      setSuggestionsSuppressed(true);
      closeSearch();
      if (/^https?:\/\//i.test(query)) {
        navigation.navigate('Info', {link: query});
      } else {
        searchNavigation.navigate('ScrollList', {
          providerValue: provider.value,
          filter: query,
          title: provider.display_name,
          isSearch: true,
        });
      }
    },
    [
      closeSearch,
      navigation,
      searchNavigation,
      provider.value,
      provider.display_name,
    ],
  );

  const handleSelectSuggestion = useCallback(
    (title: string) => {
      const cleanTitle = sanitizeSearchQuery(title);
      setSuggestionsSuppressed(true);
      handleSearchSubmit(cleanTitle);
    },
    [handleSearchSubmit],
  );

  const handlePlayPress = useCallback(() => {
    if (hero?.link) {
      navigation.navigate('Info', {
        link: hero.link,
        provider: provider.value,
        poster: heroData?.image || heroData?.poster || heroData?.background,
        variants: hero?.variants,
        dubStatus: hero?.dubStatus,
        dubStatusKey: hero?.dubStatusKey,
      });
    }
  }, [
    navigation,
    hero?.link,
    hero?.variants,
    hero?.dubStatus,
    hero?.dubStatusKey,
    provider.value,
    heroData,
  ]);

  const lastErrorLinkRef = useRef<string | null>(null);

  const backgroundCandidates = React.useMemo(() => {
    const candidates = (heroData as {artworkCandidates?: ArtworkCandidates})
      ?.artworkCandidates?.background;
    const values = candidates?.length
      ? candidates
      : [heroData?.background, heroData?.image, heroData?.poster];
    return Array.from(
      new Set(values.filter((value): value is string => !!value?.trim())),
    );
  }, [heroData]);

  const logoCandidates = React.useMemo(() => {
    const candidates = (heroData as {artworkCandidates?: ArtworkCandidates})
      ?.artworkCandidates?.logo;
    const values = candidates?.length ? candidates : [heroData?.logo];
    return Array.from(
      new Set(values.filter((value): value is string => !!value?.trim())),
    );
  }, [heroData]);

  useEffect(() => {
    setImageCandidateIndex(0);
    lastErrorLinkRef.current = null;
  }, [hero?.link, backgroundCandidates]);

  useEffect(() => {
    setLogoCandidateIndex(0);
  }, [hero?.link, logoCandidates]);

  // Memoized image source
  const currentImageUri = React.useMemo(() => {
    if (!heroData) {
      return PLACEHOLDER_IMAGE;
    }
    return backgroundCandidates[imageCandidateIndex] || PLACEHOLDER_IMAGE;
  }, [heroData, backgroundCandidates, imageCandidateIndex]);
  const imageSource = React.useMemo(
    () => ({uri: currentImageUri}),
    [currentImageUri],
  );

  const handleImageError = useCallback(() => {
    console.warn('Hero image failed to load');
    if (imageCandidateIndex + 1 < backgroundCandidates.length) {
      setImageCandidateIndex(index => index + 1);
      return;
    }
    if (onImageError && hero?.link && lastErrorLinkRef.current !== hero.link) {
      lastErrorLinkRef.current = hero.link;
      onImageError(hero.link);
    }
  }, [
    imageCandidateIndex,
    backgroundCandidates.length,
    onImageError,
    hero?.link,
  ]);

  // Memoized genres
  const displayGenres = React.useMemo(() => {
    if (!heroData) {
      return [];
    }
    const tags = (heroData.genre || heroData.tags || []) as string[];
    const tagKeys = (heroData as {tagKeys?: Record<string, string>}).tagKeys;
    return tags.slice(0, 3).map(tag => {
      const key = tagKeys?.[tag];
      return key ? t(key) : tag;
    });
  }, [heroData, provider.value, t]);
  const displayTitle = React.useMemo(() => {
    if (!heroData) {
      return '';
    }
    if (provider.value !== 'animeunity' && heroData.name) {
      return heroData.name;
    }
    const titleKey = (
      heroData as {
        titleKey?: string;
        titleParams?: Record<string, string | number>;
      }
    ).titleKey;
    if (titleKey) {
      return t(
        titleKey,
        (
          heroData as {
            titleParams?: Record<string, string | number>;
          }
        ).titleParams,
      );
    }
    return heroData.title || '';
  }, [heroData, t]);

  const logoUri = React.useMemo(() => {
    return logoCandidates[logoCandidateIndex] || '';
  }, [logoCandidates, logoCandidateIndex]);

  const handleLogoError = useCallback(() => {
    if (logoCandidateIndex < logoCandidates.length) {
      setLogoCandidateIndex(index => index + 1);
    }
  }, [logoCandidateIndex, logoCandidates.length]);

  if (error) {
    console.error('Hero metadata error:', error);
  }

  return (
    <View className="relative h-[55vh]">
      {/* Header Controls */}
      <View className="absolute pt-3 w-full top-6 px-3 mt-2 z-30 flex-row justify-between items-center">
        {!searchActive && (
          <View
            className={`${
              showHamburgerMenu && !isDrawerDisabled
                ? 'opacity-100'
                : 'opacity-0'
            }`}>
            <Pressable
              className={`${isDrawerOpen ? 'opacity-0' : 'opacity-100'}`}
              onPress={onOpenDrawer}>
              <Ionicons name="menu-sharp" size={27} color="white" />
            </Pressable>
          </View>
        )}

        {!searchActive && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Search in {{provider}}', {
              provider: provider.display_name,
            })}
            onPress={() => setSearchActive(true)}>
            <Feather name="search" size={24} color="white" />
          </Pressable>
        )}
      </View>

      {/* Hero Image */}
      {isLoading ? (
        <View className="h-full w-full bg-gray-800" />
      ) : (
        <Image
          source={imageSource}
          onError={handleImageError}
          className="h-full w-full"
          style={{resizeMode: 'cover'}}
        />
      )}

      {/* Hero Content */}
      <View className="absolute bottom-12 w-full z-20 px-6">
        {!isLoading && heroData && (
          <View className="gap-4 items-center">
            {/* Title/Logo */}
            {logoUri ? (
              <RemoteLogo
                uri={logoUri}
                width={200}
                height={100}
                onError={handleLogoError}
              />
            ) : (
              <Text className="text-white text-center text-2xl font-bold">
                {displayTitle}
              </Text>
            )}

            {/* Genres */}
            {displayGenres.length > 0 && (
              <View className="flex-row items-center justify-center space-x-2">
                {displayGenres.map((genre: string, index: number) => (
                  <Text
                    key={index}
                    className="text-white text-sm font-semibold">
                    • {genre}
                  </Text>
                ))}
              </View>
            )}

            {/* Play Button */}
            <View className="flex-1 items-center justify-center">
              {hero?.link && (
                <TouchableOpacity
                  className="bg-white px-10 py-2 rounded-lg flex-row items-center space-x-2"
                  onPress={handlePlayPress}
                  activeOpacity={0.8}>
                  <FontAwesome6 name="play" size={20} color="black" />
                  <Text className="text-black font-bold text-lg">
                    {t('Play')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Loading state */}
        {isLoading && (
          <View className="items-center">
            <View className="h-[45px] w-[140px] bg-gray-700 rounded" />
          </View>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <View className="items-center">
            <Text className="text-white text-center text-xl font-bold">
              {hero?.title || t('Content Unavailable')}
            </Text>
            <Text className="text-gray-400 text-sm mt-2">
              {t('Unable to load details')}
            </Text>
          </View>
        )}
      </View>

      {/* Gradients */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)', 'black']}
        locations={[0, 0.7, 1]}
        className="absolute h-full w-full"
      />

      {searchActive && (
        <LinearGradient
          colors={['black', 'transparent']}
          locations={[0, 0.3]}
          className="absolute h-[30%] w-full"
        />
      )}

      <Modal
        visible={searchActive}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeSearch}>
        <SafeAreaView className="flex-1 bg-black">
          <Animated.View
            entering={FadeIn.duration(200)}
            className="px-4 pt-4 flex-row items-center">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('Close search')}
              onPress={closeSearch}
              className="p-2 mr-2">
              <Ionicons name="arrow-back" size={26} color="white" />
            </TouchableOpacity>
            <View className="flex-1 flex-row items-center rounded-xl bg-[#141414] px-3">
              <Feather name="search" size={21} color="#999" />
              <TextInput
                testID="provider-search-input"
                autoFocus
                value={searchText}
                onChangeText={handleSearchTextChange}
                onSubmitEditing={event =>
                  handleSearchSubmit(event.nativeEvent.text)
                }
                placeholder={t('Search in {{provider}}', {
                  provider: provider.display_name,
                })}
                placeholderTextColor="#777"
                returnKeyType="search"
                className="flex-1 h-12 px-3 text-white text-base"
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('Clear search')}
                  onPress={() => {
                    setSuggestionsSuppressed(false);
                    setSearchText('');
                  }}
                  className="p-2">
                  <Feather name="x" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
          <View className="flex-1 pt-2">
            {suggestions.length > 0 ? (
              <SearchSuggestions
                suggestions={suggestions}
                onSelectSuggestion={handleSelectSuggestion}
              />
            ) : (
              <View className="flex-1 items-center justify-center px-8">
                <Ionicons name="search" size={34} color="#666" />
                <Text className="text-white/50 text-sm text-center mt-3">
                  {t('Type at least two characters for suggestions')}
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
});

Hero.displayName = 'Hero';

export default Hero;
