import {
  Image,
  Text,
  View,
  StatusBar,
  RefreshControl,
  Linking,
  TouchableOpacity,
  Modal,
  Pressable,
  useWindowDimensions,
  Animated,
  ScrollView,
} from 'react-native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useCatalogDetails} from '../../lib/catalog/useCatalogDetails';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {HomeStackParamList, TabStackParamList} from '../../App';
import LinearGradient from 'react-native-linear-gradient';
import InfoDialog from '../../components/InfoDialog';
import InfoAdaptiveLayout from '../../components/InfoAdaptiveLayout';
import SeasonList, {type InfoPlaybackAction} from '../../components/SeasonList';
import Ionicons from '@expo/vector-icons/Ionicons';
import {settingsStorage, watchHistoryStorage, watchListStorage} from '../../lib/storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../../lib/zustand/contentStore';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import useWatchListStore from '../../lib/zustand/watchListStore';
import {useContentDetails} from '../../lib/hooks/useContentInfo';
import {QueryErrorBoundary} from '../../components/ErrorBoundary';
import SkeletonLoader from '../../components/Skeleton';
import {useTranslation} from 'react-i18next';
import {hasItaBadge} from '../../lib/utils/helpers';
import type {
  Info as ProviderInfo,
  PostVariant,
} from '../../lib/providers/types';
import {selectArtworkCandidates} from '../../lib/services/artworkSelection';
import {
  getMetadataSourceProvider,
  resolveSavedStreamCenterLink,
} from '../../lib/services/streamCenterMetadata';
import {USER_WEBVIEW_ENABLED} from '../../lib/config/features';
import {resolveWebViewLink} from '../../lib/utils/providerLinks';
import {resolveAnimeExternalIds} from '../../lib/providers/externalIds';
import RemoteLogo from '../../components/RemoteLogo';
import {useLogoFallback} from '../../lib/hooks/useLogoFallback';
import {markPerfNavigationStage, perfTrace} from '../../lib/utils/perfTrace';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import useAdaptiveNavigation from '../../lib/hooks/useAdaptiveNavigation';
import {HOME_FONT} from '../../components/homePresentation';
// import {BlurView} from 'expo-blur';

type Props = NativeStackScreenProps<HomeStackParamList, 'Info'>;
type RelatedItem = NonNullable<ProviderInfo['related']>[number];
const PLACEHOLDER_IMAGE =
  'https://placehold.jp/24/363636/ffffff/500x500.png?text=Vega';
const PROVIDER_FIRST_TITLE_PROVIDERS = new Set([
  'animeunity',
  'streamingunity',
  'streamingcommunity',
  'altadefinizionez',
]);

const normalizeTrailerUrl = (value?: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return `https://www.youtube.com/watch?v=${encodeURIComponent(normalized)}`;
};

export default function Info(props: Props): React.JSX.Element {
  return <ProviderInfoScreen key={props.route.params.catalogRef?.workId || 'provider'} {...props} />;
}
function ProviderInfoScreen({route, navigation}: Props): React.JSX.Element {
  const searchNavigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const {addItem, removeItem} = useWatchListStore(state => state);
  const {provider} = useContentStore(state => state);
  const catalog = useCatalogDetails(route.params.catalogRef, route.params.link, !!route.params.continueWatchingTarget);
  const isCatalog = !!route.params.catalogRef;
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {isTabletDevice} = useAdaptiveNavigation();
  const [contentWidth, setContentWidth] = useState(windowWidth);
  const [contentHeight, setContentHeight] = useState(windowHeight);
  const tabletLandscape = isTabletDevice && contentWidth > contentHeight && contentWidth >= 900;
  const summaryWidth = tabletLandscape ? contentWidth * 0.63 : contentWidth;
  const playbackActionRef = useRef<(() => void) | null>(null);
  const [playbackAction, setPlaybackAction] = useState<InfoPlaybackAction | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const providerValue = isCatalog ? catalog.provider : route.params.provider || provider.value;
  const routeVariants = useMemo<PostVariant[]>(
    () =>
      (route.params.variants || []).filter(
        variant => !!variant?.link && !!variant?.status,
      ),
    [route.params.variants],
  );
  const [selectedVariantLink, setSelectedVariantLink] = useState(
    route.params.link,
  );
  const activeLink = useMemo(() => isCatalog ? catalog.link : resolveSavedStreamCenterLink(
    providerValue,
    selectedVariantLink || route.params.link,
    providerValue === 'streamcenter'
      ? [
          ...watchHistoryStorage.getWatchHistory(),
          ...watchListStorage.getWatchList(),
        ]
      : [],
  ), [providerValue, route.params.link, selectedVariantLink, isCatalog, catalog.link]);
  const metadataProvider = getMetadataSourceProvider(providerValue, activeLink);
  const routeSelectedVariant = useMemo(
    () => routeVariants.find(variant => variant.link === selectedVariantLink),
    [selectedVariantLink, routeVariants],
  );
  const activePoster = routeSelectedVariant?.image || route.params.poster;
  const activeRouteParams = useMemo(
    () => ({
      ...route.params,
      link: activeLink,
      poster: activePoster,
      continueWatchingTarget: selectedVariantLink === route.params.link
        ? route.params.continueWatchingTarget
        : undefined,
    }),
    [activeLink, activePoster, route.params, selectedVariantLink],
  );
  const infoHeaderHeight = useMemo(() => {
    const width =
      Number.isFinite(summaryWidth) && summaryWidth > 0 ? summaryWidth : 390;
    return Math.round(width * (isTabletDevice ? 9 / 16 : 3 / 2));
  }, [summaryWidth, isTabletDevice]);
  const toolbarOpacity = scrollY.interpolate({
    inputRange: [Math.max(0, infoHeaderHeight - insets.top - 260), Math.max(1, infoHeaderHeight - insets.top - 180)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    setSelectedVariantLink(route.params.link);
  }, [route.params.link]);

  // React Query for optimized data fetching
  const providerDetails = useContentDetails(isCatalog ? '' : activeLink, isCatalog ? '' : providerValue);
  const info = isCatalog ? catalog.info : providerDetails.info;
  const meta = isCatalog ? undefined : providerDetails.meta;
  const infoLoading = isCatalog ? catalog.isLoading : providerDetails.isLoading;
  const error = isCatalog ? catalog.error : providerDetails.error;
  const refetch = isCatalog ? catalog.refetch : providerDetails.refetch;
  const repairInfo = isCatalog ? catalog.refetch : providerDetails.repairInfo;
  const check = isCatalog ? undefined : providerDetails.check;
  useEffect(() => {
    if (error || (infoLoading && !info)) {
      // The list unmounts in these states: reset its animated toolbar as well.
      scrollY.setValue(0);
      setPlaybackAction(null);
    }
  }, [error, infoLoading, info, scrollY]);
  useEffect(() => {
    markPerfNavigationStage('info_mounted');
    perfTrace('info_opened', {provider: providerValue, cacheHit: !!info});
  }, [activeLink, providerValue]);
  useEffect(() => {
    if (info) {markPerfNavigationStage('metadata_ready');}
  }, [info]);
  const animeExternalIds = useMemo(
    () => resolveAnimeExternalIds(info?.extra?.ids),
    [info?.extra?.ids],
  );

  // UI state
  const [threeDotsMenuOpen, setThreeDotsMenuOpen] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const [menuPosition, setMenuPosition] = useState({top: -1000, right: 0});
  const [backgroundCandidateIndex, setBackgroundCandidateIndex] = useState(0);
  const [infoView, setInfoView] = useState<'episodes' | 'related'>('episodes');
  const [refreshing, setRefreshing] = useState(false);
  const [episodeRefreshVersion, setEpisodeRefreshVersion] = useState(0);

  const threeDotsRef = useRef<any | null>(null);
  const attemptedArtworkRepairRef = useRef(new Set<string>());

  // Memoized values
  const [inLibrary, setInLibrary] = useState(() =>
    watchListStorage.isInWatchList(activeLink),
  );
  const [excludedQualities, setExcludedQualities] = useState<string[]>(
    settingsStorage.getExcludedQualities(),
  );

  useFocusEffect(
    useCallback(() => {
      setExcludedQualities(settingsStorage.getExcludedQualities());
      return () => {};
    }, []),
  );

  useEffect(() => {
    setInLibrary(watchListStorage.isInWatchList(activeLink));
    setInfoView('episodes');
  }, [activeLink]);

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

  const providerTitle = useMemo(() => {
    if (info?.titleKey) {
      return t(info.titleKey, info.titleParams);
    }
    return info?.title;
  }, [info?.titleKey, info?.titleParams, info?.title, t]);
  const forceProviderTitle = useMemo(
    () => PROVIDER_FIRST_TITLE_PROVIDERS.has(metadataProvider),
    [metadataProvider],
  );
  const libraryTitle = useMemo(
    () => (forceProviderTitle ? providerTitle : meta?.name || providerTitle),
    [forceProviderTitle, meta?.name, providerTitle],
  );
  const artworkCandidates = useMemo(
    () =>
      isCatalog ? catalog.artwork || {poster: [], background: [], logo: []} : selectArtworkCandidates({
        providerValue: metadataProvider,
        info,
        enhanced: meta,
        activePoster,
      }),
    [metadataProvider, info, meta, activePoster, isCatalog, catalog.artwork],
  );
  const posterImage = useMemo(() => {
    return artworkCandidates.poster[0] || PLACEHOLDER_IMAGE;
  }, [artworkCandidates.poster]);
  // Optimized library management
  const addLibrary = useCallback(() => {
    ReactNativeHapticFeedback.trigger('effectClick', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    addItem({
      catalogRef: route.params.catalogRef,
      title: libraryTitle,
      poster: posterImage,
      link: activeLink,
      provider: providerValue,
    });
    setInLibrary(true);
  }, [libraryTitle, posterImage, activeLink, providerValue, addItem, route.params.catalogRef]);

  const removeLibrary = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    removeItem(activeLink);
    setInLibrary(false);
  }, [activeLink, removeItem]);

  // Memoized computed values
  const isStreamingUnity = useMemo(
    () => metadataProvider === 'streamingunity',
    [metadataProvider],
  );
  const hasImdbMeta = useMemo(() => !!meta?.name, [meta?.name]);
  const allowProviderMetadata = useMemo(
    () =>
      (metadataProvider !== 'altadefinizionez' &&
        metadataProvider !== 'streamingunity') ||
      !hasImdbMeta,
    [metadataProvider, hasImdbMeta],
  );
  const hasAnimeExternalIds = useMemo(
    () =>
      metadataProvider === 'animeunity' &&
      (!!animeExternalIds.malId || !!animeExternalIds.anilistId),
    [animeExternalIds.anilistId, animeExternalIds.malId, metadataProvider],
  );
  const allowProviderStudio = useMemo(() => {
    if (!allowProviderMetadata || !info?.studio) {
      return false;
    }
    if (metadataProvider === 'animeunity') {
      return true;
    }
    return !hasAnimeExternalIds;
  }, [allowProviderMetadata, info?.studio, metadataProvider, hasAnimeExternalIds]);
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
      metadataProvider === 'altadefinizionez' ||
      metadataProvider === 'streamingunity'
    ) {
      return info?.synopsis || meta?.description || t('No synopsis available');
    }
    if (metadataProvider === 'animeunity') {
      return info?.synopsis || t('No synopsis available');
    }
    return meta?.description || info?.synopsis || t('No synopsis available');
  }, [metadataProvider, meta?.description, info?.synopsis, t]);

  const badgeYear = useMemo(() => {
    if (hasMetaYear) {
      return meta.year;
    }
    if (isStreamingUnity) {
      return info?.year;
    }
    return allowProviderYear ? info?.year : undefined;
  }, [
    hasMetaYear,
    meta?.year,
    isStreamingUnity,
    allowProviderYear,
    info?.year,
  ]);
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
    if (metadataProvider !== 'animeunity') {
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
  }, [metadataProvider, info?.extra?.flags?.dub]);

  const backgroundImage =
    artworkCandidates.background[0] || PLACEHOLDER_IMAGE;
  const resolvedBackgroundImage =
    artworkCandidates.background[backgroundCandidateIndex] ||
    PLACEHOLDER_IMAGE;

  useEffect(() => {
    setBackgroundCandidateIndex(0);
  }, [activeLink, artworkCandidates.background]);

  const repairBrokenArtwork = useCallback(
    (kind: 'background' | 'logo') => {
      if (isCatalog) {return;}
      if (!['animeunity', 'streamingunity', 'streamcenter'].includes(providerValue)) {
        return;
      }
      const key = `${activeLink}:${kind}`;
      if (attemptedArtworkRepairRef.current.has(key)) {
        return;
      }
      attemptedArtworkRepairRef.current.add(key);
      repairInfo().catch(artworkError => {
        console.warn('Failed to repair broken artwork URL:', artworkError);
      });
    },
    [activeLink, providerValue, repairInfo, isCatalog],
  );

  const {
    uri: logoImage,
    onError: handleLogoError,
    onLoad: handleLogoLoad,
  } = useLogoFallback({
    providerValue: isCatalog ? '' : providerValue,
    link: isCatalog ? '' : activeLink,
    candidates: artworkCandidates.logo,
    onExhausted: () => repairBrokenArtwork('logo'),
  });

  const trailerUrl = useMemo(() => {
    const providerTrailer = info?.trailers?.find(
      (item: string) => !!item?.trim(),
    );
    if (providerTrailer) {
      return normalizeTrailerUrl(providerTrailer);
    }
    const enhancedTrailer = meta?.trailers?.find(
      (item: {source?: string}) => !!item?.source,
    )?.source;
    return normalizeTrailerUrl(enhancedTrailer);
  }, [info?.trailers, meta?.trailers]);

  const handleBackgroundError = useCallback(
    (event: any) => {
      console.warn('Background image failed to load:', event);
      if (backgroundCandidateIndex + 1 < artworkCandidates.background.length) {
        setBackgroundCandidateIndex(index => index + 1);
      } else {
        setBackgroundCandidateIndex(artworkCandidates.background.length);
        repairBrokenArtwork('background');
      }
    },
    [backgroundCandidateIndex, artworkCandidates.background.length, repairBrokenArtwork],
  );

  const relatedItems = useMemo<RelatedItem[]>(
    () => (info?.related || []) as RelatedItem[],
    [info?.related],
  );
  const relatedVariantSource = useMemo(
    () =>
      relatedItems.find(
        item =>
          item.link === route.params.link ||
          item.link === activeLink ||
          item.variants?.some(
            variant =>
              variant.link === route.params.link || variant.link === activeLink,
          ),
      ),
    [activeLink, relatedItems, route.params.link],
  );
  const variants = useMemo<PostVariant[]>(() => {
    const fallbackVariants = (relatedVariantSource?.variants || []).filter(
      variant => !!variant?.link && !!variant?.status,
    );
    return routeVariants.length > 1 ? routeVariants : fallbackVariants;
  }, [relatedVariantSource?.variants, routeVariants]);
  const activeDubStatus = useMemo(() => {
    if (route.params.dubStatus) {
      return route.params.dubStatus;
    }
    if (
      variants.some(variant => variant.status === 'subbed') &&
      variants.some(variant => variant.status === 'dubbed')
    ) {
      return 'both' as const;
    }
    return variants[0]?.status;
  }, [route.params.dubStatus, variants]);
  const activeDubStatusKey = useMemo(() => {
    if (route.params.dubStatusKey) {
      return route.params.dubStatusKey;
    }
    if (activeDubStatus === 'both') {
      return 'Subbed and dubbed' as const;
    }
    if (activeDubStatus === 'dubbed') {
      return 'Dubbed' as const;
    }
    if (activeDubStatus === 'subbed') {
      return 'Subbed' as const;
    }
    return undefined;
  }, [activeDubStatus, route.params.dubStatusKey]);

  const currentInfoEntry = useMemo(
    () => ({
      catalogRef: route.params.catalogRef,
      link: activeLink,
      provider: providerValue,
      poster: posterImage,
      variants,
      dubStatus: activeDubStatus,
      dubStatusKey: activeDubStatusKey,
    }),
    [
      activeDubStatus,
      activeDubStatusKey,
      activeLink,
      posterImage,
      providerValue,
      variants,
    ],
  );
  const filteredLinkList = useMemo(() => {
    if (!info?.linkList) {
      return [];
    }

    const filtered = info.linkList.filter(
      (item: any) =>
        !item.quality || !excludedQualities.includes(item.quality as string),
    );

    return filtered.length > 0 ? filtered : info.linkList;
  }, [info?.linkList, excludedQualities]);

  const statusTag = useMemo(() => {
    if (!hasAnimeExternalIds) {
      return null;
    }
    const tags = info?.tags ?? [];
    const tagKeys = info?.tagKeys ?? {};
    const statusKeys = new Set(['Ongoing', 'Completed', 'Upcoming', 'Dropped']);
    const matched = tags.find((tag: string) =>
      statusKeys.has(tagKeys[tag] || ''),
    );
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
    return info.tags.slice(0, 3).map((tag: string) => {
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
    return info.genres.map((genre: string) => {
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
  }, [
    meta?.genres,
    isStreamingUnity,
    providerLocalizedGenres,
    localizedGenres,
  ]);
  const metaCast = useMemo(() => meta?.cast ?? [], [meta?.cast]);
  const providerCast = useMemo(
    () =>
      isStreamingUnity
        ? (info?.cast ?? [])
        : allowProviderCast
          ? (info?.cast ?? [])
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
        (showProviderFallback &&
          !hasAnimeExternalIds &&
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
    setRefreshing(true);
    try {
      await refetch();
      setEpisodeRefreshVersion(version => version + 1);
    } catch (refreshError) {
      console.error('Error refreshing content:', refreshError);
      // Could show a toast or alert here if needed
    } finally {
      setRefreshing(false);
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

  // Initial loading is non-interactive; closing the screen remains available.
  if (infoLoading && !info) {
    return (
      <View style={{flex: 1, backgroundColor: 'black', paddingTop: insets.top}}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Close')}
          onPress={handleClose} style={{width: 56, height: 56, alignItems: 'center', justifyContent: 'center'}}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{padding: 16, width: '100%', maxWidth: isTabletDevice ? undefined : 840, alignSelf: 'center'}}>
          <View accessible accessibilityLabel={t('Loading content')} accessibilityState={{busy: true}}>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
              <SkeletonLoader height={Math.min(360, infoHeaderHeight / 2)} width="100%" />
              <SkeletonLoader height={28} width="65%" />
              <SkeletonLoader height={16} width="90%" />
              <SkeletonLoader height={16} width="80%" />
              <SkeletonLoader height={90} width="100%" />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Error handling - show error UI instead of throwing
  if (error) {
    return (
      <ScrollView style={{flex: 1, backgroundColor: 'black'}} contentContainerStyle={{flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24}}>
        <StatusBar
          showHideTransition={'slide'}
          animated={true}
          translucent={true}
          backgroundColor="black"
        />
        <Text accessibilityRole="header" style={{color: 'white', fontFamily: HOME_FONT.bold, fontSize: 20, textAlign: 'center', marginBottom: 16}}>
          {t('Failed to load content')}
        </Text>
        <Text style={{color: '#a0a0a8', fontFamily: HOME_FONT.regular, fontSize: 14, textAlign: 'center', marginBottom: 24, maxWidth: 640}}>
          {error.message ||
            t('An unexpected error occurred while loading the content')}
        </Text>
        <TouchableOpacity
          accessibilityRole="button" disabled={refreshing} accessibilityState={{disabled: refreshing, busy: refreshing}}
          onPress={handleRefresh}
          style={{backgroundColor: primary, minHeight: 48, justifyContent: 'center', padding: 16, marginBottom: 12, opacity: refreshing ? 0.5 : 1}}>
          <Text style={{color: 'black', fontFamily: HOME_FONT.bold}}>{t('Try Again')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button" onPress={() => navigation.goBack()}
          style={{minHeight: 48, justifyContent: 'center', padding: 16}}>
          <Text style={{color: 'white', fontFamily: HOME_FONT.medium}}>{t('Go Back')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <QueryErrorBoundary>
      <View
        className="h-full w-full"
        onLayout={event => {
          setContentWidth(event.nativeEvent.layout.width);
          setContentHeight(event.nativeEvent.layout.height);
          markPerfNavigationStage('first_layout');
        }}>
        <StatusBar
          showHideTransition={'slide'}
          animated={true}
          translucent={true}
          backgroundColor="transparent"
        />
        <View style={{flex: 1}}>
          <View style={{position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40,
            paddingTop: insets.top, paddingHorizontal: 12}}>
            <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.65)', 'transparent']}
              style={{position: 'absolute', top: 0, bottom: 0, left: 0, right: 0}} />
            <Animated.View pointerEvents="none" style={{position: 'absolute', top: 0,
              bottom: 0, left: 0, right: 0, backgroundColor: 'black', opacity: toolbarOpacity}} />
            <View style={{minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Close')}
              onPress={handleClose} style={{width: 44, height: 48, alignItems: 'center', justifyContent: 'center'}}>
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            <Animated.View style={{flex: 1, opacity: toolbarOpacity}} pointerEvents="none">
              <Text numberOfLines={1} style={{color: 'white', fontFamily: HOME_FONT.heading, fontSize: 20}}>
                {displayTitle}
              </Text>
            </Animated.View>
            {showInfoBack ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('Go Back')}
                onPress={handleInfoBack}
                style={{width: 44, height: 48, alignItems: 'center', justifyContent: 'center'}}>
                <Ionicons name="chevron-back" size={24} color="white" />
              </TouchableOpacity>
            ) : null}
            </View>
          </View>
          <InfoAdaptiveLayout landscape={tabletLandscape} scrollY={scrollY} toolbarHeight={insets.top + 56}
            refreshControl={<RefreshControl colors={[primary]} tintColor={primary} progressBackgroundColor="black" refreshing={refreshing} onRefresh={handleRefresh} />}
            tabs={(<View accessibilityRole="tablist" style={{backgroundColor: 'black', flexDirection: 'row', justifyContent: tabletLandscape ? 'center' : 'flex-start', borderBottomWidth: 1, borderBottomColor: '#23252b', marginBottom: 0}}>
                        {(['episodes', 'related'] as const).map(tab => (
                          <TouchableOpacity key={tab} accessibilityRole="tab" accessibilityState={{selected: infoView === tab}}
                            onPress={() => setInfoView(tab)} style={{flex: isTabletDevice ? undefined : 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 12,
                              borderBottomWidth: 3, borderBottomColor: infoView === tab ? primary : 'transparent'}}>
                            <Text style={{color: infoView === tab ? 'white' : '#a0a0a8', fontFamily: HOME_FONT.bold, fontSize: 16}}>
                              {t(tab === 'episodes' ? 'Episodes' : 'Related')}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>)}
            background={(
          <View className="absolute w-full" style={{height: infoHeaderHeight}}>
            <SkeletonLoader
              show={infoLoading}
              height={infoHeaderHeight}
              width={'100%'}>
              <Image
                source={{uri: resolvedBackgroundImage}}
                style={{height: infoHeaderHeight, width: '100%'}}
                resizeMode="cover"
                onError={handleBackgroundError}
              />
            </SkeletonLoader>
          </View>
            )}
            summary={<>
                <View
                  className="relative w-full"
                  style={{minHeight: infoHeaderHeight, justifyContent: 'flex-end'}}>
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.15)', 'black']}
                    locations={[0, 0.45, 1]}
                    style={{position: 'absolute', top: 0, bottom: 0, left: 0, right: 0}}
                  />
                  <View style={{alignItems: isTabletDevice ? 'flex-start' : 'center', paddingHorizontal: 24, paddingTop: insets.top + 72, paddingBottom: 16, gap: 12}}>
                    {logoImage ? (
                      <RemoteLogo
                        align={isTabletDevice ? 'left' : 'center'}
                        uri={logoImage}
                        width={Math.min(320, Math.max(1, contentWidth - 48))}
                        height={100}
                        onError={handleLogoError}
                        onLoad={handleLogoLoad}
                      />
                    ) : infoLoading ? (
                      <View style={{width: 200, height: 100}} />
                    ) : (
                      <View style={{width: '100%'}}>
                        <Text style={{color: 'white', fontFamily: HOME_FONT.heading, fontSize: 28, textAlign: 'center'}}>
                          {displayTitle}
                        </Text>
                        {isDubbedItalian ? (
                          <Text className="text-gray-300 text-xs mt-1 text-center">
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
                <View style={{backgroundColor: 'black', width: '100%'}}>
                <View style={{padding: 16, backgroundColor: 'black', width: '100%', maxWidth: isTabletDevice ? undefined : 840, alignSelf: 'center'}}>
                  {variants.length > 1 ? (
                    <View className="mb-4">
                      <Text className="text-gray-300 text-xs mb-2">
                        {t('Version')}
                      </Text>
                      <View className="flex-row gap-2 flex-wrap">
                        {variants.map(variant => {
                          const isSelected = variant.link === activeLink;
                          return (
                            <TouchableOpacity
                              key={`${variant.status}:${variant.link}`}
                              onPress={() =>
                                setSelectedVariantLink(variant.link)
                              }
                              className="px-3 py-1.5 rounded-md border"
                              style={{
                                backgroundColor: isSelected
                                  ? primary
                                  : '#262626',
                                borderColor: isSelected ? primary : '#404040',
                              }}>
                              <Text
                                className={`text-xs font-semibold ${
                                  isSelected ? 'text-black' : 'text-white'
                                }`}>
                                {t(variant.statusKey)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                  <View className="flex-row gap-x-3 gap-y-1 flex-wrap items-center mb-4">
                    {/* badges */}
                    {badgeYear && (
                      <Text style={{color: '#b8b8bd', fontFamily: HOME_FONT.regular, fontSize: 12}}>
                        {badgeYear}
                      </Text>
                    )}
                    {badgeRuntime && (
                      <Text style={{color: '#b8b8bd', fontFamily: HOME_FONT.regular, fontSize: 12}}>
                        {badgeRuntime}
                      </Text>
                    )}
                    {showGenreBadges &&
                      badgeGenres.map((genre: string) => (
                        <Text
                          key={genre}
                          style={{color: '#b8b8bd', fontFamily: HOME_FONT.regular, fontSize: 12}}>
                          {genre}
                        </Text>
                      ))}
                    {info?.episodesCount ? (
                      <Text style={{color: '#b8b8bd', fontFamily: HOME_FONT.regular, fontSize: 12}}>
                        {t('Episodes: {{count}}', {
                          count: info.episodesCount,
                        })}
                      </Text>
                    ) : null}
                    {displayTags.map((tag: string) => (
                      <Text
                        key={tag}
                        style={{color: '#b8b8bd', fontFamily: HOME_FONT.regular, fontSize: 12}}>
                        {tag}
                      </Text>
                    ))}
                  </View>
                  {/* synopsis */}
                  <View className="mb-2 w-full flex-row items-center justify-between">
                    <SkeletonLoader show={infoLoading} height={25} width={180}>
                      <View className="flex-row items-center gap-2">
                        <Text style={{color: 'white', fontFamily: HOME_FONT.heading, fontSize: 18}}>
                          {t('Synopsis')}
                        </Text>
                        <Text className="text-white text-xs bg-tertiary p-1 px-2 rounded-md">
                          {isCatalog ? t('catalog.cinema') : providerValue}
                        </Text>
                      </View>
                    </SkeletonLoader>
                    <View className="flex-row items-center gap-4 mb-1">
                      {trailerUrl ? (
                        <MaterialCommunityIcons
                          name="movie-open"
                          size={25}
                          color="rgb(156 163 175)"
                          onPress={() => Linking.openURL(trailerUrl)}
                        />
                      ) : null}
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
                                  if (!USER_WEBVIEW_ENABLED) {
                                    await Linking.openURL(
                                      resolveWebViewLink(activeLink),
                                    );
                                    return;
                                  }

                                  navigation.navigate('Webview', {
                                    link: activeLink,
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
                    <Text numberOfLines={3} style={{color: '#dadada', fontFamily: HOME_FONT.regular, fontSize: 14, lineHeight: 21}}>
                      {synopsis}
                    </Text>
                  </SkeletonLoader>
                  <TouchableOpacity accessibilityRole="button" onPress={() => setReadMore(true)}
                    style={{minHeight: 48, justifyContent: 'center', alignSelf: isTabletDevice ? 'center' : 'flex-start'}}>
                    <Text style={{color: primary, fontFamily: HOME_FONT.bold, fontSize: 14}}>{t('More details')}</Text>
                  </TouchableOpacity>
                  <InfoDialog visible={readMore} onClose={() => setReadMore(false)}>
                    <View style={{flex: 1}}>
                      <View style={{flexDirection: isTabletDevice ? 'row-reverse' : 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12}}>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Close')}
                          onPress={() => setReadMore(false)} style={{minWidth: 48, minHeight: 56, justifyContent: 'center'}}>
                          <Ionicons name="close" size={28} color="white" />
                        </TouchableOpacity>
                        <Text style={{flex: 1, color: 'white', fontFamily: HOME_FONT.heading, fontSize: 22}}>{t('More details')}</Text>
                      </View>
                      <ScrollView contentContainerStyle={{padding: 24, gap: 16, width: '100%', maxWidth: isTabletDevice ? undefined : 840, alignSelf: 'center'}}>
                        <Text style={{color: 'white', fontFamily: HOME_FONT.heading, fontSize: 24}}>{displayTitle}</Text>
                        <Text style={{color: '#dadada', fontFamily: HOME_FONT.regular, fontSize: 16, lineHeight: 24}}>{synopsis}</Text>
                        {/* Awards */}
                        {meta?.awards && (
                          <View className="mb-2 w-full flex-row items-baseline gap-2">
                            <Text style={{color: 'white', fontFamily: HOME_FONT.bold, fontSize: 14}}>
                              {t('Awards:')}
                            </Text>
                            <Text style={{flex: 1, color: '#dadada', fontFamily: HOME_FONT.regular, fontSize: 14}}>
                              {meta.awards}
                            </Text>
                          </View>
                        )}
                        {/* cast  */}
                        {hasCast && (
                          <View className="mb-2 w-full flex-row items-start gap-2">
                            <Text style={{color: 'white', fontFamily: HOME_FONT.bold, fontSize: 14}}>
                              {t('Cast')}
                            </Text>
                            <View className="flex-1 flex-row gap-1 flex-wrap">
                              {displayCast
                                .map((actor: string, index: number) => (
                                  <Text
                                    key={`${actor}-${index}`}
                                    style={{color: '#dadada', fontFamily: HOME_FONT.regular, fontSize: 14}}>
                                    {`${index > 0 ? ' · ' : ''}${actor}`}
                                  </Text>
                                ))}
                            </View>
                          </View>
                        )}
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
                            {showProviderFallback &&
                            !hasAnimeExternalIds &&
                            info?.country ? (
                              <Text className="text-gray-400 text-xs mt-1">
                                {t('Country: {{name}}', {name: info.country})}
                              </Text>
                            ) : null}
                            {showProviderFallback &&
                            !hasAnimeExternalIds &&
                            info?.director ? (
                              <Text className="text-gray-400 text-xs mt-1">
                                {t('Director: {{name}}', {name: info.director})}
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                      </ScrollView>
                    </View>
                  </InfoDialog>
                  {/* cast */}
                </View>
                </View>

            </>}
            footer={(

            <View style={{backgroundColor: 'black', paddingVertical: 12, paddingHorizontal: isTabletDevice ? 20 : 16, flexDirection: 'row', alignItems: 'center', gap: 12}}>
              <TouchableOpacity accessibilityRole="button"
                accessibilityState={{disabled: !playbackAction?.available, busy: playbackAction?.loading}}
                disabled={!playbackAction?.available}
                onPress={() => playbackActionRef.current?.()}
                style={{flex: 1, minHeight: 48, paddingHorizontal: 16, paddingVertical: 10,
                  borderRadius: 999, backgroundColor: primary, opacity: playbackAction?.available ? 1 : 0.5,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10}}>
                <Ionicons name="play-outline" size={22} color="black" />
                <View style={{flexShrink: 1}}>
                  <Text style={{fontFamily: HOME_FONT.bold, color: 'black', fontSize: 16}}>{playbackAction?.label || t('Play')}</Text>
                  {playbackAction?.detail ? <Text style={{fontFamily: HOME_FONT.regular, color: 'black', fontSize: 12}}>{playbackAction.detail}</Text> : null}
                </View>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button"
                accessibilityLabel={t(inLibrary ? 'Remove from watch list' : 'Add to watch list')}
                onPress={() => inLibrary ? removeLibrary() : addLibrary()}
                style={{flex: isTabletDevice ? 1 : undefined, minWidth: 48, minHeight: 48, borderRadius: 999, borderWidth: 2, borderColor: primary, flexDirection: 'row', gap: 8, paddingHorizontal: isTabletDevice ? 16 : 0, alignItems: 'center', justifyContent: 'center'}}>
                <Ionicons name={inLibrary ? 'bookmark' : 'bookmark-outline'} size={28} color={primary} />
                {isTabletDevice && <Text style={{color: primary, fontFamily: HOME_FONT.bold, fontSize: 16, flexShrink: 1}}>{t(inLibrary ? 'Remove from watch list' : 'Add to watch list')}</Text>}
              </TouchableOpacity>
            </View>
            )}>
                <View style={{padding: 16, backgroundColor: 'black', width: '100%', maxWidth: isTabletDevice ? undefined : 840, alignSelf: 'center'}}>
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

                      <View style={{display: infoView === 'episodes' ? 'flex' : 'none'}}>
                        {isCatalog && !catalog.source && (
                          <Text style={{color: 'white', fontFamily: HOME_FONT.regular, padding: 16}}>
                            {t(catalog.sources.length ? 'catalog.chooseSource' : 'catalog.noSource')}
                          </Text>
                        )}
                        {isCatalog && catalog.sources.length > 1 && (
                          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16}}>
                            {catalog.sources.map(source => (
                              <Pressable key={source.id} accessibilityRole="button"
                                accessibilityState={{selected: source.id === catalog.source?.id}}
                                onPress={() => catalog.selectSource(source.id)}
                                style={{borderRadius: 16, borderWidth: 1, borderColor: source.id === catalog.source?.id ? primary : '#555', padding: 12}}>
                                <Text style={{color: 'white', fontFamily: HOME_FONT.regular}}>
                                  {`${source.payload.provider} · ${String(source.payload.info.name || source.payload.id)}`}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                        <SeasonList
                          movieBackground={resolvedBackgroundImage}
                          tabletColumns={isTabletDevice && !tabletLandscape && contentWidth >= 720 ? 2 : 1}
                          playbackActionRef={playbackActionRef}
                          onPlaybackActionChange={setPlaybackAction}
                          key={activeLink}
                          refreshing={refreshing}
                          refreshVersion={episodeRefreshVersion}
                          providerValue={providerValue}
                          contentInfo={info}
                          excludedQualities={excludedQualities}
                          checkContent={check}
                          aniSkipMalId={
                            animeExternalIds.malId
                          }
                          contentIds={{
                            malId: animeExternalIds.malId,
                            anilistId: animeExternalIds.anilistId,
                            imdbId:
                              info?.imdbId ||
                              info?.extra?.ids?.imdbShowIds?.[0] ||
                              info?.extra?.ids?.imdbMovieIds?.[0],
                            tmdbId:
                              info?.extra?.ids?.tmdbShowIds?.[0] ||
                              info?.extra?.ids?.tmdbMovieIds?.[0],
                          }}
                          LinkList={filteredLinkList}
                          poster={{
                            logo: logoImage,
                            poster: posterImage,
                            background: backgroundImage,
                          }}
                          type={info?.type || 'series'}
                          metaTitle={displayTitle}
                          routeParams={activeRouteParams}
                        />
                      </View>
                      {infoView === 'related' && (
                        <View style={{flexDirection: isTabletDevice ? 'row' : 'column', flexWrap: 'wrap', gap: 12}}>
                          {relatedItems.length === 0 ? (
                            <Text accessibilityLiveRegion="polite" style={{color: '#a0a0a8', fontFamily: HOME_FONT.regular, fontSize: 14, textAlign: 'center', paddingVertical: 32}}>
                              {t('No related items available.')}
                            </Text>
                          ) : (
                            relatedItems.map(
                              (item: RelatedItem, index: number) => {
                                const hasItalianVariant =
                                  item.dubStatus === 'dubbed' ||
                                  item.dubStatus === 'both' ||
                                  hasItaBadge(item.title);
                                return (
                                  <TouchableOpacity
                                    key={`${item.link}-${index}`}
                                    className={isTabletDevice ? undefined : 'flex-row items-center gap-3 bg-quaternary p-2 rounded-md'}
                                    style={isTabletDevice ? {width: tabletLandscape ? (contentWidth * 0.37 - 44) / 2 : (contentWidth - 32 - 48) / 5, gap: 8} : undefined}
                                    onPress={() =>
                                      navigation.dispatch(
                                        StackActions.push('Info', {
                                          link: item.link,
                                          provider: providerValue,
                                          poster: item.image,
                                          variants: item.variants,
                                          dubStatus: item.dubStatus,
                                          dubStatusKey: item.dubStatusKey,
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
                                        style={isTabletDevice ? {width: '100%', aspectRatio: 2 / 3} : {width: 60, height: 90}}
                                      />
                                      {hasItalianVariant ? (
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
                                      <Text numberOfLines={isTabletDevice ? 2 : undefined} className="text-white text-sm font-semibold">
                                        {item.title}
                                      </Text>
                                      <Text className="text-gray-400 text-xs mt-1">
                                        {[item.type, item.year]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              },
                            )
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>

          </InfoAdaptiveLayout>
        </View>
      </View>
    </QueryErrorBoundary>
  );
}
