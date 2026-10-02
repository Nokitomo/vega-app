import React, {memo, useCallback} from 'react';
import {FlatList, Text, TouchableOpacity, View} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import type {TitleSuggestion} from '../lib/services/imdbSuggestions';

interface SearchSuggestionsProps {
  suggestions: TitleSuggestion[];
  onSelectSuggestion: (title: string) => void;
}

const SearchSuggestionItem = memo(
  ({
    item,
    index,
    onPress,
  }: {
    item: TitleSuggestion;
    index: number;
    onPress: (title: string) => void;
  }) => {
    const {t} = useTranslation();
    const handlePress = useCallback(() => {
      onPress(item.title);
    }, [item.title, onPress]);
    const details = [
      item.type === 'tv' ? t('TV Show') : t('Movie'),
      item.year?.toString(),
    ]
      .filter(Boolean)
      .join(' • ');

    return (
      <View className="px-4">
        <TouchableOpacity
          testID={`search-suggestion-${index}`}
          accessibilityRole="button"
          accessibilityLabel={t('Search suggestion: {{title}}', {
            title: item.title,
          })}
          className="py-3 border-b border-white/10 flex-row items-center"
          onPress={handlePress}>
          <MaterialIcons
            name={item.type === 'tv' ? 'tv' : 'movie'}
            size={20}
            color="#999"
            style={{marginRight: 12}}
          />
          <View className="flex-1">
            <Text className="text-white text-base" numberOfLines={1}>
              {item.title}
            </Text>
            <Text className="text-white/50 text-xs">{details}</Text>
          </View>
          <MaterialIcons name="north-east" size={18} color="#666" />
        </TouchableOpacity>
      </View>
    );
  },
);

const SearchSuggestions = ({
  suggestions,
  onSelectSuggestion,
}: SearchSuggestionsProps) => {
  const renderItem = useCallback(
    ({item, index}: {item: TitleSuggestion; index: number}) => (
      <SearchSuggestionItem
        item={item}
        index={index}
        onPress={onSelectSuggestion}
      />
    ),
    [onSelectSuggestion],
  );

  return (
    <FlatList
      testID="search-suggestions-list"
      data={suggestions}
      keyExtractor={(item, index) => item.id || `${item.title}-${index}`}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{paddingBottom: 20}}
    />
  );
};

export default memo(SearchSuggestions);
