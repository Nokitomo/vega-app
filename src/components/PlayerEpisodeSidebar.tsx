import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {EpisodeLink, Link} from '../lib/providers/types';

type Props = {
  visible: boolean;
  groups: Link[];
  selectedGroupIndex: number;
  episodes: EpisodeLink[];
  activeEpisodeLink?: string;
  loading: boolean;
  error: string | null;
  primaryColor: string;
  labels: {
    episodes: string;
    lists: string;
    loading: string;
    empty: string;
    close: string;
    episode: (number: number) => string;
    shortEpisode: (number: number) => string;
  };
  resolveTitle: (
    item?: {
      title?: string;
      titleKey?: string;
      titleParams?: Record<string, any>;
    } | null,
  ) => string;
  onClose: () => void;
  onSelectGroup: (index: number) => void;
  onSelectEpisode: (episode: EpisodeLink, index: number) => void;
};

type EpisodeRowProps = {
  episode: EpisodeLink;
  title: string;
  fallbackTitle: string;
  thumbnailLabel: string;
  isActive: boolean;
  primaryColor: string;
  onSelect: () => void;
};

const EpisodeRow = React.memo<EpisodeRowProps>(
  ({
    episode,
    title,
    fallbackTitle,
    thumbnailLabel,
    isActive,
    primaryColor,
    onSelect,
  }) => {
    const [imageFailed, setImageFailed] = useState(false);
    const thumbnail = episode.thumbnail?.trim();

    useEffect(() => {
      setImageFailed(false);
    }, [thumbnail]);

    return (
      <TouchableOpacity
        activeOpacity={0.72}
        onPress={onSelect}
        style={[
          styles.episodeRow,
          {
            backgroundColor: isActive
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(255,255,255,0.03)',
            borderColor: isActive ? primaryColor : 'rgba(255,255,255,0.08)',
          },
        ]}>
        <View style={styles.thumbnailContainer}>
          {thumbnail && !imageFailed ? (
            <Image
              source={{uri: thumbnail}}
              style={styles.thumbnail}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.thumbnailFallback}>
              <MaterialCommunityIcons
                name="movie-outline"
                size={20}
                color="rgba(255,255,255,0.4)"
              />
              <Text style={styles.thumbnailFallbackText}>{thumbnailLabel}</Text>
            </View>
          )}
          {isActive && (
            <View style={styles.activeThumbnailOverlay}>
              <MaterialCommunityIcons
                name="play-circle"
                size={26}
                color={primaryColor}
              />
            </View>
          )}
        </View>

        <View style={styles.episodeInfo}>
          <Text
            numberOfLines={1}
            style={[
              styles.episodeTitle,
              {
                color: isActive ? primaryColor : '#fff',
                fontWeight: isActive ? '700' : '600',
              },
            ]}>
            {title || fallbackTitle}
          </Text>
          {Boolean(episode.synopsis?.trim()) && (
            <Text numberOfLines={2} style={styles.episodeSynopsis}>
              {episode.synopsis?.trim()}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  },
);

const PlayerEpisodeSidebar = ({
  visible,
  groups,
  selectedGroupIndex,
  episodes,
  activeEpisodeLink,
  loading,
  error,
  primaryColor,
  labels,
  resolveTitle,
  onClose,
  onSelectGroup,
  onSelectEpisode,
}: Props): React.JSX.Element => {
  const {width: screenWidth} = useWindowDimensions();
  const drawerWidth = Math.min(380, Math.max(300, screenWidth * 0.8));
  const translateX = useSharedValue(drawerWidth + 24);
  const backdropOpacity = useSharedValue(0);
  const listRef = useRef<FlatList<EpisodeLink>>(null);

  useEffect(() => {
    translateX.value = withTiming(visible ? 0 : drawerWidth + 24, {
      duration: 250,
    });
    backdropOpacity.value = withTiming(visible ? 1 : 0, {duration: 250});
  }, [backdropOpacity, drawerWidth, translateX, visible]);

  const activeEpisodeIndex = useMemo(
    () => episodes.findIndex(episode => episode.link === activeEpisodeLink),
    [activeEpisodeLink, episodes],
  );

  useEffect(() => {
    if (!visible || activeEpisodeIndex < 0) {
      return;
    }

    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: activeEpisodeIndex,
        animated: true,
        viewPosition: 0.3,
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [activeEpisodeIndex, visible]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={styles.root}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={labels.close}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[styles.drawer, {width: drawerWidth}, drawerStyle]}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <MaterialCommunityIcons
              name="playlist-play"
              size={25}
              color={primaryColor}
            />
            <Text style={styles.headerTitle}>{labels.episodes}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{episodes.length}</Text>
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={labels.close}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            onPress={onClose}
            style={styles.closeButton}>
            <MaterialIcons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {groups.length > 1 && (
          <View style={styles.groupSection}>
            <Text style={styles.groupLabel}>{labels.lists}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.groupList}>
              {groups.map((group, index) => {
                const selected = selectedGroupIndex === index;
                return (
                  <TouchableOpacity
                    key={`player-sidebar-group-${group.episodesLink || group.title || index}`}
                    activeOpacity={0.72}
                    onPress={() => onSelectGroup(index)}
                    style={[
                      styles.groupButton,
                      {
                        borderColor: selected
                          ? primaryColor
                          : 'rgba(255,255,255,0.12)',
                        backgroundColor: selected
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(255,255,255,0.04)',
                      },
                    ]}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.groupButtonText,
                        {color: selected ? primaryColor : '#fff'},
                      ]}>
                      {resolveTitle(group) || `#${index + 1}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={primaryColor} size="small" />
            <Text style={styles.stateText}>{labels.loading}</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : episodes.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.stateText}>{labels.empty}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={episodes}
            keyExtractor={(episode, index) =>
              `player-sidebar-episode-${episode.link}-${index}`
            }
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            contentContainerStyle={styles.episodeList}
            onScrollToIndexFailed={({index, averageItemLength}) => {
              listRef.current?.scrollToOffset({
                offset: Math.max(0, index * averageItemLength),
                animated: true,
              });
            }}
            renderItem={({item, index}) => (
              <EpisodeRow
                episode={item}
                title={resolveTitle(item)}
                fallbackTitle={labels.episode(index + 1)}
                thumbnailLabel={labels.shortEpisode(index + 1)}
                isActive={item.link === activeEpisodeLink}
                primaryColor={primaryColor}
                onSelect={() => onSelectEpisode(item, index)}
              />
            )}
          />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 30,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 900,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 24,
    backgroundColor: 'rgba(14,14,14,0.97)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  countText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    padding: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  groupSection: {
    paddingTop: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  groupLabel: {
    paddingHorizontal: 14,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  groupList: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 7,
  },
  groupButton: {
    maxWidth: 150,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  groupButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  episodeList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  episodeRow: {
    minHeight: 68,
    marginVertical: 4,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 84,
    height: 52,
    marginRight: 10,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#1c1c1e',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailFallbackText: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
  },
  activeThumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  episodeInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  episodeTitle: {
    fontSize: 13,
  },
  episodeSynopsis: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    lineHeight: 14,
  },
  centerState: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    textAlign: 'center',
  },
});

export default PlayerEpisodeSidebar;
