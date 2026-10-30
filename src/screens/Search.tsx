import {View, Text, FlatList} from 'react-native';
import React, {useState, useCallback, memo} from 'react';
import {useNavigation, useIsFocused} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SearchStackParamList} from '../App';
import {Feather} from '@expo/vector-icons';
import {TouchableOpacity} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import {MMKV} from '../lib/Mmkv';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import SearchSuggestions from '../components/SearchSuggestions';
import SearchToolbar from '../components/SearchToolbar';
import SearchSuggestionState from '../components/SearchSuggestionState';
import {HOME_FONT} from '../components/homePresentation';
import {useSearchSuggestions} from '../lib/hooks/useSearchSuggestions';
import {sanitizeSearchQuery} from '../lib/utils/helpers';

const MAX_HISTORY_ITEMS = 30; // Maximum number of history items to store

// Memoized history item component
const HistoryItem = memo(
  ({
    search,
    onPress,
    onRemove,
  }: {
    search: string;
    onPress: (text: string) => void;
    onRemove: (text: string) => void;
  }) => {
    const {t} = useTranslation();
    const handlePress = useCallback(() => {
      onPress(search);
    }, [search, onPress]);

    const handleRemove = useCallback(() => {
      onRemove(search);
    }, [search, onRemove]);

    return (
      <View
        style={{
          backgroundColor: '#203943',
          marginBottom: 8,
          flexDirection: 'row',
        }}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={handlePress}
          style={{
            flex: 1,
            minHeight: 48,
            padding: 12,
            justifyContent: 'center',
          }}>
          <Text
            style={{
              color: 'white',
              fontFamily: HOME_FONT.regular,
              fontSize: 16,
            }}>
            {search}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('Remove recent search: {{query}}', {
            query: search,
          })}
          onPress={handleRemove}
          style={{
            width: 48,
            minHeight: 48,
            borderLeftWidth: 1,
            borderLeftColor: '#355360',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Feather name="x" size={26} color="white" />
        </TouchableOpacity>
      </View>
    );
  },
);

const Search = () => {
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const [searchText, setSearchText] = useState('');
  const screenFocused = useIsFocused();
  const [suggestionsSuppressed, setSuggestionsSuppressed] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(
    MMKV.getArray<string>('searchHistory') || [],
  );
  const {suggestions, status} = useSearchSuggestions({
    enabled: screenFocused,
    query: searchText,
    suppressed: suggestionsSuppressed,
  });

  const handleTextChange = useCallback((text: string) => {
    setSuggestionsSuppressed(false);
    setSearchText(text);
  }, []);

  const handleSearch = useCallback(
    (text: string) => {
      if (text.trim()) {
        setSuggestionsSuppressed(true);
        // Save to search history
        const prevSearches = MMKV.getArray<string>('searchHistory') || [];
        if (!prevSearches.includes(text.trim())) {
          const newSearches = [text.trim(), ...prevSearches].slice(
            0,
            MAX_HISTORY_ITEMS,
          );
          MMKV.setArray('searchHistory', newSearches);
          setSearchHistory(newSearches);
        }

        navigation.navigate('SearchResults', {
          filter: text.trim(),
        });
      }
    },
    [navigation],
  );

  const handleResultPress = useCallback(
    (title: string) => {
      const cleanTitle = sanitizeSearchQuery(title);
      setSearchText(cleanTitle);
      handleSearch(cleanTitle);
    },
    [handleSearch],
  );

  const removeHistoryItem = useCallback(
    (search: string) => {
      const newSearches = searchHistory.filter(item => item !== search);
      MMKV.setArray('searchHistory', newSearches);
      setSearchHistory(newSearches);
    },
    [searchHistory],
  );

  const clearHistory = useCallback(() => {
    MMKV.setArray('searchHistory', []);
    setSearchHistory([]);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-black">
      <SearchToolbar
        testID="global-search-input"
        value={searchText}
        onChangeText={handleTextChange}
        onSubmit={handleSearch}
        placeholder={t('Search')}
      />
      <Text
        style={{
          color: '#a0a0a0',
          fontFamily: HOME_FONT.regular,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}>
        {t('Search all installed providers')}
      </Text>
      {searchText.trim().length > 0 && !suggestionsSuppressed ? (
        suggestions.length > 0 ? (
          <SearchSuggestions
            suggestions={suggestions}
            onSelectSuggestion={handleResultPress}
          />
        ) : (
          <SearchSuggestionState status={status} />
        )
      ) : searchHistory.length > 0 ? (
        <View style={{flex: 1, paddingHorizontal: 16}}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 20,
            }}>
            <Text
              style={{
                color: 'white',
                fontFamily: HOME_FONT.heading,
                fontSize: 22,
                flex: 1,
              }}>
              {t('Recent Searches')}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={clearHistory}
              style={{minHeight: 48, justifyContent: 'center'}}>
              <Text
                style={{
                  color: primary,
                  fontFamily: HOME_FONT.bold,
                  fontSize: 14,
                }}>
                {t('Clear All')}
              </Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={searchHistory}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{paddingBottom: 100}}
            renderItem={({item}) => (
              <HistoryItem
                search={item}
                onPress={handleSearch}
                onRemove={removeHistoryItem}
              />
            )}
          />
        </View>
      ) : (
        <SearchSuggestionState status="idle" />
      )}
    </SafeAreaView>
  );
};

export default Search;
