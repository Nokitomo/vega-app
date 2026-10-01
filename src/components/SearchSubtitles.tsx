import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  ToastAndroid,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, {useMemo, useState} from 'react';
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
}: {
  searchQuery: string;
  setSearchQuery: (text: string) => void;
  setExternalSubs: React.Dispatch<React.SetStateAction<TextTracks>>;
}) => {
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [searchResults, setSearchResults] = useState<OpenSubtitlesResult[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [subId, setSubId] = useState('en');

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
    try {
      if (!getOpenSubtitlesApiKey()) {
        setError(
          t('Configure your OpenSubtitles API key in Subtitle Preferences.'),
        );
        return;
      }
      setLoading(true);
      setError('');
      const data = await searchOpenSubtitles({
        query: searchQuery,
        language: subId,
        season,
        episode,
      });
      if (data?.length === 0) {
        setError(t('No Results Found'));
        setSearchResults([]);
        return;
      }
      setSearchResults(data);
    } catch (e: any) {
      setError(e?.message || t('Error fetching subtitles'));
      ToastAndroid.show(t('Error fetching subtitles'), ToastAndroid.SHORT);
    } finally {
      setLoading(false);
    }
  };

  const selectSubtitle = async (result: OpenSubtitlesResult) => {
    try {
      setLoading(true);
      const uri = await getOpenSubtitlesDownloadUrl(result.fileId);
      setExternalSubs(prev => [
        {
          type: TextTrackType.SUBRIP,
          language: result.language,
          title: [result.release, result.uploader].filter(Boolean).join(' '),
          uri,
        },
        ...prev,
      ]);
      setSearchModalVisible(false);
    } catch (e: any) {
      setError(e?.message || t('Unable to download subtitle.'));
      ToastAndroid.show(t('Unable to download subtitle.'), ToastAndroid.SHORT);
    } finally {
      setLoading(false);
    }
  };
  return (
    <View>
      <TouchableOpacity
        className="flex-row gap-3 items-center rounded-md my-1 overflow-hidden ml-2"
        onPress={() => setSearchModalVisible(true)}>
        <MaterialIcons name="add" size={20} color="white" />
        <Text className="text-base font-semibold text-white">
          {t('Search subtitles online')}
        </Text>
      </TouchableOpacity>
      <Modal
        animationType="slide"
        transparent={false}
        statusBarTranslucent={true}
        visible={searchModalVisible}
        onRequestClose={() => {
          setSearchModalVisible(!searchModalVisible);
        }}>
        <SafeAreaView className="h-full w-full bg-black bg-opacity-80">
          <View className="flex-row justify-start items-center gap-x-4 px-4 py-2">
            <MaterialIcons
              name="arrow-back-ios-new"
              size={24}
              color="white"
              onPress={() => setSearchModalVisible(false)}
            />
            <Text className="text-white text-xl font-semibold">
              {t('Search Subtitles')}
            </Text>
          </View>
          <View className="flex-row justify-between items-center px-4 py-2">
            <TextInput
              placeholder={t('Name or IMDB ID')}
              className="bg-quaternary w-[60%] rounded-md p-2 text-white"
              onChangeText={text => setSearchQuery(text)}
              value={searchQuery}
            />
            <View className="bg-quaternary w-[10%] h-11 rounded-md p-2">
              <Dropdown
                selectedTextStyle={{
                  color: 'white',
                  overflow: 'hidden',
                  fontWeight: 'bold',
                }}
                containerStyle={{
                  borderColor: '#363636',
                  width: 115,
                  paddingLeft: 5,
                  borderRadius: 5,
                  overflow: 'hidden',
                  padding: 2,
                  backgroundColor: 'black',
                  maxHeight: 450,
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
                  <Text className={'text-lg p-1 text-white/60 bg-black'}>
                    {name}
                  </Text>
                )}
              />
            </View>
            <TextInput
              placeholder={t('Season')}
              keyboardType="numeric"
              className="bg-quaternary text-white w-[10%] rounded-md p-2"
              onChangeText={text => setSeason(text)}
              value={season}
            />
            <TextInput
              placeholder={t('Episode')}
              keyboardType="numeric"
              className="bg-quaternary text-white w-[10%] rounded-md p-2"
              onChangeText={text => setEpisode(text)}
              value={episode}
            />
            <TouchableOpacity>
              <MaterialIcons
                name="search"
                size={34}
                color={primary}
                onPress={() => searchSubtitles()}
              />
            </TouchableOpacity>
          </View>
          <ScrollView
            className=" px-7 py-2"
            contentContainerStyle={{flexGrow: 1}}>
            {loading ? (
              <View className="w-full h-full justify-center items-center">
                <ActivityIndicator size="large" color={primary} />
              </View>
            ) : (
              searchResults.map(result => (
                <TouchableOpacity
                  key={`${result.id}:${result.fileId}`}
                  className="flex-row justify- items-center gap-x-4 p-2 my-1 border border-b border-white/10 rounded-md"
                  disabled={loading}
                  onPress={() => selectSubtitle(result)}>
                  <Text className="text-white text-lg font-semibold capitalize">
                    {result.language}
                  </Text>
                  <Text className="text-white text-base">
                    {result.title.trim()}
                  </Text>
                  <Text className="text-white text-lg">
                    {Number(result.season) > 0 ? `S${result.season}` : ''}
                  </Text>
                  <Text className="text-white text-lg">
                    {Number(result.episode) > 0 ? `E${result.episode}` : ''}
                  </Text>
                  <Text className="text-white text-xs italic">
                    {[result.release, result.uploader]
                      .filter(Boolean)
                      .join(' ')}
                  </Text>
                </TouchableOpacity>
              ))
            )}
            {searchResults.length === 0 && !loading && (
              <View className="w-full h-full justify-center items-center">
                <Text className="text-red-700 text-lg font-semibold">
                  {error}
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

export default SearchSubtitles;
