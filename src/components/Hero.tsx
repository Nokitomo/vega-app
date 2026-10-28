import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import {
  Pressable,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Easing,
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
import {perfNow, perfTrace, startPerfNavigation} from '../lib/utils/perfTrace';
import {getMetadataSourceProvider} from '../lib/services/streamCenterMetadata';
import {getProviderCacheScope} from '../lib/utils/providerCacheScope';
import {useReducedMotion} from '../lib/hooks/useReducedMotion';
import HeroArtwork from './HeroArtwork';

type HeroCardProps = {
  hero: Post;
  provider: {value: string};
  reducedMotion: boolean;
  onFailure: (link: string) => void;
  onReady: (link: string, ready: boolean) => void;
};

const HeroCard = memo(
  ({hero, provider, reducedMotion, onFailure, onReady}: HeroCardProps) => {
    const {t} = useTranslation();
    const navigationSize = useWindowDimensions();
    const {width, height} = navigationSize;
    const insets = useSafeAreaInsets();
    const [failedImages, setFailedImages] = useState<Set<string>>(
      () => new Set(),
    );
    const [loadedBackground, setLoadedBackground] = useState('');
    const [loadedLogo, setLoadedLogo] = useState('');
    const preparationStarted = useRef(perfNow());
    const reportedReady = useRef(false);
    const {watchList, addItem, removeItem} = useWatchListStore();
    const isSaved = watchList.some(item => item.link === hero?.link);
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

    useEffect(() => {
      if (
        !isLoading &&
        hero?.link &&
        ((error && !heroData) || !currentImageUri)
      ) {
        onFailure(hero.link);
      }
    }, [error, heroData, hero?.link, onFailure, isLoading, currentImageUri]);

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
      isResolving: resolvingLogo,
    } = useLogoFallback({
      providerValue: provider.value,
      link: hero?.link || '',
      candidates: logoCandidates,
    });

    const ready =
      !!heroData &&
      !isLoading &&
      !!currentImageUri &&
      loadedBackground === currentImageUri &&
      !resolvingLogo &&
      (!logoUri || loadedLogo === logoUri);
    useEffect(() => {
      if (ready && !reportedReady.current) {
        reportedReady.current = true;
        perfTrace('hero_ready', {
          provider: provider.value,
          durationMs: Math.round(perfNow() - preparationStarted.current),
        });
      }
      onReady(hero.link, ready);
      return () => onReady(hero.link, false);
    }, [hero.link, ready, onReady, provider.value]);
    return (
      <View style={{backgroundColor: 'black'}}>
        <View
          style={{
            minHeight: Math.max(560, height * 0.69),
            paddingTop: insets.top + 56,
          }}>
          <Pressable
            onPress={handlePlayPress}
            accessibilityRole="button"
            accessibilityLabel={displayTitle || hero?.title}
            style={{position: 'absolute', width: '100%', height: '100%'}}>
            {!currentImageUri ? (
              <View style={{flex: 1, backgroundColor: '#141519'}} />
            ) : (
              <HeroArtwork
                key={`${hero?.link}|${currentImageUri}`}
                uri={currentImageUri}
                reducedMotion={reducedMotion}
                onError={handleImageError}
                onLoad={() => setLoadedBackground(currentImageUri)}
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
                onLoad={() => {
                  handleLogoLoad();
                  setLoadedLogo(logoUri);
                }}
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
            {error && !isLoading && (
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
      </View>
    );
  },
);
HeroCard.displayName = 'HeroCard';

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
    const reducedMotion = useReducedMotion();
    const progress = useRef(new Animated.Value(0)).current;
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
    const {height} = useWindowDimensions();
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
    const requested = slides[page];
    const [readyLinks, setReadyLinks] = useState<Set<string>>(() => new Set());
    const [displayedLink, setDisplayedLink] = useState('');
    const requestedAt = useRef(perfNow());
    const visible = slides.find(post => post.link === displayedLink);
    const displayedPage = slides.findIndex(post => post.link === displayedLink);
    const isLoading =
      !visible ||
      requested?.link !== displayedLink ||
      !readyLinks.has(displayedLink);
    const onReady = useCallback((link: string, ready: boolean) => {
      setReadyLinks(previous => {
        if (previous.has(link) === ready) {
          return previous;
        }
        const next = new Set(previous);
        if (ready) {
          next.add(link);
        } else {
          next.delete(link);
        }
        return next;
      });
    }, []);
    useEffect(() => {
      if (
        requested &&
        readyLinks.has(requested.link) &&
        requested.link !== displayedLink
      ) {
        perfTrace('hero_presented', {
          provider: provider.value,
          waitMs: Math.round(perfNow() - requestedAt.current),
        });
        setDisplayedLink(requested.link);
      }
    }, [requested, readyLinks, displayedLink, provider.value]);
    // Keep the current card mounted while preparing the requested and next card.
    const mountedSlides = slides.filter(
      post =>
        post.link === visible?.link ||
        post.link === requested?.link ||
        (!!visible &&
          requested?.link === displayedLink &&
          appState === 'active' &&
          isActive &&
          !searchActive &&
          !isDrawerOpen &&
          post.link === slides[(page + 1) % slides.length]?.link),
    );
    const setPage = useCallback(
      (index: number) => {
        requestedAt.current = perfNow();
        setSelectedLink(slides[index]?.link || '');
      },
      [slides],
    );
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
    useEffect(() => {
      if (
        appState !== 'active' ||
        isLoading ||
        !isActive ||
        searchActive ||
        isDrawerOpen ||
        slides.length < 2
      ) {
        progress.setValue(1);
        return;
      }
      progress.setValue(reducedMotion ? 1 : 0);
      const timer = setTimeout(
        () => setPage((page + 1) % slides.length),
        10500,
      );
      const animation = Animated.timing(progress, {
        toValue: 1,
        duration: 10500,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      if (!reducedMotion) {
        animation.start();
      }
      return () => {
        clearTimeout(timer);
        animation.stop();
      };
    }, [
      page,
      slides.length,
      isActive,
      searchActive,
      isDrawerOpen,
      isLoading,
      appState,
      setPage,
      progress,
      reducedMotion,
    ]);

    const reportedLinks = useRef(new Set<string>());
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

    return (
      <View style={{backgroundColor: 'black'}} {...swipe.panHandlers}>
        {!visible && (
          <View
            testID="hero-loading"
            accessibilityState={{busy: true}}
            style={{
              height: Math.max(560, height * 0.69),
              backgroundColor: '#141519',
              justifyContent: 'flex-end',
              padding: 16,
              gap: 12,
            }}>
            <View
              style={{width: '60%', height: 60, backgroundColor: '#23252B'}}
            />
            <View style={{height: 16, backgroundColor: '#23252B'}} />
            <View style={{height: 40, backgroundColor: '#23252B'}} />
            {!slides.length && failedSlides.size > 0 && (
              <Text style={{color: '#DADADA'}}>
                {t('Unable to load details')}
              </Text>
            )}
          </View>
        )}
        {mountedSlides.map(post => {
          const shown = post.link === visible?.link;
          return (
            <View
              key={`${scope}:${post.link}`}
              testID={shown ? 'hero-visible' : 'hero-preparing'}
              pointerEvents={shown ? 'auto' : 'none'}
              accessibilityElementsHidden={!shown}
              importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
              style={
                shown
                  ? undefined
                  : {
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      opacity: 0,
                    }
              }>
              <HeroCard
                hero={post}
                provider={provider}
                reducedMotion={reducedMotion}
                onFailure={reportHeroFailure}
                onReady={onReady}
              />
            </View>
          );
        })}
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
                accessibilityState={{selected: displayedPage === index}}
                style={{width: 39, height: 28, justifyContent: 'center'}}>
                <View
                  style={{
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: '#DADADA',
                    overflow: 'hidden',
                  }}>
                  {index === displayedPage && (
                    <Animated.View
                      style={{
                        width: 39,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: '#FF640A',
                        transform: [
                          {
                            translateX: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-39, 0],
                            }),
                          },
                        ],
                      }}
                    />
                  )}
                </View>
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
