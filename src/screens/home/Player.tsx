import React, {useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {
  ScrollView,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
  Platform,
  TouchableNativeFeedback,
  Alert,
  AppState,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../App';
import {
  cacheStorage,
  mainStorage,
  settingsStorage,
  watchHistoryStorage,
} from '../../lib/storage';
import VideoPlayer from '../../vendor/media-console';
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {BlurView} from 'expo-blur';
import {
  VideoRef,
  SelectedVideoTrack,
  SelectedVideoTrackType,
  ResizeMode,
  SelectedTrack,
  SelectedTrackType,
} from 'react-native-video';
import useContentStore from '../../lib/zustand/contentStore';
import GoogleCast, {
  CastButton,
  CastState,
  useCastState,
  useRemoteMediaClient,
} from 'react-native-google-cast';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import useThemeStore from '../../lib/zustand/themeStore';
import {FlashList} from '@shopify/flash-list';
import SearchSubtitles from '../../components/SearchSubtitles';
import PlayerEpisodeSidebar from '../../components/PlayerEpisodeSidebar';
import PlayerMenuRow from '../../components/PlayerMenuRow';
import useWatchHistoryStore from '../../lib/zustand/watchHistrory';
import {useStream, useVideoSettings} from '../../lib/hooks/useStream';
import {useContentInfo} from '../../lib/hooks/useContentInfo';
import {
  usePlayerProgress,
  usePlayerSettings,
} from '../../lib/hooks/usePlayerSettings';
import * as NavigationBar from 'expo-navigation-bar';
import {StatusBar} from 'react-native';
import {useTranslation} from 'react-i18next';
import {extensionManager} from '../../lib/services/ExtensionManager';
import {providerManager} from '../../lib/services/ProviderManager';
import {openInWebVideoCaster} from '../../lib/cast/webVideoCaster';
import {
  prepareNativeCastQueue,
  resolveCastSubtitleUri,
} from '../../lib/cast/nativeCast';
import {
  clearActiveVegaCastTracking,
  fetchVegaCastProgress,
  getActiveVegaCastTracking,
  normalizeVegaCastEpisodeProgress,
  openVegaCastReceiverUrl,
  prepareVegaCastLaunchData,
  saveActiveVegaCastTracking,
  VegaCastEpisodeProgressSnapshot,
  VegaCastTracking,
} from '../../lib/cast/vegaCast';
import {setClipboardString} from '../../lib/utils/clipboard';
import {EpisodeLink, Link} from '../../lib/providers/types';
import {
  resolveProviderCardTitle,
  shouldResolveProviderCardTitle,
} from '../../lib/utils/providerCardTitleResolver';
import {buildProviderCacheKey} from '../../lib/utils/providerCacheScope';
import {hasStreamRequestHeaders} from '../../lib/utils/streamHeaders';
import {torrentManager} from '../../lib/torrentManager';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

const goFullScreen = () => {
  if (Platform.OS === 'android') {
    // Hide the navigation bar
    NavigationBar.setVisibilityAsync('hidden');
    StatusBar.setHidden(true, 'slide');
  }
  // `expo-status-bar` handles the top bar
};

const exitFullScreen = () => {
  if (Platform.OS === 'android') {
    // Show the navigation bar
    NavigationBar.setVisibilityAsync('visible');
    StatusBar.setHidden(false, 'slide');
  }
};

const STREAM_RETRY_COOLDOWN_MS = 3000;
const STREAM_START_TIMEOUT_MS = 8000;
const SUBTITLE_GATE_TIMEOUT_MS = 1500;
const ANISKIP_BASE_URL = 'https://api.aniskip.com/v2/skip-times';
const ANISKIP_TYPES = ['op', 'mixed-op'];
const SKIP_INTRO_TIMEOUT_MS = 8000;
const SKIP_INTRO_LEAD_SECONDS = 1.5;
const PLAYER_CONTROL_COLOR = 'rgba(255,255,255,0.68)';
const PLAYER_CONTROL_LABEL_STYLE = {
  color: PLAYER_CONTROL_COLOR,
  fontWeight: '300' as const,
};

type SkipIntroInterval = {
  startTime: number;
  endTime: number;
};

type AniSkipResult = {
  interval?: {
    startTime?: number;
    endTime?: number;
  };
  skipType?: string;
};

const parseEpisodeNumberFromTitle = (title?: string): number | undefined => {
  if (!title) {
    return undefined;
  }
  const match = title.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return undefined;
  }
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildAniSkipUrl = (
  malId: number,
  episodeNumber: number,
  episodeLength: number,
): string => {
  const typesQuery = ANISKIP_TYPES.map(type => `types=${type}`).join('&');
  const length = Math.max(0, Math.round(episodeLength));
  return `${ANISKIP_BASE_URL}/${malId}/${episodeNumber}?${typesQuery}&episodeLength=${length}`;
};

const pickIntroInterval = (
  results: AniSkipResult[],
  episodeDuration: number,
): SkipIntroInterval | null => {
  const normalized = results
    .map(result => ({
      skipType: result.skipType || '',
      startTime:
        typeof result.interval?.startTime === 'number'
          ? result.interval.startTime
          : Number.NaN,
      endTime:
        typeof result.interval?.endTime === 'number'
          ? result.interval.endTime
          : Number.NaN,
    }))
    .filter(
      item =>
        Number.isFinite(item.startTime) &&
        Number.isFinite(item.endTime) &&
        item.endTime > item.startTime,
    );

  if (normalized.length === 0) {
    return null;
  }

  const preferred = normalized.filter(item => item.skipType === 'op');
  const candidates =
    preferred.length > 0
      ? preferred
      : normalized.filter(item => item.skipType === 'mixed-op');
  if (candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => {
    if (a.startTime !== b.startTime) {
      return a.startTime - b.startTime;
    }
    return b.endTime - a.endTime;
  });
  const chosen = sorted[0];
  const endTime =
    episodeDuration > 0
      ? Math.min(chosen.endTime, episodeDuration)
      : chosen.endTime;
  if (endTime <= chosen.startTime) {
    return null;
  }

  return {
    startTime: Math.max(0, chosen.startTime),
    endTime,
  };
};

const Player = ({route}: Props): React.JSX.Element => {
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const {provider} = useContentStore();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === 'active',
  );
  const immersiveReapplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const {addItem, updatePlaybackInfo, updateItemWithInfo} =
    useWatchHistoryStore();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      setIsAppActive(nextState === 'active');
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Player ref
  const playerRef = useRef<VideoRef>(null!);
  const hasSetInitialTracksRef = useRef(false);
  const loadedDurationRef = useRef(0);
  const streamRetryRef = useRef({
    retryKey: '',
    count: 0,
    lastAttempt: 0,
  });
  const streamStartupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const streamStartupGuardKeyRef = useRef('');
  const streamStartupProgressSeenRef = useRef(false);
  const streamStartupHandlingRef = useRef(false);

  // Shared values for animations
  const loadingOpacity = useSharedValue(0);
  const loadingScale = useSharedValue(0.8);
  const loadingRotation = useSharedValue(0);
  const lockButtonTranslateY = useSharedValue(-150);
  const lockButtonOpacity = useSharedValue(0);
  const textVisibility = useSharedValue(0);
  const speedIconOpacity = useSharedValue(1);
  const controlsTranslateY = useSharedValue(150);
  const controlsOpacity = useSharedValue(0);
  const toastOpacity = useSharedValue(0);
  const settingsTranslateY = useSharedValue(10000);
  const settingsOpacity = useSharedValue(0);

  // Animated styles
  const loadingContainerStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
    transform: [{scale: loadingScale.value}],
  }));

  const loadingIconStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${loadingRotation.value}deg`}],
  }));

  const lockButtonStyle = useAnimatedStyle(() => ({
    transform: [{translateY: lockButtonTranslateY.value}],
    opacity: lockButtonOpacity.value,
  }));

  const controlsStyle = useAnimatedStyle(() => ({
    transform: [{translateY: controlsTranslateY.value}],
    opacity: controlsOpacity.value,
  }));

  const controlsOpacityStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
  }));

  const settingsStyle = useAnimatedStyle(() => ({
    transform: [{translateY: settingsTranslateY.value}],

    opacity: settingsOpacity.value,
  }));

  // Active episode state
  const [activeEpisode, setActiveEpisode] = useState(
    route.params?.episodeList?.[route.params.linkIndex],
  );
  const currentEpisodeNumber = useMemo(() => {
    const episodeList = route.params?.episodeList || [];
    const currentEpisodeIndex = episodeList.findIndex(
      item => item?.link === activeEpisode?.link,
    );
    const episodeNumberFromTitle = parseEpisodeNumberFromTitle(
      activeEpisode?.title,
    );
    const fallbackEpisodeNumber =
      currentEpisodeIndex >= 0 ? currentEpisodeIndex + 1 : undefined;
    return episodeNumberFromTitle ?? fallbackEpisodeNumber;
  }, [activeEpisode?.link, activeEpisode?.title, route.params?.episodeList]);

  // Search subtitles state
  const [searchQuery, setSearchQuery] = useState('');

  // Custom hooks for stream management
  const {
    streamData,
    selectedStream,
    setSelectedStream,
    externalSubs,
    setExternalSubs,
    isLoading: streamLoading,
    error: streamError,
    refetch,
    switchToNextStream,
  } = useStream({
    activeEpisode,
    routeParams: route.params,
    provider: provider.value,
  });
  const [processedStreamUrl, setProcessedStreamUrl] = useState('');
  const [isResolvingStream, setIsResolvingStream] = useState(false);
  const [torrentState, setTorrentState] = useState('');
  const [torrentDownloaded, setTorrentDownloaded] = useState(0);
  const [torrentDownloadSpeed, setTorrentDownloadSpeed] = useState(0);
  const activeTorrentRef = useRef<string | null>(null);
  const torrentProgressRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const findTorrentVideoFile = useCallback(
    async (infoHash: string, magnetLink: string): Promise<number> => {
      const files = await torrentManager.getFiles(infoHash);
      if (!files.length) {
        throw new Error('No files found in torrent');
      }

      const requestedIndex = Number(
        magnetLink.match(/[?&]so=(\d+)/i)?.[1] ?? Number.NaN,
      );
      if (
        Number.isInteger(requestedIndex) &&
        files.some(file => file.index === requestedIndex)
      ) {
        return requestedIndex;
      }

      const videoExtensions = [
        '.mp4',
        '.mkv',
        '.avi',
        '.webm',
        '.mov',
        '.ts',
        '.flv',
        '.wmv',
        '.m4v',
      ];
      const candidates = files.filter(file =>
        videoExtensions.some(extension =>
          file.name.toLowerCase().endsWith(extension),
        ),
      );
      return (candidates.length ? candidates : files).reduce((largest, file) =>
        file.size > largest.size ? file : largest,
      ).index;
    },
    [],
  );

  useEffect(() => {
    let active = true;

    const stopCurrentTorrent = async () => {
      if (torrentProgressRef.current) {
        clearInterval(torrentProgressRef.current);
        torrentProgressRef.current = null;
      }
      const previous = activeTorrentRef.current;
      activeTorrentRef.current = null;
      if (previous) {
        await torrentManager.deleteTorrent(previous, true).catch(() => {});
      }
    };

    const resolveStream = async () => {
      await stopCurrentTorrent();
      if (!active || !selectedStream?.link) {
        setProcessedStreamUrl('');
        setIsResolvingStream(false);
        return;
      }

      const isTorrent =
        selectedStream.type === 'torrent' ||
        selectedStream.link.startsWith('magnet:');
      if (!isTorrent) {
        setProcessedStreamUrl(selectedStream.link);
        setIsResolvingStream(false);
        return;
      }

      setProcessedStreamUrl('');
      setIsResolvingStream(true);
      setTorrentState(t('Fetching torrent metadata...'));
      setTorrentDownloaded(0);
      setTorrentDownloadSpeed(0);
      try {
        const added = await torrentManager.addTorrent(selectedStream.link);
        if (!active) {
          await torrentManager.deleteTorrent(added.infoHash, true);
          return;
        }
        activeTorrentRef.current = added.infoHash;
        torrentProgressRef.current = setInterval(async () => {
          try {
            const stats = await torrentManager.getStats(added.infoHash);
            if (active) {
              setTorrentState(stats.state || '');
              setTorrentDownloaded((stats.totalDone || 0) / 1024 / 1024);
              setTorrentDownloadSpeed(stats.downloadRate || 0);
            }
          } catch {}
        }, 1000);

        const fileIndex = await findTorrentVideoFile(
          added.infoHash,
          selectedStream.link,
        );
        const preparation = torrentManager.prepareVideoFile(
          added.infoHash,
          fileIndex,
        );
        const streamUrl = await torrentManager.getStreamUrl(
          added.infoHash,
          fileIndex,
        );
        if (active) {
          setProcessedStreamUrl(streamUrl);
          setIsResolvingStream(false);
        }
        await preparation;
      } catch (torrentError) {
        console.error('Failed to start torrent stream:', torrentError);
        if (active) {
          setIsResolvingStream(false);
          if (!switchToNextStream()) {
            ToastAndroid.show(
              t('Failed to load torrent stream.'),
              ToastAndroid.SHORT,
            );
          }
        }
      }
    };

    resolveStream().catch(error => {
      console.error('Unexpected stream resolution failure:', error);
    });
    return () => {
      active = false;
      stopCurrentTorrent().catch(error => {
        console.error('Failed to stop current torrent:', error);
      });
    };
    // switchToNextStream changes identity on each render in useStream.
  }, [findTorrentVideoFile, selectedStream, t]);

  // Custom hooks for video settings
  const {
    audioTracks,
    textTracks,
    videoTracks,
    selectedAudioTrackIndex,
    selectedTextTrackIndex,
    selectedQualityIndex,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
    setSelectedQualityIndex,
    setTextTracks,
    processAudioTracks,
    processVideoTracks,
    handleVideoLoad,
    resetVideoTracks,
  } = useVideoSettings();

  // Custom hooks for player settings
  const {
    showControls,
    setShowControls,
    showSettings,
    setShowSettings,
    activeTab,
    setActiveTab,
    resizeMode,
    playbackRate,
    setPlaybackRate,
    isPlayerLocked,
    showUnlockButton,
    toastMessage,
    showToast,
    isTextVisible,
    isFullScreen,
    handleResizeMode,
    togglePlayerLock,
    toggleFullScreen,
    handleLockedScreenTap,
    unlockButtonTimerRef,
  } = usePlayerSettings();

  // Custom hook for progress handling
  const {videoPositionRef, handleProgress} = usePlayerProgress({
    activeEpisode,
    routeParams: route.params,
    playbackRate,
    updatePlaybackInfo,
  });

  const providerValue = route.params?.providerValue || provider.value || '';
  const [resolvedPrimaryTitle, setResolvedPrimaryTitle] = useState(
    (route.params?.primaryTitle || '').trim(),
  );

  useEffect(() => {
    setResolvedPrimaryTitle((route.params?.primaryTitle || '').trim());
  }, [route.params?.primaryTitle, route.params?.infoUrl]);

  useEffect(() => {
    let isCancelled = false;
    const infoLink = String(route.params?.infoUrl || '').trim();
    if (!shouldResolveProviderCardTitle(providerValue) || !infoLink) {
      return () => {
        isCancelled = true;
      };
    }

    resolveProviderCardTitle({
      providerValue,
      link: infoLink,
      fallbackTitle: route.params?.primaryTitle || '',
    })
      .then(title => {
        const normalizedTitle = (title || '').trim();
        if (!normalizedTitle || isCancelled) {
          return;
        }
        setResolvedPrimaryTitle(prev =>
          prev === normalizedTitle ? prev : normalizedTitle,
        );
      })
      .catch(error => {
        console.error('Error resolving player primary title:', error);
      });

    return () => {
      isCancelled = true;
    };
  }, [providerValue, route.params?.infoUrl, route.params?.primaryTitle]);

  const infoLinkForSkip =
    providerValue === 'animeunity' ? route.params?.infoUrl || '' : '';
  const {data: skipInfo} = useContentInfo(infoLinkForSkip, providerValue);

  const [skipIntroInterval, setSkipIntroInterval] =
    useState<SkipIntroInterval | null>(null);
  const [episodeDuration, setEpisodeDuration] = useState(0);
  const skipIntroAbortRef = useRef<AbortController | null>(null);
  const [subtitleGatePassed, setSubtitleGatePassed] = useState(true);
  const [videoReloadNonce, setVideoReloadNonce] = useState(0);
  const subtitleGateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const subtitleGateTimeoutFiredRef = useRef(false);
  const subtitleReloadedRef = useRef(false);
  const subtitleReloadSeekRef = useRef<number | null>(null);

  // Memoized values
  const playbacks = useMemo(
    () => [0.25, 0.5, 1.0, 1.25, 1.35, 1.5, 1.75, 2],
    [],
  );
  const hideSeekButtons = useMemo(
    () => settingsStorage.hideSeekButtons() || false,
    [],
  );

  const enableSwipeGesture = useMemo(
    () => settingsStorage.isSwipeGestureEnabled(),
    [],
  );
  const enable2xGesture = useMemo(
    () => settingsStorage.isEnable2xGestureEnabled(),
    [],
  );
  const showMediaControls = useMemo(
    () => settingsStorage.showMediaControls(),
    [],
  );
  const hasExpectedExternalSubs = useMemo(() => {
    if (!streamData || streamData.length === 0) {
      return false;
    }
    return streamData.some(
      stream => Array.isArray(stream?.subtitles) && stream.subtitles.length > 0,
    );
  }, [streamData]);
  const isSubtitleGatePending = hasExpectedExternalSubs && !subtitleGatePassed;
  const isPreparingPlayer =
    streamLoading || isSubtitleGatePending || isResolvingStream;
  const mergedTextTracks = useMemo(() => {
    const normalizedInternal = (textTracks || []).map((track, idx) => ({
      ...track,
      index: typeof track.index === 'number' ? track.index : idx,
      source: 'internal' as const,
    }));
    const maxIndex = normalizedInternal.reduce(
      (max, track) => Math.max(max, track.index),
      -1,
    );
    const normalizedExternal = (externalSubs || []).map((track, idx) => ({
      ...track,
      index: maxIndex + 1 + idx,
      source: 'external' as const,
    }));
    return [...normalizedInternal, ...normalizedExternal];
  }, [textTracks, externalSubs]);
  const buildSelectedTextTrack = useCallback((track: any): SelectedTrack => {
    if (!track) {
      return {type: SelectedTrackType.DISABLED};
    }
    const language = typeof track.language === 'string' ? track.language : '';
    const title = typeof track.title === 'string' ? track.title : '';
    const uri = typeof track.uri === 'string' ? track.uri : '';

    if (typeof track.index === 'number') {
      return {
        type: SelectedTrackType.INDEX,
        value: String(track.index),
      };
    }
    if (language) {
      return {type: SelectedTrackType.LANGUAGE, value: language};
    }
    if (title) {
      return {type: SelectedTrackType.TITLE, value: title};
    }
    if (uri) {
      return {type: SelectedTrackType.TITLE, value: uri};
    }
    return {type: SelectedTrackType.DISABLED};
  }, []);
  const selectedSubtitleLabel = useMemo(() => {
    if (selectedTextTrackIndex === 1000) {
      return t('None');
    }
    const selectedTrack = mergedTextTracks.find(
      track => track.index === selectedTextTrackIndex,
    );
    return (
      selectedTrack?.language ||
      selectedTrack?.title ||
      selectedTrack?.uri ||
      t('None')
    );
  }, [mergedTextTracks, selectedTextTrackIndex, t]);
  const skipMalId = useMemo(() => {
    const raw = skipInfo?.extra?.ids?.malId;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
  }, [skipInfo?.extra?.ids?.malId]);

  // Memoized watched duration
  const watchedDuration = useMemo(() => {
    const cached = cacheStorage.getString(activeEpisode?.link);
    return cached ? JSON.parse(cached).position : 0;
  }, [activeEpisode?.link]);

  // Memoized selected tracks
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<SelectedTrack>({
    type: SelectedTrackType.INDEX,
    value: 0,
  });

  const [selectedTextTrack, setSelectedTextTrack] = useState<SelectedTrack>({
    type: SelectedTrackType.DISABLED,
  });

  const [selectedVideoTrack, setSelectedVideoTrack] =
    useState<SelectedVideoTrack>({
      type: SelectedVideoTrackType.AUTO,
    });

  const remoteMediaClient = useRemoteMediaClient();
  const castState = useCastState();
  const [castProvider, setCastProvider] = useState<'native' | 'wvc' | 'vega'>(
    settingsStorage.getCastProvider(),
  );
  const [vegaTracking, setVegaTracking] = useState<VegaCastTracking | null>(
    null,
  );
  const [pendingNativeCast, setPendingNativeCast] = useState(false);
  const [isStartingNativeCast, setIsStartingNativeCast] = useState(false);
  const lastCastProgressWriteRef = useRef(0);
  const lastVegaProgressSyncRef = useRef(0);
  const currentCastEpisodeRef = useRef<{
    link?: string;
    title?: string;
    episodeNumber?: number;
    seasonNumber?: number;
  }>({});

  // Memoized format quality function
  const formatQuality = useCallback(
    (quality: string) => {
      if (quality === 'auto') {
        return t('Auto');
      }
      const num = Number(quality);
      if (num > 1080) {
        return '4K';
      }
      if (num > 720) {
        return '1080p';
      }
      if (num > 480) {
        return '720p';
      }
      if (num > 360) {
        return '480p';
      }
      if (num > 240) {
        return '360p';
      }
      if (num > 144) {
        return '240p';
      }
      return quality;
    },
    [t],
  );

  const formatVideoTrackQuality = useCallback(
    (track?: any) => {
      const height = Number(track?.height);
      if (!Number.isFinite(height) || height <= 0) {
        return formatQuality('auto');
      }

      const width = Number(track?.width);
      const qualityLabel = formatQuality(String(height));
      if (Number.isFinite(width) && width > 0) {
        return `${qualityLabel} (${width}x${height})`;
      }

      return qualityLabel;
    },
    [formatQuality],
  );

  const normalizeEpisodeList = useCallback((list: any[]) => {
    if (!Array.isArray(list)) {
      return [];
    }
    return list.filter(item => item && item.link && item.title);
  }, []);
  const resolveLocalizedItemTitle = useCallback(
    (
      item?: {
        title?: string;
        titleKey?: string;
        titleParams?: Record<string, any>;
      } | null,
    ) => {
      if (!item) {
        return '';
      }
      if (item.titleKey) {
        return t(item.titleKey, item.titleParams);
      }
      return item.title || '';
    },
    [t],
  );

  const hasEpisodesModule = useMemo(
    () =>
      !!providerValue &&
      !!extensionManager.getProviderModules(providerValue)?.modules.episodes,
    [providerValue],
  );

  const getCachedEpisodes = useCallback(
    (episodesLink?: string) => {
      if (!episodesLink) {
        return [];
      }
      const cached = cacheStorage.getString(
        buildProviderCacheKey('episodes', providerValue, episodesLink),
      );
      if (!cached) {
        return [];
      }
      try {
        const parsed = JSON.parse(cached);
        return normalizeEpisodeList(parsed);
      } catch (error) {
        console.warn('Failed to parse episodes cache:', error);
        return [];
      }
    },
    [normalizeEpisodeList],
  );

  const loadSeasonEpisodes = useCallback(
    async (season?: any) => {
      if (!season) {
        return [];
      }
      if (Array.isArray(season?.directLinks) && season.directLinks.length > 0) {
        return normalizeEpisodeList(season.directLinks);
      }
      if (!season?.episodesLink) {
        return [];
      }

      const cachedEpisodes = getCachedEpisodes(season.episodesLink);
      if (cachedEpisodes.length > 0) {
        return cachedEpisodes;
      }
      if (!hasEpisodesModule) {
        return [];
      }

      try {
        const episodes = await providerManager.getEpisodes({
          url: season.episodesLink,
          providerValue,
        });
        const normalizedEpisodes = normalizeEpisodeList(episodes);
        if (normalizedEpisodes.length > 0) {
          cacheStorage.setString(
            buildProviderCacheKey(
              'episodes',
              providerValue,
              season.episodesLink,
            ),
            JSON.stringify(normalizedEpisodes),
          );
        }
        return normalizedEpisodes;
      } catch (error) {
        console.error('Failed to load season episodes in player:', error);
        return [];
      }
    },
    [getCachedEpisodes, hasEpisodesModule, normalizeEpisodeList, providerValue],
  );

  const currentRouteEpisodeList = useMemo(
    () =>
      normalizeEpisodeList(route.params?.episodeList || []) as EpisodeLink[],
    [normalizeEpisodeList, route.params?.episodeList],
  );

  const episodeGroups = useMemo<Link[]>(() => {
    if (
      Array.isArray(route.params?.seasons) &&
      route.params.seasons.length > 0
    ) {
      return route.params.seasons;
    }

    if (currentRouteEpisodeList.length === 0) {
      return [];
    }

    const fallbackTitle = route.params?.secondaryTitle || t('Episodes');
    return [
      {
        title: fallbackTitle,
        ...(route.params?.secondaryTitle ? {} : {titleKey: 'Episodes'}),
        seasonNumber: route.params?.seasonNumber,
        episodesLink: route.params?.seasonEpisodesLink,
        directLinks: currentRouteEpisodeList.map(item => ({
          ...item,
          type: (route.params?.type === 'movie' ? 'movie' : 'series') as
            | 'movie'
            | 'series',
        })),
      },
    ];
  }, [
    currentRouteEpisodeList,
    route.params?.seasonEpisodesLink,
    route.params?.seasonNumber,
    route.params?.secondaryTitle,
    route.params?.seasons,
    route.params?.type,
    t,
  ]);

  const currentGroupIndex = useMemo(() => {
    if (episodeGroups.length === 0) {
      return -1;
    }

    if (
      typeof route.params?.seasonIndex === 'number' &&
      route.params.seasonIndex >= 0 &&
      route.params.seasonIndex < episodeGroups.length
    ) {
      return route.params.seasonIndex;
    }

    if (route.params?.seasonEpisodesLink) {
      const byEpisodesLink = episodeGroups.findIndex(
        group => group?.episodesLink === route.params.seasonEpisodesLink,
      );
      if (byEpisodesLink >= 0) {
        return byEpisodesLink;
      }
    }

    if (activeEpisode?.link) {
      const byDirectLink = episodeGroups.findIndex(group =>
        Array.isArray(group?.directLinks)
          ? group.directLinks.some(item => item?.link === activeEpisode.link)
          : false,
      );
      if (byDirectLink >= 0) {
        return byDirectLink;
      }
    }

    return 0;
  }, [
    activeEpisode?.link,
    episodeGroups,
    route.params?.seasonEpisodesLink,
    route.params?.seasonIndex,
  ]);

  const [episodesTabGroupIndex, setEpisodesTabGroupIndex] = useState(0);
  const [episodesTabEpisodeList, setEpisodesTabEpisodeList] = useState<
    EpisodeLink[]
  >(currentRouteEpisodeList);
  const [episodesTabLoading, setEpisodesTabLoading] = useState(false);
  const [episodesTabError, setEpisodesTabError] = useState<string | null>(null);
  const [showEpisodeSidebar, setShowEpisodeSidebar] = useState(false);
  const episodeSidebarLoadRequestRef = useRef(0);

  useEffect(() => {
    episodeSidebarLoadRequestRef.current += 1;
    setEpisodesTabGroupIndex(currentGroupIndex >= 0 ? currentGroupIndex : 0);
    setEpisodesTabEpisodeList(currentRouteEpisodeList);
    setEpisodesTabLoading(false);
    setEpisodesTabError(null);
    return () => {
      episodeSidebarLoadRequestRef.current += 1;
    };
  }, [
    currentGroupIndex,
    currentRouteEpisodeList,
    route.params?.seasonEpisodesLink,
  ]);

  const replacePlayerEpisode = useCallback(
    ({
      nextEpisodes,
      nextIndex,
      nextGroup,
      nextGroupIndex,
    }: {
      nextEpisodes: EpisodeLink[];
      nextIndex: number;
      nextGroup?: Link;
      nextGroupIndex?: number;
    }) => {
      const normalizedEpisodes = normalizeEpisodeList(
        nextEpisodes,
      ) as EpisodeLink[];
      const targetEpisode = normalizedEpisodes[nextIndex];
      if (!targetEpisode) {
        return false;
      }

      hasSetInitialTracksRef.current = false;
      navigation.replace('Player', {
        linkIndex: nextIndex,
        episodeList: normalizedEpisodes,
        directUrl: route.params?.directUrl,
        type: route.params?.type,
        primaryTitle: resolvedPrimaryTitle,
        secondaryTitle:
          resolveLocalizedItemTitle(nextGroup) || route.params?.secondaryTitle,
        episodeNumber: targetEpisode.episodeNumber,
        seasonNumber:
          targetEpisode.seasonNumber ??
          nextGroup?.seasonNumber ??
          route.params?.seasonNumber,
        seasonEpisodesLink:
          nextGroup?.episodesLink || route.params?.seasonEpisodesLink,
        poster: route.params?.poster,
        file: route.params?.file,
        providerValue: route.params?.providerValue,
        infoUrl: route.params?.infoUrl,
        doNotTrack: route.params?.doNotTrack,
        seasons: route.params?.seasons,
        seasonIndex:
          typeof nextGroupIndex === 'number'
            ? nextGroupIndex
            : route.params?.seasonIndex,
      });
      return true;
    },
    [
      navigation,
      normalizeEpisodeList,
      resolveLocalizedItemTitle,
      route.params?.directUrl,
      route.params?.doNotTrack,
      route.params?.file,
      route.params?.infoUrl,
      route.params?.poster,
      route.params?.providerValue,
      route.params?.seasonEpisodesLink,
      route.params?.seasonIndex,
      route.params?.seasonNumber,
      route.params?.secondaryTitle,
      route.params?.seasons,
      route.params?.type,
      resolvedPrimaryTitle,
    ],
  );

  const nextSeasonInfo = useMemo(() => {
    const seasons = route.params?.seasons;
    const seasonIndex = route.params?.seasonIndex;
    if (!Array.isArray(seasons) || typeof seasonIndex !== 'number') {
      return undefined;
    }
    const nextSeason = seasons[seasonIndex + 1];
    if (!nextSeason) {
      return undefined;
    }

    let episodeList: any[] = [];
    if (
      Array.isArray(nextSeason?.directLinks) &&
      nextSeason.directLinks.length > 0
    ) {
      episodeList = normalizeEpisodeList(nextSeason.directLinks);
    } else if (nextSeason?.episodesLink) {
      episodeList = getCachedEpisodes(nextSeason.episodesLink);
    }

    return {
      season: nextSeason,
      episodeList,
      seasonIndex: seasonIndex + 1,
    };
  }, [
    getCachedEpisodes,
    normalizeEpisodeList,
    route.params?.seasonIndex,
    route.params?.seasons,
  ]);

  // Memoized next episode handler
  const handleNextEpisode = useCallback(async () => {
    const episodeList = route.params?.episodeList || [];
    const currentIndex = episodeList.findIndex(
      item => item?.link === activeEpisode?.link,
    );
    if (currentIndex >= 0 && currentIndex < episodeList.length - 1) {
      const currentGroup =
        currentGroupIndex >= 0 ? episodeGroups[currentGroupIndex] : undefined;
      replacePlayerEpisode({
        nextEpisodes: episodeList as EpisodeLink[],
        nextIndex: currentIndex + 1,
        nextGroup: currentGroup,
        nextGroupIndex: currentGroupIndex >= 0 ? currentGroupIndex : undefined,
      });
      return;
    }

    if (nextSeasonInfo?.season) {
      let nextSeasonEpisodeList = nextSeasonInfo.episodeList || [];
      if (
        nextSeasonEpisodeList.length === 0 &&
        nextSeasonInfo.season?.episodesLink
      ) {
        nextSeasonEpisodeList = await loadSeasonEpisodes(nextSeasonInfo.season);
      }

      if (nextSeasonEpisodeList.length > 0) {
        replacePlayerEpisode({
          nextEpisodes: nextSeasonEpisodeList as EpisodeLink[],
          nextIndex: 0,
          nextGroup: nextSeasonInfo.season,
          nextGroupIndex: nextSeasonInfo.seasonIndex,
        });
        return;
      }
    }

    ToastAndroid.show(t('No more episodes'), ToastAndroid.SHORT);
  }, [
    activeEpisode?.link,
    currentGroupIndex,
    episodeGroups,
    loadSeasonEpisodes,
    nextSeasonInfo,
    replacePlayerEpisode,
    route.params?.episodeList,
    t,
  ]);

  const handleOpenEpisodeSidebar = useCallback(() => {
    const requestId = ++episodeSidebarLoadRequestRef.current;
    const targetIndex = currentGroupIndex >= 0 ? currentGroupIndex : 0;
    setEpisodesTabGroupIndex(targetIndex);
    setEpisodesTabEpisodeList(currentRouteEpisodeList);
    setEpisodesTabLoading(false);
    setEpisodesTabError(null);
    setShowSettings(false);
    setShowEpisodeSidebar(true);

    if (currentRouteEpisodeList.length === 0 && episodeGroups[targetIndex]) {
      (async () => {
        setEpisodesTabLoading(true);
        const loaded = (await loadSeasonEpisodes(
          episodeGroups[targetIndex],
        )) as EpisodeLink[];
        if (episodeSidebarLoadRequestRef.current !== requestId) {
          return;
        }
        setEpisodesTabEpisodeList(loaded);
        setEpisodesTabLoading(false);
        setEpisodesTabError(
          loaded.length === 0 ? t('No episodes available') : null,
        );
      })();
    }
  }, [
    currentGroupIndex,
    currentRouteEpisodeList,
    episodeGroups,
    loadSeasonEpisodes,
    setShowSettings,
    t,
  ]);

  const handleSelectEpisodeGroup = useCallback(
    async (groupIndex: number) => {
      const requestId = ++episodeSidebarLoadRequestRef.current;
      const group = episodeGroups[groupIndex];
      if (!group) {
        return;
      }

      setEpisodesTabGroupIndex(groupIndex);
      setEpisodesTabError(null);

      if (
        groupIndex === currentGroupIndex &&
        currentRouteEpisodeList.length > 0
      ) {
        setEpisodesTabEpisodeList(currentRouteEpisodeList);
        setEpisodesTabLoading(false);
        return;
      }

      setEpisodesTabLoading(true);
      const loadedEpisodes = (await loadSeasonEpisodes(group)) as EpisodeLink[];
      if (episodeSidebarLoadRequestRef.current !== requestId) {
        return;
      }
      setEpisodesTabEpisodeList(loadedEpisodes);
      setEpisodesTabLoading(false);
      setEpisodesTabError(
        loadedEpisodes.length === 0 ? t('No episodes available') : null,
      );
    },
    [
      currentGroupIndex,
      currentRouteEpisodeList,
      episodeGroups,
      loadSeasonEpisodes,
      t,
    ],
  );

  const handleSelectEpisodeFromTab = useCallback(
    (episode: EpisodeLink, index: number) => {
      const selectedGroup =
        episodesTabGroupIndex >= 0
          ? episodeGroups[episodesTabGroupIndex]
          : undefined;
      const selectedGroupIndex =
        episodesTabGroupIndex >= 0 ? episodesTabGroupIndex : undefined;

      if (
        selectedGroupIndex === currentGroupIndex &&
        episode?.link === activeEpisode?.link
      ) {
        setShowEpisodeSidebar(false);
        return;
      }

      const changed = replacePlayerEpisode({
        nextEpisodes: episodesTabEpisodeList,
        nextIndex: index,
        nextGroup: selectedGroup,
        nextGroupIndex: selectedGroupIndex,
      });

      if (changed) {
        setShowEpisodeSidebar(false);
      }
    },
    [
      activeEpisode?.link,
      currentGroupIndex,
      episodeGroups,
      episodesTabEpisodeList,
      episodesTabGroupIndex,
      replacePlayerEpisode,
    ],
  );

  useEffect(() => {
    if (isPlayerLocked || showSettings) {
      setShowEpisodeSidebar(false);
    }
  }, [isPlayerLocked, showSettings]);

  const handleSkipIntro = useCallback(() => {
    if (!skipIntroInterval) {
      return;
    }
    playerRef?.current?.seek(skipIntroInterval.endTime);
    setShowControls(true);
  }, [skipIntroInterval, setShowControls]);

  const handleSeekSnap = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectTick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
  }, []);

  const nextButtonOpacity = useSharedValue(showControls ? 1 : 0.5);
  useEffect(() => {
    nextButtonOpacity.value = withTiming(showControls ? 1 : 0.5, {
      duration: 200,
    });
  }, [showControls, nextButtonOpacity]);

  const nextButtonStyle = useAnimatedStyle(() => ({
    opacity: nextButtonOpacity.value,
  }));
  const overlayButtonContainerStyle = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: showControls
        ? 'rgba(255,255,255,0.25)'
        : 'rgba(255,255,255,0.2)',
      shadowColor: '#000',
      shadowOpacity: showControls ? 0.2 : 0.35,
      shadowRadius: showControls ? 4 : 6,
      shadowOffset: {width: 0, height: 2},
      elevation: showControls ? 3 : 5,
    }),
    [showControls],
  );
  const overlayBlurIntensity = showControls ? 12 : 6;
  const overlayBackgroundColor = showControls
    ? 'rgba(0,0,0,0.35)'
    : 'rgba(0,0,0,0.65)';
  const overlayTextOpacity = showControls ? 1 : 0.9;

  useEffect(() => {
    if (skipIntroAbortRef.current) {
      skipIntroAbortRef.current.abort();
      skipIntroAbortRef.current = null;
    }

    if (providerValue !== 'animeunity') {
      setSkipIntroInterval(null);
      return;
    }
    if (!skipMalId || !currentEpisodeNumber || episodeDuration <= 0) {
      setSkipIntroInterval(null);
      return;
    }

    const duration = Math.round(episodeDuration);
    const cacheKey = `aniskip:v2:${skipMalId}:${currentEpisodeNumber}:${duration}`;
    const cached = cacheStorage.getString(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const interval = parsed?.interval;
        if (
          interval &&
          Number.isFinite(interval.startTime) &&
          Number.isFinite(interval.endTime) &&
          interval.endTime > interval.startTime
        ) {
          setSkipIntroInterval(interval);
          return;
        }
        if (parsed?.interval === null) {
          setSkipIntroInterval(null);
          return;
        }
      } catch (error) {
        cacheStorage.delete(cacheKey);
      }
    }

    setSkipIntroInterval(null);

    const controller = new AbortController();
    skipIntroAbortRef.current = controller;
    const timeoutId = setTimeout(
      () => controller.abort(),
      SKIP_INTRO_TIMEOUT_MS,
    );

    const fetchSkip = async () => {
      try {
        const url = buildAniSkipUrl(skipMalId, currentEpisodeNumber, duration);
        const response = await fetch(url, {signal: controller.signal});
        if (!response.ok) {
          throw new Error(`AniSkip HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!data?.found || !Array.isArray(data?.results)) {
          cacheStorage.setString(cacheKey, JSON.stringify({interval: null}));
          return;
        }
        const interval = pickIntroInterval(data.results, duration);
        cacheStorage.setString(
          cacheKey,
          JSON.stringify({interval: interval || null}),
        );
        if (interval) {
          setSkipIntroInterval(interval);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.warn('AniSkip request failed', error);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    fetchSkip();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [currentEpisodeNumber, episodeDuration, providerValue, skipMalId]);

  const extractHttpStatus = useCallback((errorEvent: any) => {
    const stackTrace = errorEvent?.error?.errorStackTrace || '';
    const match = /Response code:\s*(\d{3})/i.exec(stackTrace);
    return match ? Number(match[1]) : null;
  }, []);

  const shouldRefetchStream = useCallback(
    (errorEvent: any) => {
      const status = extractHttpStatus(errorEvent);
      if (status === 403 || status === 503) {
        return true;
      }
      const errorString = errorEvent?.error?.errorString || '';
      return /ERROR_CODE_IO_BAD_HTTP_STATUS/i.test(errorString);
    },
    [extractHttpStatus],
  );

  const clearStreamStartupGuard = useCallback(() => {
    if (streamStartupTimeoutRef.current) {
      clearTimeout(streamStartupTimeoutRef.current);
      streamStartupTimeoutRef.current = null;
    }
  }, []);

  const handleStartupTimeoutFallback = useCallback(() => {
    if (streamStartupHandlingRef.current) {
      return;
    }
    streamStartupHandlingRef.current = true;

    try {
      const switched = switchToNextStream();
      if (!switched) {
        ToastAndroid.show(
          t('Video could not be played, try again later'),
          ToastAndroid.SHORT,
        );
        navigation.goBack();
      }
      setShowControls(true);
    } finally {
      streamStartupHandlingRef.current = false;
    }
  }, [navigation, setShowControls, switchToNextStream, t]);

  const armStreamStartupGuard = useCallback(
    (reason: string) => {
      if (isPreparingPlayer || !selectedStream?.link) {
        clearStreamStartupGuard();
        return;
      }

      const guardKey = `${activeEpisode?.link || ''}|${
        selectedStream.link
      }|${videoReloadNonce}`;
      streamStartupGuardKeyRef.current = guardKey;
      streamStartupProgressSeenRef.current = false;
      clearStreamStartupGuard();

      streamStartupTimeoutRef.current = setTimeout(() => {
        if (streamStartupGuardKeyRef.current !== guardKey) {
          return;
        }
        if (streamStartupProgressSeenRef.current) {
          return;
        }

        console.warn('[player] stream startup timeout', {
          reason,
          server: selectedStream?.server,
          episode: activeEpisode?.link,
        });
        handleStartupTimeoutFallback();
      }, STREAM_START_TIMEOUT_MS);
    },
    [
      activeEpisode?.link,
      clearStreamStartupGuard,
      handleStartupTimeoutFallback,
      isPreparingPlayer,
      selectedStream?.link,
      selectedStream?.server,
      videoReloadNonce,
    ],
  );

  const markStreamStartupProgress = useCallback(
    (progress: {currentTime?: number}) => {
      const currentTime = Number(progress?.currentTime || 0);
      if (!Number.isFinite(currentTime) || currentTime < 0.5) {
        return;
      }
      streamStartupProgressSeenRef.current = true;
      clearStreamStartupGuard();
    },
    [clearStreamStartupGuard],
  );

  useEffect(() => {
    if (isPreparingPlayer || !selectedStream?.link) {
      clearStreamStartupGuard();
      return;
    }

    armStreamStartupGuard('stream-change');
    return () => {
      clearStreamStartupGuard();
    };
  }, [
    activeEpisode?.link,
    armStreamStartupGuard,
    clearStreamStartupGuard,
    isPreparingPlayer,
    selectedStream,
    videoReloadNonce,
  ]);

  // Memoized error handler
  const handleVideoError = useCallback(
    async (e: any) => {
      console.log('PlayerError', e);
      clearStreamStartupGuard();
      if (shouldRefetchStream(e) && activeEpisode?.link) {
        const now = Date.now();
        const retryKey = `${activeEpisode.link}|${selectedStream?.server || ''}`;
        const retryState = streamRetryRef.current;
        const sameKey = retryState.retryKey === retryKey;
        const retryCount = sameKey ? retryState.count : 0;
        const lastAttempt = sameKey ? retryState.lastAttempt : 0;

        if (retryCount < 1 && now - lastAttempt > STREAM_RETRY_COOLDOWN_MS) {
          streamRetryRef.current = {
            retryKey,
            count: retryCount + 1,
            lastAttempt: now,
          };
          ToastAndroid.show(
            t('Stream error, retrying token'),
            ToastAndroid.SHORT,
          );
          const result = await refetch();
          const refreshed = result.data || [];
          if (refreshed.length > 0) {
            const sameServer = refreshed.find(
              stream => stream.server === selectedStream?.server,
            );
            setSelectedStream(sameServer || refreshed[0]);
            setShowControls(true);
            return;
          }
        }
      }
      if (!switchToNextStream()) {
        ToastAndroid.show(
          t('Video could not be played, try again later'),
          ToastAndroid.SHORT,
        );
        navigation.goBack();
      }
      setShowControls(true);
    },
    [
      activeEpisode?.link,
      clearStreamStartupGuard,
      navigation,
      refetch,
      selectedStream?.server,
      setSelectedStream,
      setShowControls,
      shouldRefetchStream,
      switchToNextStream,
      t,
    ],
  );

  const triggerSubtitleReload = useCallback(
    (reason: string) => {
      if (subtitleReloadedRef.current) {
        return;
      }
      subtitleReloadedRef.current = true;
      const position = videoPositionRef.current?.position ?? 0;
      subtitleReloadSeekRef.current = Number.isFinite(position) ? position : 0;
      console.log('[subs][player] forcing reload for late subtitles', {
        reason,
        position: subtitleReloadSeekRef.current,
      });
      setVideoReloadNonce(value => value + 1);
    },
    [videoPositionRef],
  );

  const triggerSubtitleSelectionReload = useCallback(
    (reason: string) => {
      const position = videoPositionRef.current?.position ?? 0;
      subtitleReloadSeekRef.current = Number.isFinite(position) ? position : 0;
      console.log('[subs][player] forcing reload after subtitle selection', {
        reason,
        position: subtitleReloadSeekRef.current,
      });
      setVideoReloadNonce(value => value + 1);
    },
    [videoPositionRef],
  );

  const getCastSubtitleTracks = useCallback(() => {
    const selectedTrack = mergedTextTracks.find(
      track => track.index === selectedTextTrackIndex,
    );
    if (selectedTrack?.uri && /^https?:\/\//i.test(selectedTrack.uri)) {
      return [{uri: selectedTrack.uri, title: selectedTrack.title}];
    }

    if (!Array.isArray(selectedStream?.subtitles)) {
      return [];
    }

    return selectedStream.subtitles
      .map(track => ({
        uri: track?.uri,
        title: track?.title,
      }))
      .filter(track => !!track.uri && /^https?:\/\//i.test(track.uri));
  }, [mergedTextTracks, selectedStream?.subtitles, selectedTextTrackIndex]);

  const askWvcFallback = useCallback((): Promise<boolean> => {
    return new Promise(resolve => {
      let isResolved = false;
      const safeResolve = (value: boolean) => {
        if (isResolved) {
          return;
        }
        isResolved = true;
        resolve(value);
      };

      Alert.alert(
        t('Native cast not ready'),
        t('Native cast could not start. Open Web Video Caster instead?'),
        [
          {
            text: t('Cancel'),
            style: 'cancel',
            onPress: () => safeResolve(false),
          },
          {
            text: t('Open Web Video Caster'),
            onPress: () => safeResolve(true),
          },
        ],
        {
          cancelable: true,
          onDismiss: () => safeResolve(false),
        },
      );
    });
  }, [t]);

  const handleWebVideoCasterCast = useCallback(async () => {
    if (!selectedStream?.link) {
      ToastAndroid.show(t('No stream available for cast'), ToastAndroid.SHORT);
      return;
    }

    try {
      const result = await openInWebVideoCaster({
        videoUrl: selectedStream.link,
        headers:
          selectedStream.headers && typeof selectedStream.headers === 'object'
            ? selectedStream.headers
            : undefined,
        subtitles: getCastSubtitleTracks(),
        title: resolvedPrimaryTitle,
        subtitle: activeEpisode?.title || route.params?.secondaryTitle || '',
        poster:
          route.params?.poster?.poster ||
          route.params?.poster?.background ||
          '',
        secureUri: true,
      });

      if (result === 'store_opened') {
        ToastAndroid.show(
          t('Install Web Video Caster to cast'),
          ToastAndroid.SHORT,
        );
        return;
      }

      if (result === 'failed') {
        ToastAndroid.show(
          t('Failed to open Web Video Caster'),
          ToastAndroid.SHORT,
        );
        return;
      }

      ToastAndroid.show(
        t('Casting started in Web Video Caster'),
        ToastAndroid.SHORT,
      );
    } catch (error) {
      console.error('Error opening Web Video Caster:', error);
      ToastAndroid.show(
        t('Failed to open Web Video Caster'),
        ToastAndroid.SHORT,
      );
    }
  }, [
    activeEpisode?.title,
    getCastSubtitleTracks,
    route.params?.poster?.background,
    route.params?.poster?.poster,
    route.params?.secondaryTitle,
    resolvedPrimaryTitle,
    selectedStream?.headers,
    selectedStream?.link,
    t,
  ]);

  const handleVegaCast = useCallback(async () => {
    if (!selectedStream?.link) {
      ToastAndroid.show(t('No stream available for cast'), ToastAndroid.SHORT);
      return;
    }

    try {
      const selectedSubtitleUri = resolveCastSubtitleUri(
        getCastSubtitleTracks(),
        0,
      );
      const startTime = Math.max(
        0,
        videoPositionRef.current?.position || watchedDuration || 0,
      );

      const {receiverUrl, sessionCode, launchMode, expiresAt, tracking} =
        await prepareVegaCastLaunchData({
          currentEpisodeLink: activeEpisode?.link || selectedStream.link,
          episodeList: route.params?.episodeList || [],
          selectedStream,
          providerValue: route.params?.providerValue || providerValue,
          contentType: route.params?.type || 'series',
          context: {
            primaryTitle: resolvedPrimaryTitle,
            secondaryTitle: route.params?.secondaryTitle || '',
            posterUrl:
              route.params?.poster?.poster ||
              route.params?.poster?.background ||
              '',
            infoUrl: route.params?.infoUrl || '',
            seasonNumber: route.params?.seasonNumber,
            aniSkipMalId: skipMalId,
            playbackRate,
            startTime,
            preferredSubtitleUri: selectedSubtitleUri,
          },
        });
      if (launchMode === 'pairing' && tracking) {
        lastVegaProgressSyncRef.current = 0;
        lastCastProgressWriteRef.current = 0;
        setVegaTracking(tracking);
        saveActiveVegaCastTracking(tracking, route.params?.infoUrl || '');
      } else {
        setVegaTracking(null);
        clearActiveVegaCastTracking();
      }
      const expiryMinutes =
        typeof expiresAt === 'number'
          ? Math.max(1, Math.round((expiresAt - Date.now()) / 60000))
          : 10;

      Alert.alert(
        t('Vega Cast Ready'),
        launchMode === 'pairing'
          ? t(
              'Open Vega Cast Receiver on TV and enter code {{code}}. Code valid for about {{minutes}} minutes.',
              {code: sessionCode, minutes: expiryMinutes},
            )
          : t(
              'Open Vega Cast Receiver on TV, then use this link. Session code: {{code}}',
              {code: sessionCode},
            ),
        [
          {
            text: t('Cancel'),
            style: 'cancel',
          },
          {
            text: launchMode === 'pairing' ? t('Copy Code') : t('Copy Link'),
            onPress: () => {
              setClipboardString(
                launchMode === 'pairing' ? sessionCode : receiverUrl,
              );
              ToastAndroid.show(
                launchMode === 'pairing'
                  ? t('Vega Cast code copied')
                  : t('Vega Cast link copied'),
                ToastAndroid.SHORT,
              );
            },
          },
          {
            text: t('Open Receiver'),
            onPress: async () => {
              const opened = await openVegaCastReceiverUrl(receiverUrl);
              if (!opened) {
                ToastAndroid.show(
                  t('Failed to open Vega Cast receiver'),
                  ToastAndroid.SHORT,
                );
                return;
              }
              ToastAndroid.show(
                t('Vega Cast receiver opened'),
                ToastAndroid.SHORT,
              );
            },
          },
        ],
      );
    } catch (error) {
      console.error('Vega Cast session preparation failed:', error);
      const message =
        error instanceof Error &&
        error.message === 'VEGA_CAST_SESSION_TOO_LARGE'
          ? t('Vega Cast session too large')
          : t('Failed to prepare Vega Cast');
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  }, [
    activeEpisode?.link,
    getCastSubtitleTracks,
    playbackRate,
    providerValue,
    route.params?.episodeList,
    route.params?.infoUrl,
    route.params?.poster?.background,
    route.params?.poster?.poster,
    route.params?.providerValue,
    route.params?.seasonNumber,
    route.params?.secondaryTitle,
    route.params?.type,
    resolvedPrimaryTitle,
    skipMalId,
    selectedStream,
    t,
    videoPositionRef,
    watchedDuration,
  ]);

  const storeRemoteCastProgress = useCallback(
    (currentTime: number, duration: number) => {
      const episodeLink =
        currentCastEpisodeRef.current.link || activeEpisode?.link;
      if (!episodeLink) {
        return;
      }
      if (
        !Number.isFinite(currentTime) ||
        !Number.isFinite(duration) ||
        duration <= 0
      ) {
        return;
      }
      if (Math.abs(currentTime - lastCastProgressWriteRef.current) < 2) {
        return;
      }
      lastCastProgressWriteRef.current = currentTime;

      const historyKey = route.params?.infoUrl || episodeLink;
      const episodeTitle =
        currentCastEpisodeRef.current.title ||
        activeEpisode?.title ||
        route.params?.secondaryTitle ||
        '';
      const episodeNumber =
        currentCastEpisodeRef.current.episodeNumber ??
        route.params?.episodeNumber;
      const seasonNumber =
        currentCastEpisodeRef.current.seasonNumber ??
        route.params?.seasonNumber;

      const hasHistoryEntry = watchHistoryStorage
        .getWatchHistory()
        .some(item => item.link === historyKey);
      if (!hasHistoryEntry) {
        addItem({
          id: historyKey,
          link: historyKey,
          title: resolvedPrimaryTitle,
          poster:
            route.params?.poster?.poster || route.params?.poster?.background,
          provider: route.params?.providerValue || providerValue,
          lastPlayed: Date.now(),
          currentTime,
          duration,
          playbackRate,
          episodeTitle,
          episodeNumber,
          seasonNumber,
        });
      }

      updatePlaybackInfo(historyKey, {
        currentTime,
        duration,
        playbackRate,
      });
      cacheStorage.setString(
        episodeLink,
        JSON.stringify({
          position: currentTime,
          duration,
        }),
      );

      const progressData = {
        currentTime,
        duration,
        percentage: (currentTime / duration) * 100,
        infoUrl: route.params?.infoUrl || '',
        title: resolvedPrimaryTitle,
        episodeTitle,
        episodeNumber,
        episodeLink,
        seasonTitle: route.params?.secondaryTitle || '',
        seasonNumber,
        seasonEpisodesLink: route.params?.seasonEpisodesLink || '',
        updatedAt: Date.now(),
      };
      const historyProgressKey = `watch_history_progress_${historyKey}`;
      mainStorage.setString(historyProgressKey, JSON.stringify(progressData));
      watchHistoryStorage.addProgressKey(historyProgressKey);
      if (episodeTitle) {
        const episodeKey = `watch_history_progress_${historyKey}_${episodeTitle.replace(
          /\s+/g,
          '_',
        )}`;
        mainStorage.setString(episodeKey, JSON.stringify(progressData));
        watchHistoryStorage.addProgressKey(episodeKey);
      }
      watchHistoryStorage.addEpisodeKey(historyKey, episodeLink);
    },
    [
      addItem,
      activeEpisode?.link,
      activeEpisode?.title,
      playbackRate,
      providerValue,
      route.params?.episodeNumber,
      route.params?.infoUrl,
      route.params?.poster?.background,
      route.params?.poster?.poster,
      route.params?.seasonEpisodesLink,
      route.params?.seasonNumber,
      route.params?.secondaryTitle,
      resolvedPrimaryTitle,
      updatePlaybackInfo,
    ],
  );

  const syncVegaEpisodeLedgerProgress = useCallback(
    (episodes: VegaCastEpisodeProgressSnapshot[]) => {
      if (!Array.isArray(episodes) || episodes.length === 0) {
        return;
      }

      const historyKey =
        String(route.params?.infoUrl || '').trim() ||
        String(activeEpisode?.link || '').trim();
      if (!historyKey) {
        return;
      }

      let latestEntry:
        | (VegaCastEpisodeProgressSnapshot & {
            currentTime: number;
            duration: number;
          })
        | null = null;
      let latestUpdatedAt = 0;

      for (const entry of episodes) {
        const episodeLink = String(entry.episodeLink || '').trim();
        const duration = Number(entry.duration);
        if (!episodeLink || !Number.isFinite(duration) || duration <= 0) {
          continue;
        }

        const rawCurrentTime = Number(entry.currentTime);
        const normalizedCurrentTime = Number.isFinite(rawCurrentTime)
          ? Math.max(0, rawCurrentTime)
          : 0;
        const currentTime = entry.completed
          ? duration
          : Math.min(duration, normalizedCurrentTime);

        cacheStorage.setString(
          episodeLink,
          JSON.stringify({
            position: currentTime,
            duration,
          }),
        );
        watchHistoryStorage.addEpisodeKey(historyKey, episodeLink);

        const progressData = {
          currentTime,
          duration,
          percentage: (currentTime / duration) * 100,
          infoUrl: route.params?.infoUrl || '',
          title: resolvedPrimaryTitle,
          episodeTitle: String(entry.episodeTitle || ''),
          episodeNumber:
            typeof entry.episodeNumber === 'number'
              ? entry.episodeNumber
              : undefined,
          episodeLink,
          seasonTitle: route.params?.secondaryTitle || '',
          seasonNumber:
            typeof entry.seasonNumber === 'number'
              ? entry.seasonNumber
              : route.params?.seasonNumber,
          seasonEpisodesLink: route.params?.seasonEpisodesLink || '',
          updatedAt: Date.now(),
        };

        if (progressData.episodeTitle) {
          const episodeKey = `watch_history_progress_${historyKey}_${progressData.episodeTitle.replace(
            /\s+/g,
            '_',
          )}`;
          mainStorage.setString(episodeKey, JSON.stringify(progressData));
          watchHistoryStorage.addProgressKey(episodeKey);
        }

        const updatedAt = Number(entry.updatedAt || 0);
        const comparableUpdatedAt =
          Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now();
        if (comparableUpdatedAt >= latestUpdatedAt) {
          latestUpdatedAt = comparableUpdatedAt;
          latestEntry = {
            ...entry,
            currentTime,
            duration,
          };
        }
      }

      if (!latestEntry) {
        return;
      }

      const hasHistoryEntry = watchHistoryStorage
        .getWatchHistory()
        .some(item => item.link === historyKey);
      if (!hasHistoryEntry) {
        addItem({
          id: historyKey,
          link: historyKey,
          title: resolvedPrimaryTitle,
          poster:
            route.params?.poster?.poster || route.params?.poster?.background,
          provider: route.params?.providerValue || providerValue,
          lastPlayed: Date.now(),
          currentTime: latestEntry.currentTime,
          duration: latestEntry.duration,
          playbackRate,
          episodeTitle: String(latestEntry.episodeTitle || ''),
          episodeNumber:
            typeof latestEntry.episodeNumber === 'number'
              ? latestEntry.episodeNumber
              : route.params?.episodeNumber,
          seasonNumber:
            typeof latestEntry.seasonNumber === 'number'
              ? latestEntry.seasonNumber
              : route.params?.seasonNumber,
        });
      }

      updatePlaybackInfo(historyKey, {
        currentTime: latestEntry.currentTime,
        duration: latestEntry.duration,
        playbackRate,
      });

      const historyProgressKey = `watch_history_progress_${historyKey}`;
      mainStorage.setString(
        historyProgressKey,
        JSON.stringify({
          currentTime: latestEntry.currentTime,
          duration: latestEntry.duration,
          percentage: (latestEntry.currentTime / latestEntry.duration) * 100,
          infoUrl: route.params?.infoUrl || '',
          title: resolvedPrimaryTitle,
          episodeTitle: String(latestEntry.episodeTitle || ''),
          episodeNumber:
            typeof latestEntry.episodeNumber === 'number'
              ? latestEntry.episodeNumber
              : route.params?.episodeNumber,
          episodeLink: latestEntry.episodeLink,
          seasonTitle: route.params?.secondaryTitle || '',
          seasonNumber:
            typeof latestEntry.seasonNumber === 'number'
              ? latestEntry.seasonNumber
              : route.params?.seasonNumber,
          seasonEpisodesLink: route.params?.seasonEpisodesLink || '',
          updatedAt: Date.now(),
        }),
      );
      watchHistoryStorage.addProgressKey(historyProgressKey);
    },
    [
      activeEpisode?.link,
      addItem,
      playbackRate,
      providerValue,
      route.params?.episodeNumber,
      route.params?.seasonEpisodesLink,
      route.params?.infoUrl,
      route.params?.poster?.background,
      route.params?.poster?.poster,
      route.params?.providerValue,
      route.params?.secondaryTitle,
      route.params?.seasonNumber,
      resolvedPrimaryTitle,
      updatePlaybackInfo,
    ],
  );

  const startNativeCast = useCallback(async () => {
    if (!remoteMediaClient || !selectedStream?.link || isStartingNativeCast) {
      return false;
    }

    setIsStartingNativeCast(true);
    try {
      const selectedSubtitleUri = resolveCastSubtitleUri(
        getCastSubtitleTracks(),
        0,
      );
      const startTime = Math.max(
        0,
        videoPositionRef.current?.position || watchedDuration || 0,
      );

      const {request, itemCount} = await prepareNativeCastQueue({
        currentEpisodeLink: activeEpisode?.link || selectedStream.link,
        episodeList: route.params?.episodeList || [],
        selectedStream,
        providerValue: route.params?.providerValue || providerValue,
        contentType: route.params?.type || 'series',
        context: {
          primaryTitle: resolvedPrimaryTitle,
          secondaryTitle: route.params?.secondaryTitle || '',
          posterUrl:
            route.params?.poster?.poster ||
            route.params?.poster?.background ||
            '',
          infoUrl: route.params?.infoUrl || '',
          seasonNumber: route.params?.seasonNumber,
          playbackRate,
          startTime,
          preferredSubtitleUri: selectedSubtitleUri,
        },
      });

      await remoteMediaClient.loadMedia(request);
      playerRef?.current?.pause();
      setPendingNativeCast(false);
      currentCastEpisodeRef.current = {
        link: activeEpisode?.link,
        title: activeEpisode?.title,
        episodeNumber: activeEpisode?.episodeNumber,
        seasonNumber: activeEpisode?.seasonNumber ?? route.params?.seasonNumber,
      };
      ToastAndroid.show(
        t('Native cast started with {{count}} episodes', {count: itemCount}),
        ToastAndroid.SHORT,
      );

      try {
        await GoogleCast.showExpandedControls();
      } catch (error) {
        console.warn('Failed to open cast expanded controls:', error);
      }
      return true;
    } catch (error) {
      console.error('Native cast start failed:', error);
      ToastAndroid.show(t('Failed to start native cast'), ToastAndroid.SHORT);
      return false;
    } finally {
      setIsStartingNativeCast(false);
    }
  }, [
    activeEpisode?.episodeNumber,
    activeEpisode?.link,
    activeEpisode?.seasonNumber,
    activeEpisode?.title,
    getCastSubtitleTracks,
    isStartingNativeCast,
    playbackRate,
    providerValue,
    remoteMediaClient,
    route.params?.episodeList,
    route.params?.infoUrl,
    route.params?.poster?.background,
    route.params?.poster?.poster,
    route.params?.providerValue,
    route.params?.seasonNumber,
    route.params?.secondaryTitle,
    route.params?.type,
    resolvedPrimaryTitle,
    selectedStream,
    t,
    videoPositionRef,
    watchedDuration,
  ]);

  const handleNativeCast = useCallback(async () => {
    if (!selectedStream?.link) {
      ToastAndroid.show(t('No stream available for cast'), ToastAndroid.SHORT);
      return;
    }

    if (hasStreamRequestHeaders(selectedStream)) {
      Alert.alert(
        t('Protected stream'),
        t(
          "Native Cast cannot forward this server's request headers. Open Web Video Caster instead?",
        ),
        [
          {text: t('Cancel'), style: 'cancel'},
          {
            text: t('Open Web Video Caster'),
            onPress: handleWebVideoCasterCast,
          },
        ],
      );
      return;
    }

    if (remoteMediaClient) {
      const started = await startNativeCast();
      if (!started) {
        const fallback = await askWvcFallback();
        if (fallback) {
          await handleWebVideoCasterCast();
        }
      }
      return;
    }

    setPendingNativeCast(true);
    try {
      const shown = await GoogleCast.showCastDialog();
      if (!shown) {
        setPendingNativeCast(false);
        const fallback = await askWvcFallback();
        if (fallback) {
          await handleWebVideoCasterCast();
        }
      }
    } catch (error) {
      console.error('Failed to show cast dialog:', error);
      setPendingNativeCast(false);
      const fallback = await askWvcFallback();
      if (fallback) {
        await handleWebVideoCasterCast();
      }
    }
  }, [
    askWvcFallback,
    handleWebVideoCasterCast,
    remoteMediaClient,
    selectedStream,
    startNativeCast,
    t,
  ]);

  const handleCastPress = useCallback(async () => {
    if (castProvider === 'vega') {
      await handleVegaCast();
      return;
    }
    if (castProvider === 'wvc') {
      await handleWebVideoCasterCast();
      return;
    }
    await handleNativeCast();
  }, [
    castProvider,
    handleNativeCast,
    handleVegaCast,
    handleWebVideoCasterCast,
  ]);

  useEffect(() => {
    if (!pendingNativeCast || !remoteMediaClient || castProvider !== 'native') {
      return;
    }
    startNativeCast().then(async started => {
      if (!started) {
        const fallback = await askWvcFallback();
        if (fallback) {
          await handleWebVideoCasterCast();
        }
      }
    });
  }, [
    askWvcFallback,
    castProvider,
    handleWebVideoCasterCast,
    pendingNativeCast,
    remoteMediaClient,
    startNativeCast,
  ]);

  useEffect(() => {
    if (!pendingNativeCast) {
      return;
    }
    const timeout = setTimeout(() => {
      setPendingNativeCast(false);
    }, 30000);
    return () => clearTimeout(timeout);
  }, [pendingNativeCast]);

  useEffect(() => {
    if (!remoteMediaClient) {
      return;
    }

    const statusSubscription = remoteMediaClient.onMediaStatusUpdated(
      status => {
        const customData = (status?.mediaInfo?.customData || {}) as {
          episodeLink?: string;
          episodeTitle?: string;
          episodeNumber?: number;
          seasonNumber?: number;
        };
        const castEpisodeLink =
          typeof customData.episodeLink === 'string'
            ? customData.episodeLink
            : undefined;
        if (castEpisodeLink) {
          currentCastEpisodeRef.current = {
            link: castEpisodeLink,
            title:
              typeof customData.episodeTitle === 'string'
                ? customData.episodeTitle
                : activeEpisode?.title,
            episodeNumber:
              typeof customData.episodeNumber === 'number'
                ? customData.episodeNumber
                : activeEpisode?.episodeNumber,
            seasonNumber:
              typeof customData.seasonNumber === 'number'
                ? customData.seasonNumber
                : route.params?.seasonNumber,
          };

          if (castEpisodeLink !== activeEpisode?.link) {
            const matchingEpisode = route.params?.episodeList?.find(
              item => item?.link === castEpisodeLink,
            );
            if (matchingEpisode) {
              setActiveEpisode(matchingEpisode);
            }
          }
        }
      },
    );

    const progressSubscription = remoteMediaClient.onMediaProgressUpdated(
      (progress, duration) => {
        storeRemoteCastProgress(progress, duration);
      },
      2,
    );

    return () => {
      statusSubscription.remove();
      progressSubscription.remove();
    };
  }, [
    activeEpisode?.episodeNumber,
    activeEpisode?.link,
    activeEpisode?.title,
    remoteMediaClient,
    route.params?.episodeList,
    route.params?.seasonNumber,
    storeRemoteCastProgress,
  ]);

  useEffect(() => {
    if (castProvider !== 'vega') {
      setVegaTracking(null);
      clearActiveVegaCastTracking();
      return;
    }
    if (!isFocused || !isAppActive) {
      return;
    }

    const expectedInfoUrl = String(route.params?.infoUrl || '').trim();
    const resolvedTracking =
      vegaTracking || getActiveVegaCastTracking(expectedInfoUrl);
    if (!vegaTracking && resolvedTracking) {
      setVegaTracking(resolvedTracking);
    }

    if (
      !resolvedTracking?.apiBaseUrl ||
      !resolvedTracking?.sessionId ||
      !resolvedTracking?.progressToken
    ) {
      return;
    }

    let cancelled = false;

    const syncProgress = async () => {
      try {
        const progress = await fetchVegaCastProgress(resolvedTracking);
        if (cancelled || !progress) {
          return;
        }
        const progressInfoUrl = String(progress.infoUrl || '').trim();
        if (
          expectedInfoUrl &&
          progressInfoUrl &&
          progressInfoUrl !== expectedInfoUrl
        ) {
          return;
        }

        const updatedAt = Number(progress.updatedAt || 0);
        if (
          Number.isFinite(updatedAt) &&
          updatedAt > 0 &&
          updatedAt <= lastVegaProgressSyncRef.current
        ) {
          return;
        }
        lastVegaProgressSyncRef.current =
          Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now();

        const episodeLedger = normalizeVegaCastEpisodeProgress(progress);
        if (episodeLedger.length > 0) {
          syncVegaEpisodeLedgerProgress(episodeLedger);
        }

        const castEpisodeLink =
          typeof progress.episodeLink === 'string' && progress.episodeLink
            ? progress.episodeLink
            : undefined;

        if (castEpisodeLink) {
          currentCastEpisodeRef.current = {
            link: castEpisodeLink,
            title:
              typeof progress.episodeTitle === 'string'
                ? progress.episodeTitle
                : activeEpisode?.title,
            episodeNumber:
              typeof progress.episodeNumber === 'number'
                ? progress.episodeNumber
                : activeEpisode?.episodeNumber,
            seasonNumber:
              typeof progress.seasonNumber === 'number'
                ? progress.seasonNumber
                : route.params?.seasonNumber,
          };

          if (castEpisodeLink !== activeEpisode?.link) {
            const matchingEpisode = route.params?.episodeList?.find(
              item => item?.link === castEpisodeLink,
            );
            if (matchingEpisode) {
              setActiveEpisode(matchingEpisode);
            }
          }
        }

        const currentTime = Number(progress.currentTime);
        const duration = Number(progress.duration);
        if (
          Number.isFinite(currentTime) &&
          Number.isFinite(duration) &&
          duration > 0
        ) {
          storeRemoteCastProgress(currentTime, duration);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Vega cast progress sync failed:', error);
        }
      }
    };

    syncProgress();
    const interval = setInterval(syncProgress, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    activeEpisode?.episodeNumber,
    activeEpisode?.link,
    activeEpisode?.title,
    castProvider,
    isAppActive,
    isFocused,
    route.params?.episodeList,
    route.params?.infoUrl,
    route.params?.seasonNumber,
    syncVegaEpisodeLedgerProgress,
    storeRemoteCastProgress,
    vegaTracking,
  ]);

  useFocusEffect(
    useCallback(() => {
      const providerFromSettings = settingsStorage.getCastProvider();
      setCastProvider(providerFromSettings);
      if (providerFromSettings === 'vega') {
        const persistedTracking = getActiveVegaCastTracking(
          String(route.params?.infoUrl || '').trim(),
        );
        if (persistedTracking) {
          setVegaTracking(persistedTracking);
        }
      }
      return () => {};
    }, [route.params?.infoUrl]),
  );

  // Exit fullscreen on back
  const clearImmersiveReapplyTimer = useCallback(() => {
    if (immersiveReapplyTimerRef.current) {
      clearTimeout(immersiveReapplyTimerRef.current);
      immersiveReapplyTimerRef.current = null;
    }
  }, []);

  const reapplyImmersiveIfNeeded = useCallback(() => {
    if (Platform.OS !== 'android' || !isFullScreen) {
      return;
    }

    clearImmersiveReapplyTimer();
    goFullScreen();
    immersiveReapplyTimerRef.current = setTimeout(() => {
      goFullScreen();
      immersiveReapplyTimerRef.current = null;
    }, 120);
  }, [clearImmersiveReapplyTimer, isFullScreen]);

  useFocusEffect(
    useCallback(() => {
      // This code now runs every time the screen is focused
      if (isFullScreen) {
        reapplyImmersiveIfNeeded();
      } else {
        exitFullScreen();
      }

      return () => {
        clearImmersiveReapplyTimer();
        // Ensure the system UI is restored when leaving the player
        exitFullScreen();
      };
    }, [clearImmersiveReapplyTimer, isFullScreen, reapplyImmersiveIfNeeded]),
  );

  useEffect(() => {
    subtitleReloadedRef.current = false;
    subtitleGateTimeoutFiredRef.current = false;
    if (subtitleGateTimeoutRef.current) {
      clearTimeout(subtitleGateTimeoutRef.current);
      subtitleGateTimeoutRef.current = null;
    }

    if (!hasExpectedExternalSubs) {
      setSubtitleGatePassed(true);
      return;
    }

    setSubtitleGatePassed(false);
    subtitleGateTimeoutRef.current = setTimeout(() => {
      subtitleGateTimeoutFiredRef.current = true;
      setSubtitleGatePassed(true);
    }, SUBTITLE_GATE_TIMEOUT_MS);

    return () => {
      if (subtitleGateTimeoutRef.current) {
        clearTimeout(subtitleGateTimeoutRef.current);
        subtitleGateTimeoutRef.current = null;
      }
    };
  }, [activeEpisode?.link, hasExpectedExternalSubs, selectedStream?.link]);

  useEffect(() => {
    setEpisodeDuration(0);
    setSkipIntroInterval(null);
  }, [activeEpisode?.link]);

  useEffect(() => {
    if (!hasExpectedExternalSubs || !externalSubs) {
      return;
    }

    if (externalSubs.length === 0) {
      return;
    }

    if (subtitleGateTimeoutRef.current) {
      clearTimeout(subtitleGateTimeoutRef.current);
      subtitleGateTimeoutRef.current = null;
    }

    setSubtitleGatePassed(true);

    if (subtitleGateTimeoutFiredRef.current) {
      triggerSubtitleReload('late-subs');
    }
  }, [externalSubs, hasExpectedExternalSubs, triggerSubtitleReload]);

  useEffect(() => {
    loadedDurationRef.current = 0;
  }, [activeEpisode?.link]);

  // Reset track selections when stream changes
  useEffect(() => {
    setSelectedAudioTrackIndex(0);
    setSelectedTextTrackIndex(1000);
    setSelectedQualityIndex(1000);
    resetVideoTracks();
  }, [
    selectedStream,
    resetVideoTracks,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
    setSelectedQualityIndex,
  ]);

  // Initialize search query
  useEffect(() => {
    setSearchQuery(resolvedPrimaryTitle);
  }, [resolvedPrimaryTitle]);

  useEffect(() => {
    if (!externalSubs) {
      console.log('[subs][player] externalSubs is null/undefined');
      return;
    }
    console.log('[subs][player] externalSubs updated', {
      count: externalSubs.length,
      tracks: externalSubs.map((track: any) => ({
        title: track?.title,
        language: track?.language,
        type: track?.type,
        uri: track?.uri,
        hasHeaders: !!track?.headers,
      })),
    });
  }, [externalSubs]);

  useEffect(() => {
    const selectedTrack = mergedTextTracks.find(
      track => track.index === selectedTextTrackIndex,
    );
    console.log('[subs][player] selected text track changed', {
      selectedTextTrackIndex,
      selectedTextTrack,
      selectedTrack: selectedTrack
        ? {
            index: selectedTrack.index,
            source: selectedTrack.source,
            language: selectedTrack.language,
            title: selectedTrack.title,
            type: selectedTrack.type,
            uri: selectedTrack.uri,
          }
        : null,
    });
  }, [mergedTextTracks, selectedTextTrack, selectedTextTrackIndex]);

  // Add to watch history
  useEffect(() => {
    if (resolvedPrimaryTitle && !route.params?.doNotTrack) {
      const routeEpisode =
        route.params?.episodeList?.[route.params?.linkIndex] || undefined;
      const episodeTitle =
        activeEpisode?.title ||
        routeEpisode?.title ||
        route.params?.secondaryTitle;
      const parsedEpisodeNumber = Number(
        activeEpisode?.episodeNumber ??
          routeEpisode?.episodeNumber ??
          route.params?.episodeNumber,
      );
      const episodeNumber = Number.isFinite(parsedEpisodeNumber)
        ? parsedEpisodeNumber
        : undefined;
      const parsedSeasonNumber = Number(
        activeEpisode?.seasonNumber ??
          routeEpisode?.seasonNumber ??
          route.params?.seasonNumber,
      );
      const seasonNumber = Number.isFinite(parsedSeasonNumber)
        ? parsedSeasonNumber
        : undefined;
      addItem({
        id: route.params.infoUrl || activeEpisode.link,
        title: resolvedPrimaryTitle,
        poster:
          route.params.poster?.poster || route.params.poster?.background || '',
        link: route.params.infoUrl || '',
        provider: route.params?.providerValue || provider.value,
        lastPlayed: Date.now(),
        duration: 0,
        currentTime: 0,
        playbackRate: 1,
        episodeTitle,
        episodeNumber,
        seasonNumber,
      });

      updateItemWithInfo(
        route.params.episodeList[route.params.linkIndex].link,
        {
          ...route.params,
          cachedAt: Date.now(),
        },
      );
    }
  }, [
    resolvedPrimaryTitle,
    activeEpisode.link,
    addItem,
    updateItemWithInfo,
    route.params,
    provider.value,
  ]);

  // Set last selected audio and subtitle tracks
  useEffect(() => {
    if (hasSetInitialTracksRef.current) {
      return;
    }

    const lastAudioTrack = cacheStorage.getString('lastAudioTrack') || 'auto';
    const lastTextTrack = cacheStorage.getString('lastTextTrack') || 'auto';

    const audioTrackIndex = audioTracks.findIndex(
      track => track.language === lastAudioTrack,
    );
    const textTrackIndex = textTracks.findIndex(
      track => track.language === lastTextTrack,
    );

    if (audioTrackIndex !== -1) {
      setSelectedAudioTrack({
        type: SelectedTrackType.INDEX,
        value: audioTrackIndex,
      });
      setSelectedAudioTrackIndex(audioTrackIndex);
    }

    if (textTrackIndex !== -1) {
      setSelectedTextTrack({
        type: SelectedTrackType.INDEX,
        value: textTrackIndex,
      });
      setSelectedTextTrackIndex(textTrackIndex);
    }

    if (audioTracks.length > 0 && textTracks.length > 0) {
      hasSetInitialTracksRef.current = true;
    }
  }, [
    textTracks,
    audioTracks,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
  ]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (unlockButtonTimerRef.current) {
        clearTimeout(unlockButtonTimerRef.current);
      }
    };
  }, [unlockButtonTimerRef]);

  // Animation effects
  useEffect(() => {
    // Loading animations
    if (isPreparingPlayer) {
      loadingOpacity.value = withTiming(1, {duration: 800});
      loadingScale.value = withTiming(1, {duration: 800});
      loadingRotation.value = withRepeat(
        withSequence(
          withDelay(500, withTiming(180, {duration: 900})),
          withTiming(180, {duration: 600}),
          withTiming(360, {duration: 900}),
          withTiming(360, {duration: 600}),
        ),
        -1,
      );
    }
  }, [isPreparingPlayer]);

  useEffect(() => {
    // Lock button animations
    const shouldShow =
      (isPlayerLocked && showUnlockButton) || (!isPlayerLocked && showControls);
    lockButtonTranslateY.value = withTiming(shouldShow ? 0 : -150, {
      duration: 250,
    });
    lockButtonOpacity.value = withTiming(shouldShow ? 1 : 0, {
      duration: 250,
    });
  }, [isPlayerLocked, showUnlockButton, showControls]);

  useEffect(() => {
    // 2x speed text visibility
    textVisibility.value = withTiming(isTextVisible ? 1 : 0, {duration: 250});

    // Speed icon blinking animation
    if (isTextVisible) {
      speedIconOpacity.value = withRepeat(
        withSequence(
          withTiming(1, {duration: 250}),
          withTiming(0, {duration: 150}),
          withTiming(1, {duration: 150}),
        ),
        -1,
      );
    } else {
      speedIconOpacity.value = withTiming(1, {duration: 150});
    }
  }, [isTextVisible]);

  useEffect(() => {
    // Controls visibility
    controlsTranslateY.value = withTiming(showControls ? 0 : 150, {
      duration: 250,
    });
    controlsOpacity.value = withTiming(showControls ? 1 : 0, {
      duration: 250,
    });
  }, [showControls]);

  useEffect(() => {
    // Toast visibility
    toastOpacity.value = withTiming(showToast ? 1 : 0, {duration: 250});
  }, [showToast]);

  useEffect(() => {
    // Settings modal visibility
    settingsTranslateY.value = withTiming(showSettings ? 0 : 5000, {
      duration: 250,
    });
    settingsOpacity.value = withTiming(showSettings ? 1 : 0, {
      duration: 250,
    });
  }, [showSettings]);

  useEffect(() => {
    // Handle fullscreen toggle
    if (isFullScreen) {
      reapplyImmersiveIfNeeded();
    } else {
      clearImmersiveReapplyTimer();
      exitFullScreen();
    }
  }, [clearImmersiveReapplyTimer, isFullScreen, reapplyImmersiveIfNeeded]);

  useEffect(() => {
    if (!isAppActive) {
      return;
    }

    reapplyImmersiveIfNeeded();
  }, [isAppActive, reapplyImmersiveIfNeeded]);

  useEffect(() => {
    return () => {
      clearImmersiveReapplyTimer();
      // Safety net: restore navigation bar on unmount
      exitFullScreen();
    };
  }, [clearImmersiveReapplyTimer]);

  // Memoized video player props
  const videoPlayerProps = useMemo(
    () => ({
      disableGesture: isPlayerLocked || !enableSwipeGesture,
      enable2xGesture,
      thumbnailContentType: selectedStream?.type,
      doubleTapTime: 200,
      disableSeekButtons: isPlayerLocked || hideSeekButtons,
      showOnStart: !isPlayerLocked,
      source: {
        textTracks: externalSubs,
        uri: processedStreamUrl,
        bufferConfig: {backBufferDurationMs: 30000},
        shouldCache: true,
        ...(selectedStream?.type === 'm3u8' && {type: 'm3u8'}),
        headers: selectedStream?.headers,
        metadata: {
          title: resolvedPrimaryTitle,
          subtitle: activeEpisode?.title,
          artist: activeEpisode?.title,
          description: activeEpisode?.title,
          imageUri: route.params?.poster?.poster,
        },
      },
      onProgress: (data: any) => {
        handleProgress(data);
        markStreamStartupProgress(data);
      },
      onLoadStart: () => {
        armStreamStartupGuard('load-start');
      },
      onLoad: (data: any) => {
        handleVideoLoad(data?.naturalSize);
        const duration = typeof data?.duration === 'number' ? data.duration : 0;
        if (Number.isFinite(duration) && duration > 0) {
          loadedDurationRef.current = duration;
          setEpisodeDuration(prev => (prev === duration ? prev : duration));
        }
        const seekTarget =
          subtitleReloadSeekRef.current != null
            ? subtitleReloadSeekRef.current
            : watchedDuration;
        if (subtitleReloadSeekRef.current != null) {
          subtitleReloadSeekRef.current = null;
        }
        playerRef?.current?.seek(seekTarget);
        playerRef?.current?.resume();
        setPlaybackRate(1.0);
      },
      videoRef: playerRef,
      rate: playbackRate,
      poster: route.params?.poster?.logo || '',
      subtitleStyle: {
        fontSize: settingsStorage.getSubtitleFontSize() || 16,
        opacity: settingsStorage.getSubtitleOpacity() || 1,
        paddingBottom: settingsStorage.getSubtitleBottomPadding() || 10,
        subtitlesFollowVideo: false,
      },
      title: {
        primary:
          resolvedPrimaryTitle && resolvedPrimaryTitle.length > 70
            ? resolvedPrimaryTitle.slice(0, 70) + '...'
            : resolvedPrimaryTitle,
        secondary: activeEpisode?.title,
      },
      navigator: navigation,
      seekColor: primary,
      showDuration: true,
      toggleResizeModeOnFullscreen: false,
      fullscreenOrientation: 'landscape' as const,
      fullscreenAutorotate: true,
      onShowControls: () => setShowControls(true),
      onHideControls: () => setShowControls(false),
      rewindTime: 10,
      isFullscreen: true,
      disableFullscreen: true,
      disableVolume: true,
      showHours: true,
      progressUpdateInterval: 1000,
      showNotificationControls: showMediaControls,
      onError: handleVideoError,
      resizeMode,
      selectedAudioTrack,
      onAudioTracks: (e: any) => processAudioTracks(e.audioTracks),
      textTracks: externalSubs,
      selectedTextTrack,
      onTextTracks: (e: any) => {
        const tracks = e?.textTracks || [];
        console.log('[subs][player] onTextTracks', {
          count: tracks.length,
          tracks: tracks.map((track: any, idx: number) => ({
            index: track?.index ?? idx,
            language: track?.language,
            title: track?.title,
            type: track?.type,
            uri: track?.uri,
          })),
        });
        setTextTracks(tracks);
      },
      onVideoTracks: (e: any) => processVideoTracks(e.videoTracks),
      selectedVideoTrack,
      skips: skipIntroInterval
        ? [
            {
              title: t('Skip Intro'),
              from: skipIntroInterval.startTime,
              to: skipIntroInterval.endTime,
            },
          ]
        : undefined,
      onSeekSnap: handleSeekSnap,
      style: {flex: 1, zIndex: 100},
      controlAnimationTiming: 357,
      controlTimeoutDelay: 10000,
      hideAllControlls: isPlayerLocked,
    }),
    [
      isPlayerLocked,
      enableSwipeGesture,
      enable2xGesture,
      hideSeekButtons,
      externalSubs,
      selectedStream,
      processedStreamUrl,
      route.params,
      activeEpisode,
      armStreamStartupGuard,
      handleProgress,
      markStreamStartupProgress,
      watchedDuration,
      handleVideoLoad,
      playbackRate,
      setPlaybackRate,
      primary,
      navigation,
      setShowControls,
      showMediaControls,
      handleVideoError,
      resizeMode,
      selectedAudioTrack,
      selectedTextTrack,
      selectedVideoTrack,
      processAudioTracks,
      processVideoTracks,
      skipIntroInterval,
      handleSeekSnap,
      t,
    ],
  );

  const currentPosition = Number.isFinite(videoPositionRef.current.position)
    ? videoPositionRef.current.position
    : 0;
  const episodeList = route.params?.episodeList || [];
  const currentEpisodeIndex = episodeList.findIndex(
    item => item?.link === activeEpisode?.link,
  );
  const hasNextEpisodeInSeason =
    currentEpisodeIndex >= 0 && currentEpisodeIndex < episodeList.length - 1;
  const hasNextEpisodeFromLoadedNextSeason =
    (nextSeasonInfo?.episodeList?.length || 0) > 0;
  const canLoadNextSeasonOnDemand =
    !!nextSeasonInfo?.season?.episodesLink && hasEpisodesModule;
  const hasNextEpisode =
    hasNextEpisodeInSeason ||
    hasNextEpisodeFromLoadedNextSeason ||
    canLoadNextSeasonOnDemand;
  const canShowEpisodeControls =
    episodeGroups.length > 0 &&
    (route.params?.type === 'series' ||
      episodeGroups.length > 1 ||
      episodeList.length > 1);
  const groupedOptionsQualityLabel =
    videoTracks?.length === 1
      ? formatVideoTrackQuality(videoTracks[0])
      : formatVideoTrackQuality(videoTracks?.[selectedQualityIndex]);
  const shouldShowSkipIntro =
    !!skipIntroInterval &&
    currentPosition >=
      Math.max(0, skipIntroInterval.startTime - SKIP_INTRO_LEAD_SECONDS) &&
    currentPosition < skipIntroInterval.endTime;
  const castIconColor =
    castProvider === 'native' && castState === CastState.CONNECTED
      ? primary
      : 'hsl(0, 0%, 70%)';
  const settingsPanelWidth = Math.max(
    320,
    Math.min(Dimensions.get('window').width - 24, 620),
  );
  const settingsPanelHeight = 320;

  // Show loading state
  if (isPreparingPlayer) {
    return (
      <SafeAreaView
        edges={{right: 'off', top: 'off', left: 'off', bottom: 'off'}}
        className="bg-black flex-1 justify-center items-center">
        <StatusBar translucent={true} hidden={true} />
        {/* create ripple effect */}
        <TouchableNativeFeedback
          background={TouchableNativeFeedback.Ripple(
            'rgba(255,255,255,0.15)',
            false, // ripple shows at tap location
          )}>
          <View className="w-full h-full justify-center items-center">
            <Animated.View
              style={[loadingContainerStyle]}
              className="justify-center items-center">
              <Animated.View style={[loadingIconStyle]} className="mb-2">
                <MaterialIcons name="hourglass-empty" size={60} color="white" />
              </Animated.View>
              <Text className="text-white text-lg mt-4">
                {t('Loading stream...')}
              </Text>
            </Animated.View>
          </View>
        </TouchableNativeFeedback>
      </SafeAreaView>
    );
  }

  // Show error state
  if (streamError) {
    return (
      <SafeAreaView className="bg-black flex-1 justify-center items-center">
        <StatusBar translucent={true} hidden={true} />
        <Text className="text-red-500 text-lg text-center mb-4">
          {t('Failed to load stream. Please try again.')}
        </Text>
        <TouchableOpacity
          className="bg-red-600 px-4 py-2 rounded-md"
          onPress={() => navigation.goBack()}>
          <Text className="text-white">{t('Go Back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={{
        right: 'off',
        top: 'off',
        left: 'off',
        bottom: 'off',
      }}
      className="bg-black flex-1 relative">
      <StatusBar translucent={true} hidden={true} />
      {!Platform.isTV && castProvider === 'native' && (
        <CastButton
          style={{
            width: 1,
            height: 1,
            opacity: 0,
            position: 'absolute',
            top: -100,
            left: -100,
          }}
        />
      )}

      {/* Video Player */}
      <VideoPlayer key={videoReloadNonce} {...videoPlayerProps} />

      {selectedStream?.type === 'torrent' &&
        torrentState &&
        torrentState !== 'seeding' &&
        torrentState !== 'finished' && (
          <View className="absolute top-4 self-center px-3 py-2 rounded-full bg-black/70 z-50">
            <Text className="text-white text-xs text-center">
              {torrentState}
              {torrentDownloaded > 0
                ? ` · ${torrentDownloaded.toFixed(1)} MB`
                : ''}
              {torrentDownloadSpeed > 0
                ? ` · ${(torrentDownloadSpeed / 1024 / 1024).toFixed(1)} MB/s`
                : ''}
            </Text>
          </View>
        )}

      {/* Full-screen overlay to detect taps when locked */}
      {isPlayerLocked && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleLockedScreenTap}
          className="absolute top-0 left-0 right-0 bottom-0 z-40 bg-transparent"
        />
      )}

      {/* Lock/Unlock button */}
      {!isPreparingPlayer && !Platform.isTV && !showEpisodeSidebar && (
        <Animated.View
          style={[lockButtonStyle]}
          className="absolute top-5 right-5 flex-row items-center gap-2 z-50">
          <TouchableOpacity
            onPress={togglePlayerLock}
            className="p-2 rounded-full">
            <MaterialCommunityIcons
              name={isPlayerLocked ? 'lock-outline' : 'lock-open-outline'}
              color={PLAYER_CONTROL_COLOR}
              size={24}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleFullScreen}
            className="opacity-70 p-2 rounded-full">
            <MaterialIcons
              name={isFullScreen ? 'fullscreen-exit' : 'fullscreen'}
              color={PLAYER_CONTROL_COLOR}
              size={24}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCastPress}
            className="opacity-70 p-2 rounded-full">
            <MaterialIcons name={'cast'} color={castIconColor} size={24} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Episode drawer toggle */}
      {!isPreparingPlayer && !isPlayerLocked && canShowEpisodeControls && (
        <Animated.View
          pointerEvents={
            showControls && !showSettings && !showEpisodeSidebar
              ? 'auto'
              : 'none'
          }
          style={[
            controlsOpacityStyle,
            {
              position: 'absolute',
              right: 2,
              top: '50%',
              transform: [{translateY: -20}],
              zIndex: 60,
            },
          ]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('Open episode list')}
            hitSlop={{top: 16, bottom: 16, left: 16, right: 16}}
            onPress={handleOpenEpisodeSidebar}
            className="p-2 rounded-full justify-center items-center">
            <MaterialIcons
              name="chevron-left"
              size={28}
              color={PLAYER_CONTROL_COLOR}
            />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Bottom controls */}
      {!isPlayerLocked && (
        <Animated.View
          style={[controlsStyle, {left: '7%', right: '7%', bottom: 15}]}
          className="absolute flex-row items-center">
          {/* Audio controls */}
          <TouchableOpacity
            onPress={() => {
              setActiveTab('audio');
              setShowSettings(!showSettings);
            }}
            className="min-w-0 flex-1 flex-row items-center justify-center gap-x-1">
            <MaterialCommunityIcons
              name="waveform"
              size={24}
              color={PLAYER_CONTROL_COLOR}
            />
            <Text
              className="capitalize text-xs text-white"
              style={PLAYER_CONTROL_LABEL_STYLE}
              numberOfLines={1}>
              {audioTracks[selectedAudioTrackIndex]?.language === 'auto'
                ? t('Auto')
                : audioTracks[selectedAudioTrackIndex]?.language || t('Auto')}
            </Text>
          </TouchableOpacity>

          {/* Subtitle controls */}
          <TouchableOpacity
            onPress={() => {
              setActiveTab('subtitle');
              setShowSettings(!showSettings);
            }}
            className="min-w-0 flex-1 flex-row items-center justify-center gap-x-1">
            <MaterialCommunityIcons
              name="subtitles-outline"
              size={24}
              color={PLAYER_CONTROL_COLOR}
            />
            <Text
              className="text-xs capitalize text-white"
              style={PLAYER_CONTROL_LABEL_STYLE}
              numberOfLines={1}>
              {selectedSubtitleLabel}
            </Text>
          </TouchableOpacity>

          {/* Speed controls */}
          <TouchableOpacity
            className="min-w-0 flex-1 flex-row items-center justify-center gap-1"
            onPress={() => {
              setActiveTab('speed');
              setShowSettings(!showSettings);
            }}>
            <MaterialCommunityIcons
              name="speedometer"
              size={24}
              color={PLAYER_CONTROL_COLOR}
            />
            <Text
              className="text-white text-sm"
              style={PLAYER_CONTROL_LABEL_STYLE}>
              {playbackRate === 1 ? '1.0' : playbackRate}x
            </Text>
          </TouchableOpacity>

          {/* PIP */}
          {!Platform.isTV && (
            <TouchableOpacity
              className="min-w-0 flex-1 flex-row items-center justify-center gap-1"
              onPress={() => {
                playerRef?.current?.enterPictureInPicture();
              }}>
              <MaterialCommunityIcons
                name="picture-in-picture-bottom-right-outline"
                size={24}
                color={PLAYER_CONTROL_COLOR}
              />
              <Text
                className="text-white text-xs"
                style={PLAYER_CONTROL_LABEL_STYLE}>
                {t('PIP')}
              </Text>
            </TouchableOpacity>
          )}

          {/* Server and quality */}
          <TouchableOpacity
            className="min-w-0 flex-1 flex-row items-center justify-center gap-1"
            onPress={() => {
              setActiveTab('server');
              setShowSettings(!showSettings);
            }}>
            <MaterialIcons
              name="video-settings"
              size={24}
              color={PLAYER_CONTROL_COLOR}
            />
            <Text
              className="text-xs text-white capitalize"
              style={PLAYER_CONTROL_LABEL_STYLE}
              numberOfLines={1}>
              {groupedOptionsQualityLabel}
            </Text>
          </TouchableOpacity>

          {/* Resize button */}
          <TouchableOpacity
            className="min-w-0 flex-1 flex-row items-center justify-center gap-1"
            onPress={handleResizeMode}>
            <MaterialCommunityIcons
              name="fit-to-screen-outline"
              size={25}
              color={PLAYER_CONTROL_COLOR}
            />
            <Text
              className="text-white text-sm min-w-[38px]"
              style={PLAYER_CONTROL_LABEL_STYLE}
              numberOfLines={1}>
              {resizeMode === ResizeMode.NONE
                ? t('Fit')
                : resizeMode === ResizeMode.COVER
                  ? t('Cover')
                  : resizeMode === ResizeMode.STRETCH
                    ? t('Stretch')
                    : t('Contain')}
            </Text>
          </TouchableOpacity>

          {/* Next episode controls */}
          {canShowEpisodeControls && (
            <TouchableOpacity
              className="min-w-0 flex-1 flex-row items-center justify-center"
              disabled={!hasNextEpisode}
              onPress={handleNextEpisode}
              style={{opacity: hasNextEpisode ? 1 : 0.35}}>
              <Text
                className="text-white text-sm"
                style={PLAYER_CONTROL_LABEL_STYLE}
                numberOfLines={1}>
                {t('Next')}
              </Text>
              <MaterialCommunityIcons
                name="skip-next-outline"
                size={26}
                color={PLAYER_CONTROL_COLOR}
              />
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Skip intro button */}
      {!isPlayerLocked && shouldShowSkipIntro && (
        <Animated.View
          style={[nextButtonStyle]}
          className="absolute bottom-24 right-5 z-50">
          <TouchableOpacity
            activeOpacity={0.85}
            className="rounded-full"
            onPress={handleSkipIntro}>
            <View
              style={overlayButtonContainerStyle}
              className="rounded-full overflow-hidden">
              <BlurView
                intensity={overlayBlurIntensity}
                tint="dark"
                experimentalBlurMethod="dimezisBlurView"
                style={{
                  backgroundColor: overlayBackgroundColor,
                }}
                className="flex-row items-center gap-2 px-4 py-2">
                <Text
                  style={{opacity: overlayTextOpacity}}
                  className="text-white text-sm font-semibold uppercase">
                  {t('Skip Intro')}
                </Text>
                <MaterialIcons
                  name="skip-next"
                  size={22}
                  color="white"
                  style={{opacity: overlayTextOpacity}}
                />
              </BlurView>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Toast message */}
      <Animated.View
        style={[toastStyle]}
        pointerEvents="none"
        className="absolute w-full top-12 justify-center items-center px-2">
        <Text className="text-white bg-black/50 p-2 rounded-full text-base">
          {toastMessage}
        </Text>
      </Animated.View>

      {/* Settings Modal */}
      {!isPreparingPlayer && !isPlayerLocked && showSettings && (
        <Animated.View
          style={[settingsStyle, {backgroundColor: 'rgba(0,0,0,0.48)'}]}
          className="absolute opacity-0 top-0 left-0 w-full h-full justify-end items-center"
          onTouchEnd={() => setShowSettings(false)}>
          <View
            className="p-3 rounded-t-3xl flex-row justify-start items-center"
            style={{
              width: settingsPanelWidth,
              height: settingsPanelHeight,
              backgroundColor: 'rgba(13,13,13,0.94)',
              borderColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1,
              shadowColor: '#000',
              shadowOpacity: 0.45,
              shadowRadius: 24,
              elevation: 18,
            }}
            onTouchEnd={e => e.stopPropagation()}>
            {/* Audio Tab */}
            {activeTab === 'audio' && (
              <ScrollView className="w-full h-full p-1 px-4">
                <Text className="text-lg font-bold text-center text-white">
                  {t('Audio')}
                </Text>
                {audioTracks.length === 0 && (
                  <View className="flex justify-center items-center">
                    <Text className="text-white text-xs">
                      {t('Loading audio tracks...')}
                    </Text>
                  </View>
                )}
                {audioTracks.map((track, i) => (
                  <PlayerMenuRow
                    key={i}
                    title={track.language || `${t('Audio')} ${i + 1}`}
                    detail={[track.type, track.title]
                      .filter(Boolean)
                      .join(' · ')}
                    selected={selectedAudioTrackIndex === i}
                    accentColor={primary}
                    icon="multitrack-audio"
                    onPress={() => {
                      setSelectedAudioTrack({
                        type: SelectedTrackType.LANGUAGE,
                        value: track.language,
                      });
                      cacheStorage.setString(
                        'lastAudioTrack',
                        track.language || '',
                      );
                      setSelectedAudioTrackIndex(i);
                      setShowSettings(false);
                    }}
                  />
                ))}
              </ScrollView>
            )}

            {/* Subtitle Tab */}
            {activeTab === 'subtitle' && (
              <FlashList
                estimatedItemSize={70}
                data={mergedTextTracks}
                ListHeaderComponent={
                  <View>
                    <Text className="text-lg font-bold text-center text-white">
                      {t('Subtitle')}
                    </Text>
                    <PlayerMenuRow
                      title={t('Disabled')}
                      selected={selectedTextTrackIndex === 1000}
                      accentColor={primary}
                      icon="subtitles-off"
                      onPress={() => {
                        console.log('[subs][player] subtitle disabled');
                        setSelectedTextTrack({
                          type: SelectedTrackType.DISABLED,
                        });
                        setSelectedTextTrackIndex(1000);
                        cacheStorage.setString('lastTextTrack', '');
                        setShowSettings(false);
                      }}
                    />
                  </View>
                }
                ListFooterComponent={
                  <>
                    <PlayerMenuRow
                      title={t('Add external file')}
                      accentColor={primary}
                      icon="add"
                      onPress={async () => {
                        try {
                          const res = await DocumentPicker.getDocumentAsync({
                            type: [
                              'text/vtt',
                              'application/x-subrip',
                              'text/srt',
                              'application/ttml+xml',
                            ],
                            multiple: false,
                          });

                          if (!res.canceled && res.assets?.[0]) {
                            const asset = res.assets[0];
                            const track = {
                              type: asset.mimeType as any,
                              title:
                                asset.name && asset.name.length > 20
                                  ? asset.name.slice(0, 20) + '...'
                                  : asset.name || t('Undefined'),
                              language: 'und',
                              uri: asset.uri,
                            };
                            setExternalSubs((prev: any) => [track, ...prev]);
                          }
                        } catch (err) {
                          console.log(err);
                        }
                      }}
                    />
                    <SearchSubtitles
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      setExternalSubs={setExternalSubs}
                    />
                  </>
                }
                renderItem={({item: track}) => (
                  <PlayerMenuRow
                    title={track.language || track.title || t('Subtitle')}
                    detail={track.title}
                    tags={[track.type, track.source].filter(Boolean)}
                    selected={selectedTextTrackIndex === track.index}
                    accentColor={primary}
                    icon="subtitles"
                    onPress={() => {
                      const selected = buildSelectedTextTrack(track);
                      console.log('[subs][player] subtitle selected', {
                        track: {
                          index: track.index,
                          source: track.source,
                          language: track.language,
                          title: track.title,
                          type: track.type,
                          uri: track.uri,
                        },
                        selected,
                      });
                      setSelectedTextTrack(selected);
                      triggerSubtitleSelectionReload('manual-select');
                      setSelectedTextTrackIndex(track.index);
                      cacheStorage.setString(
                        'lastTextTrack',
                        track.language || '',
                      );
                      setShowSettings(false);
                    }}
                  />
                )}
              />
            )}

            {/* Server Tab */}
            {activeTab === 'server' && (
              <View className="flex flex-row w-full h-full p-1 px-4">
                <ScrollView className="border-r border-white/50">
                  <Text className="w-full text-center text-white text-lg font-extrabold">
                    {t('Server')}
                  </Text>
                  {streamData?.length > 0 &&
                    streamData?.map((track, i) => (
                      <PlayerMenuRow
                        key={i}
                        title={track.server || `${t('Server')} ${i + 1}`}
                        quality={track.quality}
                        tags={track.type ? [track.type] : undefined}
                        selected={track.link === selectedStream.link}
                        accentColor={primary}
                        icon="dns"
                        onPress={() => {
                          setSelectedStream(track);
                          setShowSettings(false);
                          playerRef?.current?.resume();
                        }}
                      />
                    ))}
                </ScrollView>

                <ScrollView>
                  <Text className="w-full text-center text-white text-lg font-extrabold">
                    {t('Quality')}
                  </Text>
                  {videoTracks &&
                    videoTracks.map((track: any, i: any) => (
                      <PlayerMenuRow
                        key={i}
                        title={formatVideoTrackQuality(track)}
                        detail={
                          track.bitrate || track?.codecs
                            ? t('Bitrate {{bitrate}} | Codec {{codec}}', {
                                bitrate: track.bitrate || 0,
                                codec: track?.codecs || t('Unknown'),
                              })
                            : undefined
                        }
                        selected={selectedQualityIndex === i}
                        accentColor={primary}
                        icon="high-quality"
                        onPress={() => {
                          setSelectedVideoTrack({
                            type: SelectedVideoTrackType.INDEX,
                            value: track.index,
                          });
                          setSelectedQualityIndex(i);
                        }}
                      />
                    ))}
                </ScrollView>
              </View>
            )}

            {/* Speed Tab */}
            {activeTab === 'speed' && (
              <ScrollView className="w-full h-full p-1 px-4">
                <Text className="text-lg font-bold text-center text-white">
                  {t('Playback Speed')}
                </Text>
                {playbacks.map((rate, i) => (
                  <PlayerMenuRow
                    key={i}
                    title={`${rate}x`}
                    selected={playbackRate === rate}
                    accentColor={primary}
                    icon="speed"
                    onPress={() => {
                      setPlaybackRate(rate);
                      setShowSettings(false);
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </Animated.View>
      )}

      {!isPreparingPlayer && !isPlayerLocked && canShowEpisodeControls && (
        <PlayerEpisodeSidebar
          visible={showEpisodeSidebar}
          groups={episodeGroups}
          selectedGroupIndex={episodesTabGroupIndex}
          episodes={episodesTabEpisodeList}
          activeEpisodeLink={activeEpisode?.link}
          loading={episodesTabLoading}
          error={episodesTabError}
          primaryColor={primary}
          labels={{
            episodes: t('Episodes'),
            lists: t('Lists'),
            loading: t('Loading episodes...'),
            empty: t('No episodes available'),
            close: t('Close episode list'),
            episode: number => t('Episode {{number}}', {number}),
            shortEpisode: number => t('EP {{number}}', {number}),
          }}
          resolveTitle={resolveLocalizedItemTitle}
          onClose={() => setShowEpisodeSidebar(false)}
          onSelectGroup={handleSelectEpisodeGroup}
          onSelectEpisode={handleSelectEpisodeFromTab}
        />
      )}
    </SafeAreaView>
  );
};

export default Player;
