import {
  Image,
  Text,
  View,
  StatusBar,
  RefreshControl,
  FlatList,
  Linking,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {HomeStackParamList, TabStackParamList} from '../../App';
import LinearGradient from 'react-native-linear-gradient';
import SeasonList from '../../components/SeasonList';
import Ionicons from '@expo/vector-icons/Ionicons';
import {settingsStorage, watchListStorage} from '../../lib/storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../../lib/zustand/contentStore';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import {StackActions, useNavigation} from '@react-navigation/native';
import useWatchListStore from '../../lib/zustand/watchListStore';
import {useContentDetails} from '../../lib/hooks/useContentInfo';
import {QueryErrorBoundary} from '../../components/ErrorBoundary';
import SkeletonLoader from '../../components/Skeleton';
import {useTranslation} from 'react-i18next';
import {hasItaBadge} from '../../lib/utils/helpers';
// import {BlurView} from 'expo-blur';

type Props = NativeStackScreenProps<HomeStackParamList, 'Info'>;
const PLACEHOLDER_IMAGE =
  'https://placehold.jp/24/363636/ffffff/500x500.png?text=Vega';
export default function Info({route, navigation}: Props): React.JSX.Element {
  const searchNavigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const {addItem, removeItem} = useWatchListStore(state => state);
  const {provider} = useContentStore(state => state);
  const providerValue = route.params.provider || provider.value;

  // React Query for optimized data fetching
  const {
    info,
    meta,
    isLoading: infoLoading,
    error,
    refetch,
  } = useContentDetails(
    route.params.link,
    providerValue,
  );

  // UI state
  const [threeDotsMenuOpen, setThreeDotsMenuOpen] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const [menuPosition, setMenuPosition] = useState({top: -1000, right: 0});
  const [backgroundColor, setBackgroundColor] = useState('transparent');
  const [backgroundFallback, setBackgroundFallback] = useState<string | null>(
    null,
  );
  const [backgroundErrorCount, setBackgroundErrorCount] = useState(0);
  const [logoError, setLogoError] = useState(false);
  const [infoView, setInfoView] = useState<'episodes' | 'related'>('episodes');

  const threeDotsRef = useRef<any | null>(null);

  // Memoized values
  const [inLibrary, setInLibrary] = useState(() =>
    watchListStorage.isInWatchList(route.params.link),
  );

  // Memoized handlers
  const openThreeDotsMenu = useCallback(() => {
    if (threeDotsRef.current) {
      threeDotsRef.current.measure(
        (
          x: number,
          y: number,
          width: number,
          height: number,
          pageX: number,
          pageY: number,
        ) => {
          setMenuPosition({top: pageY - 35, right: 35});
          setThreeDotsMenuOpen(true);
        },
      );
    }
  }, []);

  const handleScroll = useCallback((event: any) => {
    setBackgroundColor(
      event.nativeEvent.contentOffset.y > 150 ? 'black' : 'transparent',
    );
  }, []);
  const providerTitle = useMemo(() => {
    if (info?.titleKey) {
      return t(info.titleKey, info.titleParams);
    }
    return info?.title;
  }, [info?.titleKey, info?.titleParams, info?.title, t]);
  const forceProviderTitle = useMemo(
    () => providerValue === 'animeunity' || providerValue === 'streamingunity',
    [providerValue],
  );
  const libraryTitle = useMemo(
    () => (forceProviderTitle ? providerTitle : meta?.name || providerTitle),
    [forceProviderTitle, meta?.name, providerTitle],
  );
  // Optimized library management
  const addLibrary = useCallback(() => {
    ReactNativeHapticFeedback.trigger('effectClick', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    addItem({
      title: libraryTitle,
      poster: meta?.poster || route.params.poster || info?.image,
      link: route.params.link,
      provider: providerValue,
    });
    setInLibrary(true);
  }, [libraryTitle, meta, info, route.params, providerValue, addItem]);

  const removeLibrary = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    removeItem(route.params.link);
    setInLibrary(false);
  }, [route.params.link, removeItem]);

  // Memoized computed values
  const isStreamingUnity = useMemo(
    () => providerValue === 'streamingunity',
    [providerValue],
  );
  const hasImdbMeta = useMemo(() => !!meta?.name, [meta?.name]);
  const allowProviderMetadata = useMemo(
    () =>
      (providerValue !== 'altadefinizionez' &&
        providerValue !== 'streamingunity') ||
      !hasImdbMeta,
    [providerValue, hasImdbMeta],
  );
  const hasAnimeExternalIds = useMemo(
    () =>
      providerValue === 'animeunity' &&
      (!!info?.extra?.ids?.malId || !!info?.extra?.ids?.anilistId),
    [providerValue, info?.extra?.ids?.malId, info?.extra?.ids?.anilistId],
  );
  const allowProviderStudio = useMemo(() => {
    if (!allowProviderMetadata || !info?.studio) {
      return false;
    }
    if (providerValue === 'animeunity') {
      return true;
    }
    return !hasAnimeExternalIds;
  }, [
    allowProviderMetadata,
    info?.studio,
    providerValue,
    hasAnimeExternalIds,
  ]);
  const hasMetaYear = useMemo(
    () => meta?.year != null && String(meta.year).trim() !== '',
    [meta?.year],
  );
  const hasMetaRuntime = useMemo(
    () => meta?.runtime != null && String(meta.runtime).trim() !== '',
    [meta?.runtime],
  );
  const hasMetaRating = useMemo(
    () => meta?.imdbRating != null && String(meta.imdbRating).trim() !== '',
    [meta?.imdbRating],
  );
  const hasMetaGenres = useMemo(
    () => Array.isArray(meta?.genres) && meta.genres.length > 0,
    [meta?.genres],
  );
  const hasMetaCast = useMemo(
    () => Array.isArray(meta?.cast) && meta.cast.length > 0,
    [meta?.cast],
  );
  const allowProviderYear = useMemo(
    () => allowProviderMetadata && (!hasAnimeExternalIds || !hasMetaYear),
    [allowProviderMetadata, hasAnimeExternalIds, hasMetaYear],
  );
  const allowProviderRuntime = useMemo(
    () => allowProviderMetadata && (!hasAnimeExternalIds || !hasMetaRuntime),
    [allowProviderMetadata, hasAnimeExternalIds, hasMetaRuntime],
  );
  const allowProviderRating = useMemo(
    () => allowProviderMetadata && (!hasAnimeExternalIds || !hasMetaRating),
    [allowProviderMetadata, hasAnimeExternalIds, hasMetaRating],
  );
  const allowProviderGenres = useMemo(
    () => allowProviderMetadata && (!hasAnimeExternalIds || !hasMetaGenres),
    [allowProviderMetadata, hasAnimeExternalIds, hasMetaGenres],
  );
  const allowProviderCast = useMemo(
    () => allowProviderMetadata && (!hasAnimeExternalIds || !hasMetaCast),
    [allowProviderMetadata, hasAnimeExternalIds, hasMetaCast],
  );
  const synopsis = useMemo(() => {
    if (
      providerValue === 'altadefinizionez' ||
      providerValue === 'streamingunity'
    ) {
      return info?.synopsis || meta?.description || t('No synopsis available');
    }
    if (providerValue === 'animeunity') {
      return info?.synopsis || t('No synopsis available');
    }
    return meta?.description || info?.synopsis || t('No synopsis available');
  }, [providerValue, meta?.description, info?.synopsis, t]);

  const badgeYear = useMemo(() => {
    if (hasMetaYear) {
      return meta.year;
    }
    if (isStreamingUnity) {
      return info?.year;
    }
    return allowProviderYear ? info?.year : undefined;
  }, [hasMetaYear, meta?.year, isStreamingUnity, allowProviderYear, info?.year]);
  const badgeRuntime = useMemo(() => {
    if (hasMetaRuntime) {
      return meta.runtime;
    }
    if (isStreamingUnity) {
      return info?.runtime;
    }
    return allowProviderRuntime ? info?.runtime : undefined;
  }, [
    hasMetaRuntime,
    meta?.runtime,
    isStreamingUnity,
    allowProviderRuntime,
    info?.runtime,
  ]);
  const displayRating = useMemo(
    () =>
      hasMetaRating
        ? meta?.imdbRating
        : isStreamingUnity
          ? info?.rating
        : allowProviderRating
          ? info?.rating
          : undefined,
    [
      hasMetaRating,
      meta?.imdbRating,
      isStreamingUnity,
      allowProviderRating,
      info?.rating,
    ],
  );
  const showProviderFallback = useMemo(() => !meta?.name, [meta?.name]);
  const showMetaDetails = true;
  const showGenreBadges = true;

  const displayTitle = useMemo(() => {
    if (forceProviderTitle) {
      return providerTitle;
    }
    return meta?.name || providerTitle;
  }, [forceProviderTitle, meta?.name, providerTitle]);
  const isDubbedItalian = useMemo(() => {
    if (providerValue !== 'animeunity') {
      return false;
    }
    const rawDub = info?.extra?.flags?.dub;
    if (rawDub === true || rawDub === 1) {
      return true;
    }
    if (typeof rawDub === 'string') {
      const normalized = rawDub.trim().toLowerCase();
      return normalized === '1' || normalized === 'true';
    }
    return false;
  }, [providerValue, info?.extra?.flags?.dub]);

  const posterImage = useMemo(() => {
    return (
      meta?.poster ||
      route.params.poster ||
      info?.image ||
      PLACEHOLDER_IMAGE
    );
  }, [meta?.poster, route.params.poster, info?.image]);
  const logoImage = info?.logo || meta?.logo;

  const backgroundImage = useMemo(() => {
    if (meta?.background) {
      return meta.background;
    }
    if (
      (providerValue === 'altadefinizionez' ||
        providerValue === 'streamingunity') &&
      !hasImdbMeta
    ) {
      return info?.background || info?.image || PLACEHOLDER_IMAGE;
    }
    return (
      info?.image ||
      PLACEHOLDER_IMAGE
    );
  }, [meta?.background, providerValue, hasImdbMeta, info?.background, info?.image]);
  const providerBackgroundFallback = useMemo(
    () => info?.background || info?.image || PLACEHOLDER_IMAGE,
    [info?.background, info?.image],
  );
  const resolvedBackgroundImage = backgroundFallback || backgroundImage;

  useEffect(() => {
    setBackgroundFallback(null);
    setBackgroundErrorCount(0);
  }, [backgroundImage, providerBackgroundFallback, route.params.link]);

  const handleBackgroundError = useCallback(
    (event: any) => {
      console.warn('Background image failed to load:', event);
      if (
        backgroundErrorCount === 0 &&
        providerBackgroundFallback &&
        providerBackgroundFallback !== backgroundImage
      ) {
        setBackgroundFallback(providerBackgroundFallback);
        setBackgroundErrorCount(1);
        return;
      }
      if (
        backgroundErrorCount === 1 &&
        resolvedBackgroundImage !== PLACEHOLDER_IMAGE
      ) {
        setBackgroundFallback(PLACEHOLDER_IMAGE);
        setBackgroundErrorCount(2);
      }
    },
    [
      backgroundErrorCount,
      providerBackgroundFallback,
      backgroundImage,
      resolvedBackgroundImage,
    ],
  );

  const currentInfoEntry = useMemo(
    () => ({
      link: route.params.link,
      provider: providerValue,
      poster: posterImage,
    }),
    [route.params.link, providerValue, posterImage],
  );
  const filteredLinkList = useMemo(() => {
    if (!info?.linkList) {
      return [];
    }

    const excludedQualities = settingsStorage.getExcludedQualities();
    const filtered = info.linkList.filter(
      (item: any) =>
        !item.quality || !excludedQualities.includes(item.quality as string),
    );

    return filtered.length > 0 ? filtered : info.linkList;
  }, [info?.linkList]);

  const relatedItems = useMemo(() => info?.related || [], [info?.related]);
  const statusTag = useMemo(() => {
    if (!hasAnimeExternalIds) {
      return null;
    }
    const tags = info?.tags ?? [];
    const tagKeys = info?.tagKeys ?? {};
    const statusKeys = new Set(['Ongoing', 'Completed', 'Upcoming', 'Dropped']);
    const matched = tags.find(tag => statusKeys.has(tagKeys[tag] || ''));
    if (matched) {
      return {tag: matched, key: tagKeys[matched]};
    }
    const rawStatus = info?.extra?.meta?.status;
    if (rawStatus) {
      return {tag: rawStatus, key: tagKeys[rawStatus]};
    }
    return null;
  }, [
    hasAnimeExternalIds,
    info?.tags,
    info?.tagKeys,
    info?.extra?.meta?.status,
  ]);

  const displayTags = useMemo(() => {
    if (!allowProviderMetadata || !info?.tags || info.tags.length === 0) {
      return [];
    }
    if (hasAnimeExternalIds) {
      if (!statusTag?.tag) {
        return [];
      }
      return [statusTag.key ? t(statusTag.key) : statusTag.tag];
    }
    return info.tags.slice(0, 3).map(tag => {
      const key = info.tagKeys?.[tag];
      return key ? t(key) : tag;
    });
  }, [
    allowProviderMetadata,
    hasAnimeExternalIds,
    info?.tags,
    info?.tagKeys,
    statusTag?.key,
    statusTag?.tag,
    t,
  ]);
  const providerLocalizedGenres = useMemo(() => {
    if (!info?.genres || info.genres.length === 0) {
      return [];
    }
    return info.genres.map(genre => {
      const key = info.tagKeys?.[genre];
      return key ? t(key) : genre;
    });
  }, [info?.genres, info?.tagKeys, t]);
  const localizedGenres = useMemo(() => {
    if (!allowProviderGenres || !info?.genres || info.genres.length === 0) {
      return [];
    }
    return providerLocalizedGenres;
  }, [allowProviderGenres, info?.genres, providerLocalizedGenres]);
  const badgeGenres = useMemo(() => {
    if (meta?.genres && meta.genres.length > 0) {
      return meta.genres.slice(0, 2);
    }
    if (isStreamingUnity && providerLocalizedGenres.length > 0) {
      return providerLocalizedGenres.slice(0, 2);
    }
    if (localizedGenres.length > 0) {
      return localizedGenres.slice(0, 2);
    }
    return [];
  }, [meta?.genres, isStreamingUnity, providerLocalizedGenres, localizedGenres]);
  const metaCast = useMemo(() => meta?.cast ?? [], [meta?.cast]);
  const providerCast = useMemo(
    () =>
      isStreamingUnity
        ? info?.cast ?? []
        : allowProviderCast
          ? info?.cast ?? []
          : [],
    [isStreamingUnity, allowProviderCast, info?.cast],
  );
  const displayCast = useMemo(
    () =>
      isStreamingUnity
        ? metaCast.length > 0
          ? metaCast
          : providerCast
        : [...metaCast, ...providerCast],
    [isStreamingUnity, metaCast, providerCast],
  );
  const hasCast = useMemo(() => displayCast.length > 0, [displayCast]);
  const showInfoDetails = useMemo(
    () =>
      showMetaDetails &&
      (allowProviderStudio ||
        (allowProviderGenres && info?.genres && info.genres.length > 0) ||
        ((showProviderFallback && !hasAnimeExternalIds) &&
          (!!info?.country || !!info?.director))),
    [
      showMetaDetails,
      allowProviderStudio,
      allowProviderGenres,
      info?.studio,
      info?.genres,
      showProviderFallback,
      hasAnimeExternalIds,
      info?.country,
      info?.director,
    ],
  );
  const infoStack = route.params?.infoStack ?? [];
  const showInfoBack = infoStack.length > 0;

  // Optimized refresh handler
  const handleRefresh = useCallback(async () => {
    try {
      await refetch();
    } catch (refreshError) {
      console.error('Error refreshing content:', refreshError);
      // Could show a toast or alert here if needed
    }
  }, [refetch]);

  const handleClose = useCallback(() => {
    const navState = navigation.getState();
    const routes = navState.routes;
    const currentIndex = navState.index ?? routes.length - 1;
    let targetIndex = -1;

    for (let i = currentIndex; i >= 0; i -= 1) {
      if (routes[i].name !== 'Info') {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex < 0) {
      navigation.goBack();
      return;
    }

    const popCount = currentIndex - targetIndex;
    if (popCount <= 0) {
      navigation.goBack();
      return;
    }

    navigation.dispatch(StackActions.pop(popCount));
  }, [navigation]);

  const handleInfoBack = useCallback(() => {
    if (infoStack.length === 0) {
      return;
    }
    const previous = infoStack[infoStack.length - 1];
    const nextStack = infoStack.slice(0, -1);
    navigation.dispatch(
      StackActions.replace('Info', {
        ...previous,
        infoStack: nextStack,
      }),
    );
  }, [infoStack, navigation]);

  // Error handling - show error UI instead of throwing
  if (error) {
    return (
      <View className="h-full w-full bg-black justify-center items-center p-4">
        <StatusBar
          showHideTransition={'slide'}
          animated={true}
          translucent={true}
          backgroundColor="black"
        />
        <Text className="text-red-400 text-lg font-bold mb-4 text-center">
          {t('Failed to load content')}
        </Text>
        <Text className="text-gray-400 text-sm mb-6 text-center">
          {error.message ||
            t('An unexpected error occurred while loading the content')}
        </Text>
        <TouchableOpacity
          onPress={handleRefresh}
          className="bg-red-600 px-6 py-3 rounded-lg mb-4">
          <Text className="text-white font-semibold">{t('Try Again')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-gray-600 px-6 py-3 rounded-lg">
          <Text className="text-white font-semibold">{t('Go Back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <QueryErrorBoundary>
      <View className="h-full w-full">
        <StatusBar
          showHideTransition={'slide'}
          animated={true}
          translucent={true}
          backgroundColor={backgroundColor}
        />
        <View>
          <View className="absolute top-0 left-0 right-0 z-40 flex-row justify-between items-center px-3 pt-10">
            {showInfoBack ? (
              <TouchableOpacity
                onPress={handleInfoBack}
                className="p-2 rounded-full bg-black/50">
                <Ionicons name="chevron-back" size={24} color="white" />
              </TouchableOpacity>
            ) : (
              <View className="w-10 h-10" />
            )}
            <TouchableOpacity
              onPress={handleClose}
              className="p-2 rounded-full bg-black/50">
              <Ionicons name="close" size={22} color="white" />
            </TouchableOpacity>
          </View>
          <View className="absolute w-full h-[256px]">
            <SkeletonLoader show={infoLoading} height={256} width={'100%'}>
              <Image
                source={{uri: resolvedBackgroundImage}}
                className=" h-[256] w-full"
                onError={handleBackgroundError}
              />
            </SkeletonLoader>
          </View>

          {
            // manifest[route.params.provider || provider.value].blurImage && (
            //   <BlurView
            //     intensity={4}
            //     blurReductionFactor={1}
            //     experimentalBlurMethod="dimezisBlurView"
            //     tint="default"
            //     style={{
            //       position: 'absolute',
            //       top: 0,
            //       left: 0,
            //       right: 0,
            //       bottom: 0,
            //       height: 256,
            //       width: '100%',
            //     }}
            //   />
            // )
          }
          <FlatList
            data={[]}
            keyExtractor={(_, i) => i.toString()}
            renderItem={() => <View />}
            ListHeaderComponent={
              <>
                <View className="relative w-full h-[256px]">
                  <LinearGradient
                    colors={['transparent', 'black']}
                    className="absolute h-full w-full"
                  />
                  <View className="absolute bottom-0 right-0 w-screen flex-row justify-between items-baseline px-2">
                    {(logoImage && !logoError) || infoLoading ? (
                      <Image
                        onError={() => setLogoError(true)}
                        source={{uri: logoImage}}
                        style={{width: 200, height: 100, resizeMode: 'contain'}}
                      />
                    ) : (
                      <View className="w-3/4">
                        <Text className="text-white text-2xl mt-3 capitalize font-semibold truncate">
                          {displayTitle}
                        </Text>
                        {isDubbedItalian ? (
                          <Text className="text-gray-300 text-xs mt-1">
                            {t('Dubbed in Italian')}
                          </Text>
                        ) : null}
                      </View>
                    )}
                    {/* rating */}
                    {displayRating && (
                      <Text className="text-white text-2xl font-semibold">
                        {displayRating}
                        <Text className="text-white text-lg">/10</Text>
                      </Text>
                    )}
                  </View>
                </View>
                <View className="p-4 bg-black">
                  <View className="flex-row gap-x-3 gap-y-1 flex-wrap items-center mb-4">
                    {/* badges */}
                    {badgeYear && (
                      <Text className="text-white text-xs bg-tertiary px-2 rounded-md">
                        {badgeYear}
                      </Text>
                    )}
                    {badgeRuntime && (
                      <Text className="text-white text-xs bg-tertiary px-2 rounded-md">
                        {badgeRuntime}
                      </Text>
                    )}
                    {showGenreBadges &&
                      badgeGenres.map((genre: string) => (
                        <Text
                          key={genre}
                          className="text-white text-xs bg-tertiary px-2 rounded-md">
                          {genre}
                        </Text>
                      ))}
                    {info?.episodesCount ? (
                      <Text className="text-white text-xs bg-tertiary px-2 rounded-md">
                        {t('Episodes: {{count}}', {
                          count: info.episodesCount,
                        })}
                      </Text>
                    ) : null}
                    {displayTags.map(tag => (
                      <Text
                        key={tag}
                        className="text-white text-xs bg-tertiary px-2 rounded-md">
                        {tag}
                      </Text>
                    ))}
                  </View>
                  {/* Awards */}
                  {meta?.awards && (
                    <View className="mb-2 w-full flex-row items-baseline gap-2">
                      <Text className="text-white text- font-semibold">
                        {t('Awards:')}
                      </Text>
                      <Text className="text-white text-xs px-1 bg-tertiary rounded-sm">
                        {meta?.awards?.length > 50
                          ? meta?.awards.slice(0, 50) + '...'
                          : meta?.awards}
                      </Text>
                    </View>
                  )}
                  {/* cast  */}
                  {hasCast && (
                    <View className="mb-2 w-full flex-row items-start gap-2">
                      <Text className="text-white text-lg font-semibold pt-[0.9px]">
                        {t('Cast')}
                      </Text>
                      <View className="flex-row gap-1 flex-wrap">
                        {displayCast.slice(0, 3).map((actor, index) => (
                          <Text
                            key={`${actor}-${index}`}
                            numberOfLines={1}
                            className={`text-xs bg-tertiary p-1 px-2 rounded-md ${
                              index % 3 === 0
                                ? 'text-red-500'
                                : index % 3 === 1
                                  ? 'text-blue-500'
                                  : 'text-green-500'
                            }`}>
                            {actor}
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}
                  {/* synopsis */}
                  <View className="mb-2 w-full flex-row items-center justify-between">
                    <SkeletonLoader show={infoLoading} height={25} width={180}>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-white text-lg font-semibold">
                          {t('Synopsis')}
                        </Text>
                        <Text className="text-white text-xs bg-tertiary p-1 px-2 rounded-md">
                          {providerValue}
                        </Text>
                      </View>
                    </SkeletonLoader>
                    <View className="flex-row items-center gap-4 mb-1">
                      {meta?.trailers && meta?.trailers.length > 0 && (
                        <MaterialCommunityIcons
                          name="movie-open"
                          size={25}
                          color="rgb(156 163 175)"
                          onPress={() =>
                            Linking.openURL(
                              'https://www.youtube.com/watch?v=' +
                                meta?.trailers?.[0]?.source,
                            )
                          }
                        />
                      )}
                      {inLibrary ? (
                        <Ionicons
                          name="bookmark"
                          size={30}
                          color={primary}
                          onPress={() => removeLibrary()}
                        />
                      ) : (
                        <Ionicons
                          name="bookmark-outline"
                          size={30}
                          color={primary}
                          onPress={() => addLibrary()}
                        />
                      )}
                      <TouchableOpacity
                        onPress={() => openThreeDotsMenu()}
                        ref={threeDotsRef}>
                        <MaterialCommunityIcons
                          name="dots-vertical"
                          size={25}
                          color="rgb(156 163 175)"
                        />
                      </TouchableOpacity>
                      {
                        <Modal
                          animationType="none"
                          transparent={true}
                          visible={threeDotsMenuOpen}
                          onRequestClose={() => {
                            setThreeDotsMenuOpen(false);
                          }}>
                          <Pressable
                            onPress={() => setThreeDotsMenuOpen(false)}
                            className="flex-1 bg-opacity-50">
                            <View
                              className="rounded-md p-2 w-48 bg-quaternary absolute right-10 top-[330px]"
                              style={{
                                top: menuPosition.top,
                                right: menuPosition.right,
                              }}>
                              {/* open in web  */}
                              <TouchableOpacity
                                className="flex-row items-center gap-2"
                                onPress={async () => {
                                  setThreeDotsMenuOpen(false);
                                  navigation.navigate('Webview', {
                                    link: route.params.link,
                                  });
                                }}>
                                <MaterialCommunityIcons
                                  name="web"
                                  size={21}
                                  color="rgb(156 163 175)"
                                />
                                <Text className="text-white text-base">
                                  {t('Open in Web')}
                                </Text>
                              </TouchableOpacity>
                              {/* search */}
                              <TouchableOpacity
                                className="flex-row items-center gap-2 mt-1"
                                onPress={async () => {
                                  setThreeDotsMenuOpen(false);
                                  //@ts-ignore
                                  searchNavigation.navigate('SearchStack', {
                                    screen: 'SearchResults',
                                    params: {
                                      filter: displayTitle,
                                    },
                                  });
                                }}>
                                <Ionicons
                                  name="search"
                                  size={21}
                                  color="rgb(156 163 175)"
                                />
                                <Text className="text-white text-base">
                                  {t('Search Title')}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </Pressable>
                        </Modal>
                      }
                    </View>
                  </View>
                  <SkeletonLoader show={infoLoading} height={85} width={'100%'}>
                    <Text className="text-gray-200 text-sm px-2 py-1 bg-tertiary rounded-md">
                      {synopsis.length > 180 && !readMore
                        ? synopsis.slice(0, 180) + '... '
                        : synopsis}
                      {synopsis.length > 180 && !readMore && (
                        <Text
                          onPress={() => setReadMore(!readMore)}
                          className="text-white font-extrabold text-xs px-2 bg-tertiary rounded-md">
                          {t('read more')}
                        </Text>
                      )}
                    </Text>
                  </SkeletonLoader>
                  {showInfoDetails ? (
                    <View className="mt-2">
                      {allowProviderStudio ? (
                        <Text className="text-gray-400 text-xs">
                          {t('Studio: {{name}}', {name: info.studio})}
                        </Text>
                      ) : null}
                      {allowProviderGenres &&
                      info?.genres &&
                      info.genres.length > 0 ? (
                        <Text className="text-gray-400 text-xs mt-1">
                          {t('Genres: {{list}}', {
                            list: localizedGenres.join(' · '),
                          })}
                        </Text>
                      ) : null}
                      {showProviderFallback && !hasAnimeExternalIds && info?.country ? (
                        <Text className="text-gray-400 text-xs mt-1">
                          {t('Country: {{name}}', {name: info.country})}
                        </Text>
                      ) : null}
                      {showProviderFallback && !hasAnimeExternalIds && info?.director ? (
                        <Text className="text-gray-400 text-xs mt-1">
                          {t('Director: {{name}}', {name: info.director})}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  {/* cast */}
                </View>
                <View className="p-4 bg-black">
                  {infoLoading ? (
                    <View className="gap-y-3 items-start mb-4 p-3">
                      <SkeletonLoader show={true} height={30} width={80} />
                      {[...Array(1)].map((_, i) => (
                        <View
                          className="bg-tertiary p-1 rounded-md gap-3 mt-3"
                          key={i}>
                          <SkeletonLoader
                            show={true}
                            height={20}
                            width={'100%'}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <>
                      <View className="flex-row gap-2 mb-4">
                        <TouchableOpacity
                          onPress={() => setInfoView('episodes')}
                          className={`px-3 py-1 rounded-md ${
                            infoView === 'episodes'
                              ? 'bg-tertiary'
                              : 'bg-quaternary'
                          }`}>
                          <Text className="text-white text-xs font-semibold">
                            {t('Episodes')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setInfoView('related')}
                          className={`px-3 py-1 rounded-md ${
                            infoView === 'related'
                              ? 'bg-tertiary'
                              : 'bg-quaternary'
                          }`}>
                          <Text className="text-white text-xs font-semibold">
                            {t('Related')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {infoView === 'episodes' ? (
                        <SeasonList
                          refreshing={false}
                          providerValue={providerValue}
                          aniSkipMalId={
                            Number.isFinite(Number(info?.extra?.ids?.malId)) &&
                            Number(info?.extra?.ids?.malId) > 0
                              ? Number(info?.extra?.ids?.malId)
                              : undefined
                          }
                          LinkList={filteredLinkList}
                          poster={{
                            logo: meta?.logo,
                            poster: posterImage,
                            background: backgroundImage,
                          }}
                          type={info?.type || 'series'}
                          metaTitle={displayTitle}
                          routeParams={route.params}
                        />
                      ) : (
                        <View className="gap-3">
                          {relatedItems.length === 0 ? (
                            <Text className="text-gray-400 text-xs">
                              {t('No related items available.')}
                            </Text>
                          ) : (
                            relatedItems.map((item, index) => (
                              <TouchableOpacity
                                key={`${item.link}-${index}`}
                                className="flex-row items-center gap-3 bg-quaternary p-2 rounded-md"
                                onPress={() =>
                                  navigation.dispatch(
                                    StackActions.push('Info', {
                                      link: item.link,
                                      provider: providerValue,
                                      poster: item.image,
                                      infoStack: [
                                        ...infoStack,
                                        currentInfoEntry,
                                      ],
                                    }),
                                  )
                                }>
                                <View className="relative">
                                  <Image
                                    source={{
                                      uri:
                                        item.image ||
                                        'https://placehold.jp/24/363636/ffffff/100x150.png?text=Vega',
                                    }}
                                    style={{width: 60, height: 90}}
                                  />
                                  {hasItaBadge(item.title) ? (
                                    <View
                                      className="absolute top-1 left-1 rounded-full px-2 py-0.5"
                                      style={{backgroundColor: primary}}>
                                      <Text className="text-black text-[10px] font-semibold">
                                        {t('ITA')}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                                <View className="flex-1">
                                  <Text className="text-white text-sm font-semibold">
                                    {item.title}
                                  </Text>
                                  <Text className="text-gray-400 text-xs mt-1">
                                    {[item.type, item.year]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ))
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>
              </>
            }
            ListFooterComponent={<View className="h-16" />}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16} // Optimize scroll performance
            refreshControl={
              <RefreshControl
                colors={[primary]}
                tintColor={primary}
                progressBackgroundColor={'black'}
                refreshing={false}
                onRefresh={handleRefresh}
              />
            }
          />
        </View>
      </View>
    </QueryErrorBoundary>
  );
}
