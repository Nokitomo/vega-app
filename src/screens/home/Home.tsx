import {
  SafeAreaView,
  FlatList,
  RefreshControl,
  View,
  Text,
  PanResponder,
} from 'react-native';
import Slider from '../../components/Slider';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import HeroOptimized from '../../components/Hero';
import {cacheStorage} from '../../lib/storage';
import useContentStore from '../../lib/zustand/contentStore';
import useHeroStore from '../../lib/zustand/herostore';
import useUiSettingsStore from '../../lib/zustand/uiSettingsStore';
import {
  useHomePageData,
  getRandomHeroPost,
  clearHeroCache,
  type HomePageData,
} from '../../lib/hooks/useHomePageData';
import useThemeStore from '../../lib/zustand/themeStore';
import ProviderDrawer from '../../components/ProviderDrawer';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList} from '../../App';
import {Drawer} from 'react-native-drawer-layout';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {useIsFocused} from '@react-navigation/native';
import ContinueWatching from '../../components/ContinueWatching';
import {providerManager} from '../../lib/services/ProviderManager';
import Tutorial from '../../components/Touturial';
import {QueryErrorBoundary} from '../../components/ErrorBoundary';
import {StatusBar} from 'expo-status-bar';
import {useTranslation} from 'react-i18next';
import {Post} from '../../lib/providers/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

const HERO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HERO_HISTORY_LIMIT = 5;
const HERO_MAX_ATTEMPTS = 3;
const HERO_IMAGE_RETRY_LIMIT = 3;
const DRAWER_EDGE_HANDLE_WIDTH = 16;
const DRAWER_EDGE_OPEN_MIN_DISTANCE = 24;
const DRAWER_EDGE_MAX_VERTICAL_DRIFT = 14;
const DRAWER_UNLOCK_DELAY_MS = 180;

const ARCHIVE_HERO_PROVIDERS = new Set([
  'animeunity',
  'altadefinizionez',
  'streamingunity',
]);
const getHeroBadLinkKey = (providerValue: string) =>
  `heroBadLink:${providerValue}`;

const getArchiveHeroFilter = (providerValue: string) =>
  providerValue === 'animeunity' || providerValue === 'streamingunity'
    ? 'archive?random=true'
    : 'catalog/all?random=true';

const parseHeroHistory = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(item => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
};

const readHeroHistory = (providerValue: string): string[] => {
  const key = `heroHistory:${providerValue}`;
  return parseHeroHistory(cacheStorage.getString(key) ?? null);
};

const writeHeroHistory = (providerValue: string, link: string) => {
  const key = `heroHistory:${providerValue}`;
  const history = readHeroHistory(providerValue).filter(item => item !== link);
  const nextHistory = [link, ...history].slice(0, HERO_HISTORY_LIMIT);
  cacheStorage.setString(key, JSON.stringify(nextHistory));
};

const pickRandomPost = (
  posts: Post[],
  history: string[],
  allowDuplicate: boolean,
): Post | null => {
  const validPosts = posts.filter(post => post?.link);
  if (validPosts.length === 0) {
    return null;
  }
  const uniquePosts = validPosts.filter(post => !history.includes(post.link));
  const pool =
    uniquePosts.length > 0 ? uniquePosts : allowDuplicate ? validPosts : [];
  if (pool.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
};

const fetchArchiveHero = async ({
  providerValue,
  history,
  signal,
}: {
  providerValue: string;
  history: string[];
  signal: AbortSignal;
}): Promise<Post | null> => {
  const filter = getArchiveHeroFilter(providerValue);
  let lastPosts: Post[] = [];

  for (let attempt = 0; attempt < HERO_MAX_ATTEMPTS; attempt += 1) {
    const posts = await providerManager.getPosts({
      filter,
      page: 1,
      providerValue,
      signal,
    });
    lastPosts = posts || [];
    const candidate = pickRandomPost(lastPosts, history, false);
    if (candidate) {
      return candidate;
    }
  }

  return pickRandomPost(lastPosts, history, true);
};

const Home = ({}: Props) => {
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const [backgroundColor, setBackgroundColor] = useState('transparent');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isHorizontalListDragging, setIsHorizontalListDragging] =
    useState(false);
  const [heroRetryNonce, setHeroRetryNonce] = useState(0);
  const heroImageErrorCountRef = useRef(0);
  const drawerUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const disableDrawer = useUiSettingsStore(state => state.disableDrawer);

  const {provider, installedProviders} = useContentStore(state => state);
  const {setHero} = useHeroStore(state => state);
  const isHomeFocused = useIsFocused();
  const heroCacheTtlMs = HERO_CACHE_TTL_MS;

  const resolveCatalogTitle = useCallback(
    (item: {title: string; titleKey?: string; titleParams?: Record<string, string | number>}) =>
      item.titleKey ? t(item.titleKey, item.titleParams) : item.title,
    [t],
  );

  // React Query for home page data with better error handling
  const {
    data: homeData = [],
    isLoading,
    error,
    refetch,
    isRefetching,
    // isStale,
  } = useHomePageData({
    provider,
    enabled: !!(installedProviders?.length && provider?.value),
    isScreenActive: isHomeFocused,
  });

  // Memoized scroll handler
  const handleScroll = useCallback((event: any) => {
    const newBackgroundColor =
      event.nativeEvent.contentOffset.y > 0 ? 'black' : 'transparent';
    setBackgroundColor(newBackgroundColor);
  }, []);

  const clearDrawerUnlockTimeout = useCallback(() => {
    if (drawerUnlockTimeoutRef.current) {
      clearTimeout(drawerUnlockTimeoutRef.current);
      drawerUnlockTimeoutRef.current = null;
    }
  }, []);

  const lockDrawerDuringHorizontalDrag = useCallback(() => {
    clearDrawerUnlockTimeout();
    setIsHorizontalListDragging(true);
  }, [clearDrawerUnlockTimeout]);

  const releaseDrawerAfterHorizontalDrag = useCallback(() => {
    clearDrawerUnlockTimeout();
    drawerUnlockTimeoutRef.current = setTimeout(() => {
      setIsHorizontalListDragging(false);
      drawerUnlockTimeoutRef.current = null;
    }, DRAWER_UNLOCK_DELAY_MS);
  }, [clearDrawerUnlockTimeout]);

  useEffect(() => {
    return () => {
      clearDrawerUnlockTimeout();
    };
  }, [clearDrawerUnlockTimeout]);

  const canOpenDrawerFromEdge =
    !disableDrawer && !isDrawerOpen && !isHorizontalListDragging;

  const edgeHandlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!canOpenDrawerFromEdge) {
            return false;
          }

          const {dx, dy, x0} = gestureState;
          const startsInsideEdge = x0 <= DRAWER_EDGE_HANDLE_WIDTH + 2;
          const isHorizontalSwipe = dx > 4 && Math.abs(dx) > Math.abs(dy);
          const verticalDriftInRange =
            Math.abs(dy) <= DRAWER_EDGE_MAX_VERTICAL_DRIFT;

          return startsInsideEdge && isHorizontalSwipe && verticalDriftInRange;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!canOpenDrawerFromEdge) {
            return;
          }

          const {dx, dy, vx} = gestureState;
          const shouldOpenByDistance = dx >= DRAWER_EDGE_OPEN_MIN_DISTANCE;
          const shouldOpenByVelocity = dx > 8 && vx > 0.45;
          const verticalDriftInRange =
            Math.abs(dy) <= DRAWER_EDGE_MAX_VERTICAL_DRIFT;

          if ((shouldOpenByDistance || shouldOpenByVelocity) && verticalDriftInRange) {
            setIsDrawerOpen(true);
          }
        },
      }),
    [canOpenDrawerFromEdge],
  );

  // Stable hero post calculation
  const heroPost = useMemo(() => {
    if (!homeData || homeData.length === 0) {
      return null;
    }
    return getRandomHeroPost(homeData, provider?.value);
  }, [homeData, provider?.value, heroRetryNonce]);

  // Update hero only when hero post actually changes
  React.useEffect(() => {
    heroImageErrorCountRef.current = 0;
  }, [provider?.value]);

  const handleHeroImageError = useCallback(
    (failedLink?: string) => {
      if (!provider?.value) {
        return;
      }
      if (heroImageErrorCountRef.current >= HERO_IMAGE_RETRY_LIMIT) {
        return;
      }
      heroImageErrorCountRef.current += 1;

      if (failedLink) {
        cacheStorage.setString(getHeroBadLinkKey(provider.value), failedLink);
      }
      clearHeroCache(provider.value);
      if (failedLink && ARCHIVE_HERO_PROVIDERS.has(provider.value)) {
        writeHeroHistory(provider.value, failedLink);
      }
      setHeroRetryNonce(value => value + 1);
    },
    [provider?.value],
  );

  React.useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    const setHeroData = (hero: Post | null) => {
      if (!provider?.value) {
        setHero({link: '', image: '', title: ''});
        return;
      }
      if (hero?.link) {
        setHero(hero);
        const cacheKey = `heroCache:${provider.value}`;
        cacheStorage.setString(
          cacheKey,
          JSON.stringify({timestamp: Date.now(), hero}),
        );
        if (ARCHIVE_HERO_PROVIDERS.has(provider.value)) {
          writeHeroHistory(provider.value, hero.link);
        }
        return;
      }
      setHero({link: '', image: '', title: ''});
    };

    if (!provider?.value) {
      setHero({link: '', image: '', title: ''});
      return;
    }

    const badHeroLink = cacheStorage.getString(getHeroBadLinkKey(provider.value));
    const cacheKey = `heroCache:${provider.value}`;
    const cached = cacheStorage.getString(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const isFresh =
          parsed?.timestamp &&
          Date.now() - parsed.timestamp < heroCacheTtlMs;
        if (isFresh && parsed?.hero?.link && parsed.hero.link !== badHeroLink) {
          setHero(parsed.hero);
          return;
        }
      } catch {
        // ignore cache parsing errors
      }
    }

    const resolveHero = async () => {
      let nextHero: Post | null = null;

      if (provider?.value && ARCHIVE_HERO_PROVIDERS.has(provider.value)) {
        try {
          const history = readHeroHistory(provider.value);
          nextHero = await fetchArchiveHero({
            providerValue: provider.value,
            history,
            signal: controller.signal,
          });
        } catch (fetchError) {
          console.error('Error fetching archive hero:', fetchError);
        }
      }

      if (!nextHero && heroPost?.link && heroPost.link !== badHeroLink) {
        nextHero = heroPost;
      }

      if (!isActive) {
        return;
      }

      setHeroData(nextHero);
      if (nextHero?.link && nextHero.link !== badHeroLink) {
        cacheStorage.delete(getHeroBadLinkKey(provider.value));
      }
    };

    resolveHero();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [heroPost, provider?.value, setHero, heroCacheTtlMs, heroRetryNonce]);

  // Optimized refresh handler
  const handleRefresh = useCallback(async () => {
    try {
      await refetch();
    } catch (refreshError) {
      console.error('Error refreshing home data:', refreshError);
    }
  }, [refetch]);

  const keyExtractor = useCallback((item: HomePageData) => item.filter, []);

  const renderSliderItem = useCallback(
    ({item, index}: {item: HomePageData; index: number}) => (
      <View
        className="relative z-20"
        style={index === 0 ? {marginTop: -24} : undefined}>
      <Slider
        isLoading={!!item.isLoading}
        title={resolveCatalogTitle(item)}
        posts={item.Posts}
        filter={item.filter}
        onHorizontalDragStart={lockDrawerDuringHorizontalDrag}
        onHorizontalDragEnd={releaseDrawerAfterHorizontalDrag}
      />
      </View>
    ),
    [
      lockDrawerDuringHorizontalDrag,
      releaseDrawerAfterHorizontalDrag,
      resolveCatalogTitle,
    ],
  );

  const scrollKey = useMemo(() => {
    return `${provider?.value ?? 'none'}:${homeData.length}`;
  }, [provider?.value, homeData.length]);

  // Memoized error message
  const errorComponent = useMemo(() => {
    if (!error && (isLoading || homeData.length > 0)) {
      return null;
    }

    return (
      <View className="p-4 m-4 bg-red-500/20 rounded-lg min-h-64 flex-1 justify-center items-center">
        <Text className="text-red-400 text-center font-medium">
          {error?.message || t('Failed to load content')}
        </Text>
        <Text className="text-gray-400 text-center text-sm mt-1">
          {t('Pull to refresh and try again')}
        </Text>
      </View>
    );
  }, [error, isLoading, homeData.length]);

  // Early return for no providers
  if (
    !installedProviders ||
    installedProviders.length === 0 ||
    !provider?.value
  ) {
    return <Tutorial />;
  }

  return (
    <QueryErrorBoundary>
      <GestureHandlerRootView style={{flex: 1}}>
        <SafeAreaView className="bg-black flex-1">
          <Drawer
            open={isDrawerOpen}
            onOpen={() => setIsDrawerOpen(true)}
            onClose={() => setIsDrawerOpen(false)}
            drawerPosition="left"
            drawerType="front"
            drawerStyle={{width: 200, backgroundColor: 'transparent'}}
            swipeEdgeWidth={0}
            swipeEnabled={!disableDrawer && isDrawerOpen}
            renderDrawerContent={() =>
              !disableDrawer ? (
                <ProviderDrawer onClose={() => setIsDrawerOpen(false)} />
              ) : null
            }>
            <StatusBar
              style="auto"
              animated={true}
              translucent={true}
              backgroundColor={backgroundColor}
            />

            <FlatList
              key={scrollKey}
              data={homeData}
              keyExtractor={keyExtractor}
              renderItem={renderSliderItem}
              onScroll={handleScroll}
              scrollEventThrottle={16} // Optimize scroll performance
              showsVerticalScrollIndicator={false}
              style={{backgroundColor: 'black'}}
              initialNumToRender={3}
              maxToRenderPerBatch={2}
              windowSize={5}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews
              ListHeaderComponent={
                <>
                  <HeroOptimized
                    isDrawerOpen={isDrawerOpen}
                    onOpenDrawer={() => setIsDrawerOpen(true)}
                    onImageError={handleHeroImageError}
                  />

                  <ContinueWatching
                    onHorizontalDragStart={lockDrawerDuringHorizontalDrag}
                    onHorizontalDragEnd={releaseDrawerAfterHorizontalDrag}
                  />
                </>
              }
              ListFooterComponent={
                <>
                  {errorComponent}
                  <View className="h-16" />
                </>
              }
              refreshControl={
                <RefreshControl
                  colors={[primary]}
                  tintColor={primary}
                  progressBackgroundColor="black"
                  refreshing={isRefetching}
                  onRefresh={handleRefresh}
                />
              }
            />
            {canOpenDrawerFromEdge ? (
              <View
                {...edgeHandlePanResponder.panHandlers}
                pointerEvents="box-only"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: DRAWER_EDGE_HANDLE_WIDTH,
                  zIndex: 30,
                }}
              />
            ) : null}
          </Drawer>
        </SafeAreaView>
      </GestureHandlerRootView>
    </QueryErrorBoundary>
  );
};

export default React.memo(Home);
