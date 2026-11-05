import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {HOME_FONT} from './homePresentation';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  getSubtitleLanguage,
  searchStremioSubtitles,
  setSubtitleLanguage,
} from '../lib/services/stremioAddons';
import {downloadAddonSubtitle} from '../lib/services/addonSubtitleFile';
import useThemeStore from '../lib/zustand/themeStore';
import {ScrollView} from 'react-native';
import {Dropdown} from 'react-native-element-dropdown';
import {TextTracks, TextTrackType} from 'react-native-video';
import {useTranslation} from 'react-i18next';
import {
  getOpenSubtitlesApiKey,
  getOpenSubtitlesDownloadUrl,
  OpenSubtitlesResult,
  searchOpenSubtitles,
} from '../lib/services/openSubtitles';

const SearchSubtitles = ({
  searchQuery,
  setSearchQuery,
  setExternalSubs,
  imdbId,
  contentType = 'series',
  seasonNumber,
  episodeNumber,
  contentKey,
}: {
  imdbId?: string;
  contentType?: 'movie' | 'series';
  seasonNumber?: number;
  episodeNumber?: number;
  contentKey?: string;
  searchQuery: string;
  setSearchQuery: (text: string) => void;
  setExternalSubs: React.Dispatch<React.SetStateAction<TextTracks>>;
}) => {
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [season, setSeason] = useState(
    seasonNumber == null ? '' : String(seasonNumber),
  );
  const [episode, setEpisode] = useState(
    episodeNumber == null ? '' : String(episodeNumber),
  );
  const [searchResults, setSearchResults] = useState<
    (OpenSubtitlesResult & {addonUrl?: string; addonSource?: string})[]
  >([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [subId, setSubId] = useState(getSubtitleLanguage);
  const [source, setSource] = useState<'stremio' | 'direct'>('stremio');
  const [imdb, setImdb] = useState(imdbId || '');
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const close = () => {
    generation.current += 1;
    request.current?.abort();
    setLoading(false);
    setSearchModalVisible(false);
  };
  useEffect(() => {
    generation.current += 1;
    request.current?.abort();
    setLoading(false);
    setSearchResults([]);
    setError('');
    setImdb(imdbId || '');
    setSeason(seasonNumber == null ? '' : String(seasonNumber));
    setEpisode(episodeNumber == null ? '' : String(episodeNumber));
    return () => {
      generation.current += 1;
      request.current?.abort();
    };
  }, [contentKey, imdbId, seasonNumber, episodeNumber]);

  const subLanguageIds = useMemo(
    () => [
      {name: t('English'), id: 'en'},
      {name: t('Spanish'), id: 'es'},
      {name: t('French'), id: 'fr'},
      {name: t('German'), id: 'de'},
      {name: t('Italian'), id: 'it'},
      {name: t('Portuguese'), id: 'pt'},
      {name: t('Russian'), id: 'ru'},
      {name: t('Chinese'), id: 'zh'},
      {name: t('Japanese'), id: 'ja'},
      {name: t('Korean'), id: 'ko'},
      {name: t('Arabic'), id: 'ar'},
      {name: t('Hindi'), id: 'hi'},
      {name: t('Dutch'), id: 'nl'},
      {name: t('Swedish'), id: 'sv'},
      {name: t('Polish'), id: 'pl'},
      {name: t('Turkish'), id: 'tr'},
      {name: t('Danish'), id: 'da'},
      {name: t('Norwegian'), id: 'no'},
      {name: t('Finnish'), id: 'fi'},
      {name: t('Vietnamese'), id: 'vi'},
      {name: t('Indonesian'), id: 'id'},
    ],
    [t],
  );

  const searchSubtitles = async () => {
    request.current?.abort();
    request.current = new AbortController();
    const current = ++generation.current;
    setLoading(true);
    setError('');
    setSearchResults([]);
    try {
      setSubtitleLanguage(subId);
      if (source === 'stremio') {
        const response = await searchStremioSubtitles({
          imdb,
          type: contentType,
          season,
          episode,
          language: subId,
          signal: request.current.signal,
        });
        if (current !== generation.current) {
          return;
        }
        setSearchResults(
          response.results.map(item => ({
            id: item.id,
            fileId: 0,
            language: item.language as OpenSubtitlesResult['language'],
            release: item.label,
            title: item.label || searchQuery,
            addonUrl: item.url,
            addonSource: item.source,
          })),
        );
        if (response.failed.length) {
          setError(
            t('addon.failedSources', {sources: response.failed.join(', ')}),
          );
        } else if (!response.results.length) {
          setError(t('No Results Found'));
        }
      } else {
        if (!getOpenSubtitlesApiKey()) {
          setError(
            t('Configure your OpenSubtitles API key in Subtitle Preferences.'),
          );
          return;
        }
        const data = await searchOpenSubtitles({
          query: searchQuery,
          language: subId,
          season,
          episode,
        });
        if (current !== generation.current) {
          return;
        }
        setSearchResults(data);
        if (!data.length) {
          setError(t('No Results Found'));
        }
      }
    } catch (e) {
      if (current === generation.current) {
        setError(
          e instanceof Error ? e.message : t('Error fetching subtitles'),
        );
      }
    } finally {
      if (current === generation.current) {
        setLoading(false);
      }
    }
  };

  const selectSubtitle = async (
    result: OpenSubtitlesResult & {addonUrl?: string; addonSource?: string},
  ) => {
    const current = ++generation.current;
    request.current?.abort();
    request.current = new AbortController();
    try {
      setLoading(true);
      setError('');
      const file = result.addonUrl
        ? await downloadAddonSubtitle(result.addonUrl, request.current.signal)
        : {
            uri: await getOpenSubtitlesDownloadUrl(result.fileId),
            type: TextTrackType.SUBRIP,
          };
      if (current !== generation.current) {
        return;
      }
      setExternalSubs(prev => [
        {
          ...file,
          language: result.language,
          title: [
            result.release || result.title,
            result.addonSource || result.uploader,
          ]
            .filter(Boolean)
            .join(' · '),
        },
        ...prev,
      ]);
      close();
    } catch (e) {
      if (current === generation.current) {
        setError(
          e instanceof Error ? e.message : t('Unable to download subtitle.'),
        );
      }
    } finally {
      if (current === generation.current) {
        setLoading(false);
      }
    }
  };
  return (
    <View>
      <TouchableOpacity
        className="flex-row gap-3 items-center rounded-md my-1 overflow-hidden ml-2"
        onPress={() => setSearchModalVisible(true)}>
        <MaterialIcons name="add" size={20} color="white" />
        <Text
          style={{fontFamily: HOME_FONT.regular}}
          className="text-base font-semibold text-white">
          {t('Search subtitles online')}
        </Text>
      </TouchableOpacity>
      <Modal
        animationType="slide"
        transparent={false}
        statusBarTranslucent={true}
        visible={searchModalVisible}
        onRequestClose={close}>
        <SafeAreaView className="flex-1 bg-black">
          <KeyboardAvoidingView
            style={{flex: 1}}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                flexGrow: 1,
                width: '100%',
                maxWidth: 800,
                alignSelf: 'center',
                paddingBottom: 24,
              }}>
              <View className="flex-row justify-start items-center gap-x-4 px-4 py-2">
                <MaterialIcons
                  name="arrow-back-ios-new"
                  size={24}
                  color="white"
                  onPress={close}
                />
                <Text
                  style={{fontFamily: HOME_FONT.heading}}
                  className="text-white text-xl font-semibold">
                  {t('Search Subtitles')}
                </Text>
              </View>
              <View className="px-4 py-2">
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 12,
                  }}>
                  {(['stremio', 'direct'] as const).map(value => (
                    <TouchableOpacity
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{selected: source === value}}
                      disabled={loading}
                      onPress={() => {
                        setSource(value);
                        setSearchResults([]);
                        setError('');
                      }}
                      style={{
                        padding: 12,
                        minHeight: 48,
                        borderRadius: 10,
                        backgroundColor: source === value ? primary : '#252525',
                      }}>
                      <Text
                        style={{
                          fontFamily: HOME_FONT.medium,
                          color: source === value ? 'black' : 'white',
                        }}>
                        {t(
                          value === 'stremio' ? 'addon.title' : 'addon.direct',
                        )}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {source === 'stremio' && (
                  <>
                    <Text
                      style={{
                        color: '#bbb',
                        fontFamily: HOME_FONT.regular,
                        marginBottom: 10,
                      }}>
                      {t('addon.searchHint')}
                    </Text>
                    <TextInput
                      accessibilityLabel={t('addon.imdbLabel')}
                      placeholder="tt1475582"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      value={imdb}
                      onChangeText={setImdb}
                      style={{
                        fontFamily: HOME_FONT.regular,
                        backgroundColor: '#23252b',
                        padding: 12,
                        color: 'white',
                        minHeight: 48,
                        marginBottom: 12,
                      }}
                    />
                  </>
                )}
                {source === 'direct' && (
                  <TextInput
                    placeholder={t('Name or IMDB ID')}
                    accessibilityLabel={t('Name or IMDB ID')}
                    style={{fontFamily: HOME_FONT.regular, minHeight: 48}}
                    placeholderTextColor="#a0a0a0"
                    className="bg-[#23252b] p-3 text-white mb-3"
                    onChangeText={text => setSearchQuery(text)}
                    value={searchQuery}
                  />
                )}
                <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}>
                  <View
                    style={{flexGrow: 1, flexBasis: 120, minWidth: 100}}
                    className="bg-[#23252b] p-3">
                    <Dropdown
                      selectedTextStyle={{
                        color: 'white',
                        overflow: 'hidden',
                        fontFamily: HOME_FONT.medium,
                      }}
                      containerStyle={{
                        borderColor: '#363636',
                        width: 115,
                        paddingLeft: 5,
                        borderRadius: 0,
                        overflow: 'hidden',
                        padding: 2,
                        backgroundColor: 'black',
                        maxHeight: 300,
                      }}
                      labelField={'id'}
                      valueField={'id'}
                      placeholder={t('Select')}
                      value={subId}
                      data={subLanguageIds}
                      onChange={async item => {
                        setSubId(item.id);
                      }}
                      renderItem={({name}) => (
                        <Text
                          style={{fontFamily: HOME_FONT.regular}}
                          className={'text-base p-3 text-white bg-[#23252b]'}>
                          {name}
                        </Text>
                      )}
                    />
                  </View>
                  {contentType === 'series' && (
                    <View style={{flexGrow: 1, flexBasis: 100}}>
                      <Text
                        style={{
                          color: '#bbb',
                          marginBottom: 4,
                          fontFamily: HOME_FONT.regular,
                        }}>
                        {t('Season')}
                      </Text>
                      <TextInput
                        placeholder={t('Season')}
                        accessibilityLabel={t('Season')}
                        keyboardType="numeric"
                        style={{
                          fontFamily: HOME_FONT.regular,
                          minHeight: 48,
                        }}
                        placeholderTextColor="#a0a0a0"
                        className="bg-[#23252b] text-white p-3"
                        onChangeText={text => setSeason(text)}
                        value={season}
                      />
                    </View>
                  )}
                  {contentType === 'series' && (
                    <View style={{flexGrow: 1, flexBasis: 100}}>
                      <Text
                        style={{
                          color: '#bbb',
                          marginBottom: 4,
                          fontFamily: HOME_FONT.regular,
                        }}>
                        {t('Episode')}
                      </Text>
                      <TextInput
                        placeholder={t('Episode')}
                        accessibilityLabel={t('Episode')}
                        keyboardType="numeric"
                        style={{
                          fontFamily: HOME_FONT.regular,
                          minHeight: 48,
                        }}
                        placeholderTextColor="#a0a0a0"
                        className="bg-[#23252b] text-white p-3"
                        onChangeText={text => setEpisode(text)}
                        value={episode}
                      />
                    </View>
                  )}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('Search')}
                    disabled={loading}
                    onPress={() => searchSubtitles()}
                    style={{
                      width: '100%',
                      flexDirection: 'row',
                      gap: 8,
                      backgroundColor: primary,
                      minWidth: 48,
                      minHeight: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <MaterialIcons name="search" size={24} color="black" />
                    <Text style={{fontFamily: HOME_FONT.bold, color: 'black'}}>
                      {t('Search')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View className=" px-7 py-2" style={{flexGrow: 1}}>
                {loading ? (
                  <View className="w-full h-full justify-center items-center">
                    <ActivityIndicator size="large" color={primary} />
                  </View>
                ) : (
                  searchResults.map(result => (
                    <TouchableOpacity
                      key={result.addonUrl || `${result.id}:${result.fileId}`}
                      className="gap-2 p-4 my-1 bg-[#141519] border border-white/10"
                      disabled={loading}
                      onPress={() => selectSubtitle(result)}>
                      <Text
                        style={{fontFamily: HOME_FONT.regular}}
                        className="text-white text-lg font-semibold capitalize">
                        {result.language}
                      </Text>
                      <Text
                        style={{fontFamily: HOME_FONT.regular}}
                        className="text-white text-base">
                        {result.title.trim()}
                      </Text>
                      {Number(result.season) > 0 && (
                        <Text
                          style={{fontFamily: HOME_FONT.regular}}
                          className="text-white text-lg">
                          {`S${result.season}`}
                        </Text>
                      )}
                      {Number(result.episode) > 0 && (
                        <Text
                          style={{fontFamily: HOME_FONT.regular}}
                          className="text-white text-lg">
                          {`E${result.episode}`}
                        </Text>
                      )}
                      <Text
                        style={{fontFamily: HOME_FONT.regular}}
                        className="text-white text-xs italic">
                        {[
                          result.addonSource,
                          result.release !== result.title ? result.release : '',
                          result.uploader,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
                {!!error && !loading && (
                  <View className="w-full h-full justify-center items-center">
                    <Text
                      style={{fontFamily: HOME_FONT.regular}}
                      className="text-red-700 text-lg font-semibold">
                      {error}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

export default SearchSubtitles;
