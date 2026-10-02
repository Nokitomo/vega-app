import {View, Text, FlatList} from 'react-native';
import React, {useState, useCallback, memo} from 'react';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SearchStackParamList} from '../App';
import {MaterialIcons, Ionicons, Feather} from '@expo/vector-icons';
import {TextInput} from 'react-native';
import {TouchableOpacity} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import {MMKV} from '../lib/Mmkv';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  SlideInRight,
  Layout,
} from 'react-native-reanimated';
import {useTranslation} from 'react-i18next';
import SearchSuggestions from '../components/SearchSuggestions';
import {useSearchSuggestions} from '../lib/hooks/useSearchSuggestions';
import {sanitizeSearchQuery} from '../lib/utils/helpers';

const MAX_HISTORY_ITEMS = 30; // Maximum number of history items to store

// Memoized history item component
const HistoryItem = memo(
  ({
    search,
    onPress,
    onRemove,
    primary,
  }: {
    search: string;
    onPress: (text: string) => void;
    onRemove: (text: string) => void;
    primary: string;
  }) => {
    const handlePress = useCallback(() => {
      onPress(search);
    }, [search, onPress]);

    const handleRemove = useCallback(() => {
      onRemove(search);
    }, [search, onRemove]);

    return (
      <View className="bg-[#141414] rounded-lg p-3 mb-2 flex-row justify-between items-center border border-white/5">
        <TouchableOpacity
          onPress={handlePress}
          className="flex-row flex-1 items-center space-x-2">
          <View className="bg-white/10 rounded-full p-1.5">
            <Ionicons name="time-outline" size={16} color={primary} />
          </View>
          <Text className="text-white text-sm ml-2">{search}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRemove}
          className="bg-white/5 rounded-full p-1.5">
          <Feather name="x" size={14} color="#999" />
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
  const [isFocused, setIsFocused] = useState(false);
  const [suggestionsSuppressed, setSuggestionsSuppressed] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(
    MMKV.getArray<string>('searchHistory') || [],
  );
  const suggestions = useSearchSuggestions({
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

  // Conditionally render animations based on state
  const AnimatedContainer = Animated.View;

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Title Section */}
      <AnimatedContainer
        entering={FadeInDown.springify()}
        layout={Layout.springify()}
        className="px-4 pt-4">
        <Text className="text-white text-xl font-bold mb-3">{t('Search')}</Text>
        <View className="flex-row items-center space-x-3 mb-2">
          <View className="flex-1">
            <View className="overflow-hidden rounded-xl bg-[#141414] shadow-lg shadow-black/50">
              <View className="px-3 py-3">
                <View className="flex-row items-center">
                  <MaterialIcons
                    name="search"
                    size={24}
                    color={isFocused ? primary : '#666'}
                  />
                  <TextInput
                    className="flex-1 text-white text-base ml-3"
                    placeholder={t('Search titles...')}
                    placeholderTextColor="#666"
                    value={searchText}
                    onChangeText={handleTextChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onSubmitEditing={e => handleSearch(e.nativeEvent.text)}
                    returnKeyType="search"
                  />
                  {searchText.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setSuggestionsSuppressed(false);
                        setSearchText('');
                      }}
                      className="bg-gray-800/50 rounded-full p-2">
                      <Feather name="x" size={18} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
      </AnimatedContainer>

      {/* Search Results */}
      <AnimatedContainer
        layout={Layout.springify()}
        className="flex-1"
        key={
          suggestions.length > 0
            ? 'suggestions'
            : searchHistory.length > 0
              ? 'history'
              : 'empty'
        }>
        {suggestions.length > 0 ? (
          <SearchSuggestions
            suggestions={suggestions}
            onSelectSuggestion={handleResultPress}
          />
        ) : searchHistory.length > 0 ? (
          <AnimatedContainer
            entering={SlideInRight.springify()}
            layout={Layout.springify()}
            className="px-4 flex-1">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-white/90 text-base font-semibold">
                {t('Recent Searches')}
              </Text>
              <TouchableOpacity
                onPress={clearHistory}
                className="bg-red-500/10 rounded-full px-2 py-0.5">
                <Text className="text-red-500 text-xs">{t('Clear All')}</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={searchHistory}
              keyExtractor={(item, index) => `history-${index}`}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{paddingBottom: 20}}
              renderItem={({item: search}) => (
                <HistoryItem
                  search={search}
                  onPress={handleSearch}
                  onRemove={removeHistoryItem}
                  primary={primary}
                />
              )}
            />
          </AnimatedContainer>
        ) : (
          // Empty State - Only show when no history and no results
          <AnimatedContainer
            layout={Layout.springify()}
            className="items-center justify-center flex-1">
            <View className="bg-white/5 rounded-full p-6 mb-4">
              <Ionicons name="search" size={32} color={primary} />
            </View>
            <Text className="text-white/70 text-base text-center">
              {t('Search for your favorite titles')}
            </Text>
            <Text className="text-white/40 text-sm text-center mt-1">
              {t('Your recent searches will appear here')}
            </Text>
          </AnimatedContainer>
        )}
      </AnimatedContainer>
    </SafeAreaView>
  );
};

export default Search;
