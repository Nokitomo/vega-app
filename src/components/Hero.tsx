import Animated, {FadeIn} from 'react-native-reanimated';
import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import {
  Keyboard,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
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

interface HeroProps {
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
  onImageError?: (link?: string) => void;
}

const PLACEHOLDER_IMAGE =
  'https://placehold.jp/24/363636/ffffff/500x500.png?text=Vega';

const Hero = memo(({isDrawerOpen, onOpenDrawer, onImageError}: HeroProps) => {
  const [searchActive, setSearchActive] = useState(false);
  const [imageFallback, setImageFallback] = useState<string | null>(null);
  const [logoFallbackMode, setLogoFallbackMode] = useState<
    'provider' | 'cinemeta' | 'text'
  >('text');
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

  // Memoized keyboard handler
  const handleKeyboardHide = useCallback(() => {
    setSearchActive(false);
  }, []);

  // Set up keyboard listener once
  React.useEffect(() => {
    const subscription = Keyboard.addListener(
      'keyboardDidHide',
      handleKeyboardHide,
    );
    return () => subscription?.remove();
  }, [handleKeyboardHide]);

  // Memoized handlers
  const handleSearchSubmit = useCallback(
    (text: string) => {
      if (text.startsWith('https://')) {
        navigation.navigate('Info', {link: text});
      } else {
        searchNavigation.navigate('ScrollList', {
          providerValue: provider.value,
          filter: text,
          title: provider.display_name,
          isSearch: true,
        });
      }
    },
    [navigation, searchNavigation, provider.value, provider.display_name],
  );

  const handlePlayPress = useCallback(() => {
    if (hero?.link) {
      navigation.navigate('Info', {
        link: hero.link,
        provider: provider.value,
        poster: heroData?.image || heroData?.poster || heroData?.background,
      });
    }
  }, [navigation, hero?.link, provider.value, heroData]);

  const heroFallbackImage = hero?.image || '';
  const lastErrorLinkRef = useRef<string | null>(null);

  useEffect(() => {
    setImageFallback(null);
    lastErrorLinkRef.current = null;
  }, [hero?.link]);

  const providerLogo = React.useMemo(() => {
    const value = (heroData as {providerLogo?: string; logo?: string}) || {};
    return (value.providerLogo || value.logo || '').trim();
  }, [heroData]);

  const cinemetaLogo = React.useMemo(() => {
    const value = (heroData as {cinemetaLogo?: string}) || {};
    return (value.cinemetaLogo || '').trim();
  }, [heroData]);

  useEffect(() => {
    if (providerLogo) {
      setLogoFallbackMode('provider');
      return;
    }
    if (cinemetaLogo) {
      setLogoFallbackMode('cinemeta');
      return;
    }
    setLogoFallbackMode('text');
  }, [hero?.link, providerLogo, cinemetaLogo]);

  // Memoized image source
  const currentImageUri = React.useMemo(() => {
    if (!heroData) {
      return PLACEHOLDER_IMAGE;
    }
    return (
      imageFallback ||
      heroData.background ||
      heroData.image ||
      heroData.poster ||
      PLACEHOLDER_IMAGE
    );
  }, [heroData, imageFallback]);
  const imageSource = React.useMemo(
    () => ({uri: currentImageUri}),
    [currentImageUri],
  );

  const handleImageError = useCallback(() => {
    // Handle image error silently - React Query will manage retries
    console.warn('Hero image failed to load');
    if (
      !imageFallback &&
      heroFallbackImage &&
      heroFallbackImage !== currentImageUri
    ) {
      setImageFallback(heroFallbackImage);
    }
    if (onImageError && hero?.link && lastErrorLinkRef.current !== hero.link) {
      lastErrorLinkRef.current = hero.link;
      onImageError(hero.link);
    }
  }, [
    imageFallback,
    heroFallbackImage,
    currentImageUri,
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
    const titleKey = (heroData as {
      titleKey?: string;
      titleParams?: Record<string, string | number>;
    }).titleKey;
    if (titleKey) {
      return t(
        titleKey,
        (heroData as {
          titleParams?: Record<string, string | number>;
        }).titleParams,
      );
    }
    return heroData.title || '';
  }, [heroData, t]);

  const logoUri = React.useMemo(() => {
    if (logoFallbackMode === 'provider') {
      return providerLogo;
    }
    if (logoFallbackMode === 'cinemeta') {
      return cinemetaLogo;
    }
    return '';
  }, [logoFallbackMode, providerLogo, cinemetaLogo]);

  const handleLogoError = useCallback(() => {
    if (
      logoFallbackMode === 'provider' &&
      cinemetaLogo &&
      cinemetaLogo !== providerLogo
    ) {
      setLogoFallbackMode('cinemeta');
      return;
    }
    setLogoFallbackMode('text');
  }, [logoFallbackMode, cinemetaLogo, providerLogo]);

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

        {searchActive && (
          <Animated.View
            entering={FadeIn.duration(300)}
            className="w-full items-center justify-center">
            <TextInput
              onBlur={() => setSearchActive(false)}
              autoFocus={true}
              onSubmitEditing={e => handleSearchSubmit(e.nativeEvent.text)}
              placeholder={t('Search in {{provider}}', {
                provider: provider.display_name,
              })}
              className="w-[95%] px-4 h-10 rounded-full border-white border"
              placeholderTextColor="#999"
              textAlignVertical="center"
              style={{paddingVertical: 0}}
            />
          </Animated.View>
        )}

        {!searchActive && (
          <Pressable onPress={() => setSearchActive(true)}>
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
              <Image
                source={{uri: logoUri}}
                style={{
                  width: 200,
                  height: 100,
                  resizeMode: 'contain',
                }}
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
    </View>
  );
});

Hero.displayName = 'Hero';

export default Hero;
