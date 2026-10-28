import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import {
  Pressable,
  Text,
  TouchableOpacity,
  View,
  Image,
  useWindowDimensions,
  PanResponder,
  AppState,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import useWatchListStore from '../lib/zustand/watchListStore';
import type {Post} from '../lib/providers/types';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {HomeStackParamList} from '../App';
import useContentStore from '../lib/zustand/contentStore';
import useHeroStore from '../lib/zustand/herostore';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useHeroMetadata} from '../lib/hooks/useHomePageData';
import {useTranslation} from 'react-i18next';
import RemoteLogo from './RemoteLogo';
import type {ArtworkCandidates} from '../lib/services/artworkSelection';
import {useLogoFallback} from '../lib/hooks/useLogoFallback';
import {startPerfNavigation} from '../lib/utils/perfTrace';
import {getMetadataSourceProvider} from '../lib/services/streamCenterMetadata';
import {getProviderCacheScope} from '../lib/utils/providerCacheScope';

interface HeroProps {
  posts?: Post[];
  isActive?: boolean;
  isDrawerOpen: boolean;
  searchActive?: boolean;
  onImageError?: (link?: string) => void;
}

const Hero = memo(
  ({
    isDrawerOpen,
    searchActive = false,
    onImageError,
    posts = [],
    isActive = true,
  }: HeroProps) => {
    const [failedImages, setFailedImages] = useState<Set<string>>(
      () => new Set(),
    );
    const [failedSlides, setFailedSlides] = useState<Set<string>>(
      () => new Set(),
    );
    const [appState, setAppState] = useState(AppState.currentState);
    useEffect(() => {
      const subscription = AppState.addEventListener('change', setAppState);
      return () => subscription.remove();
    }, []);
    const {t} = useTranslation();
    const {provider} = useContentStore(state => state);
    const {hero: storedHero, providerScope} = useHeroStore(state => state);
    const scope = getProviderCacheScope(provider.value);
    const initialHero = providerScope === scope ? storedHero : undefined;
    const {width, height} = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [selectedLink, setSelectedLink] = useState('');
    const slides = React.useMemo(() => {
      const unique = new Map<string, Post>();
      [initialHero, ...posts].forEach(post => {
        if (
          post?.link &&
          !failedSlides.has(post.link) &&
          !unique.has(post.link)
        ) {
          unique.set(post.link, post);
        }
      });
      return Array.from(unique.values()).slice(0, 6);
    }, [initialHero, posts, failedSlides]);
    const page = Math.max(
      0,
      slides.findIndex(post => post.link === selectedLink),
    );
    const hero = slides[page];
    const setPage = useCallback(
      (index: number) => {
        setSelectedLink(slides[index]?.link || '');
      },
      [slides],
    );
    const {watchList, addItem, removeItem} = useWatchListStore();
    const isSaved = watchList.some(item => item.link === hero?.link);
    const swipe = React.useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (_, gesture) =>
            Math.abs(gesture.dx) > 20 &&
            Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
          onPanResponderRelease: (_, gesture) => {
            if (Math.abs(gesture.dx) > 40) {
              setPage(
                Math.max(
                  0,
                  Math.min(slides.length - 1, page + (gesture.dx < 0 ? 1 : -1)),
                ),
              );
            }
          },
        }),
      [slides.length, page, setPage],
    );
    const metadataProvider = getMetadataSourceProvider(
      provider.value,
      hero?.link || '',
    );

    const navigation =
      useNavigation<NativeStackNavigationProp<HomeStackParamList>>();

    // Use React Query for hero metadata
    const {
      data: heroData,
      isLoading,
      error,
    } = useHeroMetadata(hero?.link || '', provider.value);
    useEffect(() => {
      if (
        appState !== 'active' ||
        isLoading ||
        !isActive ||
        searchActive ||
        isDrawerOpen ||
        slides.length < 2
      ) {
        return;
      }
      const timer = setTimeout(
        () => setPage((page + 1) % slides.length),
        10500,
      );
      return () => clearTimeout(timer);
    }, [
      page,
      slides.length,
      isActive,
      searchActive,
      isDrawerOpen,
      isLoading,
      appState,
      setPage,
    ]);

    const handlePlayPress = useCallback(() => {
      if (hero?.link) {
        startPerfNavigation(provider.value);
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

    const reportedLinks = useRef(new Set<string>());

    const backgroundCandidates = React.useMemo(() => {
      const candidates = (heroData as {artworkCandidates?: ArtworkCandidates})
        ?.artworkCandidates?.background;
      const values = candidates?.length
        ? candidates
        : [heroData?.background, heroData?.image, heroData?.poster];
      return Array.from(
        new Set(
          [...values, hero?.image].filter(
            (value): value is string => !!value?.trim(),
          ),
        ),
      );
    }, [heroData, hero?.image]);

    const logoCandidates = React.useMemo(() => {
      const candidates = (heroData as {artworkCandidates?: ArtworkCandidates})
        ?.artworkCandidates?.logo;
      const values = candidates?.length ? candidates : [heroData?.logo];
      return Array.from(
        new Set(values.filter((value): value is string => !!value?.trim())),
      );
    }, [heroData]);

    // Memoized image source
    const currentImageUri = React.useMemo(() => {
      return backgroundCandidates.find(
        uri => !failedImages.has(`${hero?.link}|${uri}`),
      );
    }, [backgroundCandidates, failedImages, hero?.link]);
    const imageSource = React.useMemo(
      () => ({uri: currentImageUri}),
      [currentImageUri],
    );

    const reportHeroFailure = useCallback(
      (failedLink: string) => {
        if (!reportedLinks.current.has(failedLink)) {
          reportedLinks.current.add(failedLink);
          setFailedSlides(previous => new Set(previous).add(failedLink));
          if (failedLink === initialHero?.link) {
            onImageError?.(failedLink);
          }
        }
      },
      [onImageError, initialHero?.link],
    );

    useEffect(() => {
      if (
        !isLoading &&
        hero?.link &&
        ((error && !heroData) || !currentImageUri)
      ) {
        reportHeroFailure(hero.link);
      }
    }, [
      error,
      heroData,
      hero?.link,
      reportHeroFailure,
      isLoading,
      currentImageUri,
    ]);

    const handleImageError = useCallback(() => {
      if (hero?.link && currentImageUri) {
        const imageKey = `${hero.link}|${currentImageUri}`;
        setFailedImages(previous => new Set(previous).add(imageKey));
      }
    }, [currentImageUri, hero?.link]);

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
      if (metadataProvider !== 'animeunity' && heroData.name) {
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
    }, [heroData, metadataProvider, t]);

    const {
      uri: logoUri,
      onError: handleLogoError,
      onLoad: handleLogoLoad,
    } = useLogoFallback({
      providerValue: provider.value,
      link: hero?.link || '',
      candidates: logoCandidates,
    });

    return (
      <View style={{backgroundColor: 'black'}}>
        <View
          style={{
            minHeight: Math.max(560, height * 0.69),
            paddingTop: insets.top + 56,
          }}
          {...swipe.panHandlers}>
          <Pressable
            onPress={handlePlayPress}
            accessibilityRole="button"
            accessibilityLabel={displayTitle || hero?.title}
            style={{position: 'absolute', width: '100%', height: '100%'}}>
            {!currentImageUri ? (
              <View style={{flex: 1, backgroundColor: '#141519'}} />
            ) : (
              <Image
                key={`${hero?.link}|${currentImageUri}`}
                source={imageSource}
                onError={handleImageError}
                style={{width: '100%', height: '100%', resizeMode: 'cover'}}
              />
            )}
            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(0,0,0,0.65)',
                'transparent',
                'rgba(0,0,0,0.25)',
                'black',
              ]}
              locations={[0, 0.24, 0.5, 1]}
              style={{position: 'absolute', width: '100%', height: '100%'}}
            />
          </Pressable>

          <View style={{flex: 1, minHeight: width * 0.65}} />
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 20,
              paddingBottom: 12,
              gap: 12,
            }}>
            {logoUri ? (
              <RemoteLogo
                uri={logoUri}
                width={Math.min(width - 32, 360)}
                height={100}
                onError={handleLogoError}
                onLoad={handleLogoLoad}
              />
            ) : (
              <Text
                numberOfLines={3}
                style={{
                  color: 'white',
                  fontSize: 30,
                  lineHeight: 34,
                  fontWeight: '800',
                }}>
                {displayTitle || hero?.title || t('Home')}
              </Text>
            )}
            {displayGenres.length > 0 && (
              <Text numberOfLines={1} style={{color: '#DADADA', fontSize: 12}}>
                {displayGenres.join(' · ')}
              </Text>
            )}
            {!!heroData?.synopsis && (
              <Text
                numberOfLines={3}
                style={{color: '#F8F8F8', fontSize: 14, lineHeight: 20}}>
                {heroData.synopsis}
              </Text>
            )}
            {(error || (!slides.length && failedSlides.size > 0)) &&
              !isLoading && (
                <Text style={{color: '#A0A0A0'}}>
                  {t('Unable to load details')}
                </Text>
              )}
            {!!hero?.link && (
              <View style={{flexDirection: 'row', gap: 12, marginTop: 12}}>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={handlePlayPress}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 24,
                    backgroundColor: '#FF640A',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: 10,
                  }}>
                  <Ionicons name="play-outline" size={24} color="black" />
                  <Text
                    style={{color: 'black', fontSize: 16, fontWeight: '700'}}>
                    {t('Play')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    isSaved ? 'Remove from watch list' : 'Add to watch list',
                  )}
                  accessibilityState={{selected: isSaved}}
                  onPress={() => {
                    if (isSaved) {
                      removeItem(hero.link);
                    } else {
                      addItem({
                        title: displayTitle || hero.title,
                        poster:
                          heroData?.poster || heroData?.image || hero.image,
                        link: hero.link,
                        provider: provider.value,
                      });
                    }
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 24,
                    borderWidth: 2,
                    borderColor: '#FF640A',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={24}
                    color="#FF640A"
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        {slides.length > 1 && (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              paddingHorizontal: 16,
              paddingTop: 6,
              paddingBottom: 18,
            }}>
            {slides.map((item, index) => (
              <Pressable
                key={item.link}
                onPress={() => setPage(index)}
                accessibilityRole="button"
                accessibilityLabel={t('Home slide', {
                  number: index + 1,
                  total: slides.length,
                })}
                accessibilityState={{selected: page === index}}
                style={{width: 39, height: 28, justifyContent: 'center'}}>
                <View
                  style={{
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: index === page ? '#FF640A' : '#DADADA',
                  }}
                />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  },
);

Hero.displayName = 'Hero';

export default Hero;
