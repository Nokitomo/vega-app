import React, {useCallback, useState} from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeIn} from 'react-native-reanimated';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Feather, Ionicons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {HomeStackParamList, SearchStackParamList} from '../App';
import useContentStore from '../lib/zustand/contentStore';
import useUiSettingsStore from '../lib/zustand/uiSettingsStore';
import SearchSuggestions from './SearchSuggestions';
import {useSearchSuggestions} from '../lib/hooks/useSearchSuggestions';
import {sanitizeSearchQuery} from '../lib/utils/helpers';

export default function HomeHeader({
  isDrawerOpen,
  onOpenDrawer,
  searchActive,
  setSearchActive,
  scrolled,
}: {
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
  searchActive: boolean;
  setSearchActive: (active: boolean) => void;
  scrolled: boolean;
}) {
  const {t} = useTranslation();
  const {provider} = useContentStore();
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState('');
  const [suggestionsSuppressed, setSuggestionsSuppressed] = useState(false);
  const showHamburgerMenu = useUiSettingsStore(
    state => state.showHamburgerMenu,
  );
  const isDrawerDisabled = useUiSettingsStore(state => state.disableDrawer);
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const searchNavigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearchActive(false);
    setSearchText('');
    setSuggestionsSuppressed(false);
  }, []);

  const suggestions = useSearchSuggestions({
    query: searchText,
    enabled: searchActive,
    suppressed: suggestionsSuppressed,
  });

  const handleSearchTextChange = useCallback((text: string) => {
    setSuggestionsSuppressed(false);
    setSearchText(text);
  }, []);

  // Memoized handlers
  const handleSearchSubmit = useCallback(
    (text: string) => {
      const query = text.trim();
      if (!query) {
        return;
      }
      setSuggestionsSuppressed(true);
      closeSearch();
      if (/^https?:\/\//i.test(query)) {
        navigation.navigate('Info', {link: query});
      } else {
        searchNavigation.navigate('ScrollList', {
          providerValue: provider.value,
          filter: query,
          title: provider.display_name,
          isSearch: true,
        });
      }
    },
    [
      closeSearch,
      navigation,
      searchNavigation,
      provider.value,
      provider.display_name,
    ],
  );

  const handleSelectSuggestion = useCallback(
    (title: string) => {
      const cleanTitle = sanitizeSearchQuery(title);
      setSuggestionsSuppressed(true);
      handleSearchSubmit(cleanTitle);
    },
    [handleSearchSubmit],
  );

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        paddingBottom: 12,
        backgroundColor: scrolled ? '#141519' : 'transparent',
      }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
          <Text
            style={{
              color: '#FF640A',
              fontSize: 29,
              fontWeight: '900',
              letterSpacing: -1,
            }}>
            vega
          </Text>
          {showHamburgerMenu && !isDrawerDisabled && !isDrawerOpen && (
            <Pressable
              onPress={onOpenDrawer}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('Home providers')}>
              <Ionicons name="menu-outline" size={25} color="white" />
            </Pressable>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Search in {{provider}}', {
            provider: provider.display_name,
          })}
          onPress={() => setSearchActive(true)}
          hitSlop={12}>
          <Feather name="search" size={25} color="white" />
        </Pressable>
      </View>

      <Modal
        visible={searchActive}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeSearch}>
        <SafeAreaView className="flex-1 bg-black">
          <Animated.View
            entering={FadeIn.duration(200)}
            className="px-4 pt-4 flex-row items-center">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('Close search')}
              onPress={closeSearch}
              className="p-2 mr-2">
              <Ionicons name="arrow-back" size={26} color="white" />
            </TouchableOpacity>
            <View className="flex-1 flex-row items-center rounded-xl bg-[#141414] px-3">
              <Feather name="search" size={21} color="#999" />
              <TextInput
                testID="provider-search-input"
                autoFocus
                value={searchText}
                onChangeText={handleSearchTextChange}
                onSubmitEditing={event =>
                  handleSearchSubmit(event.nativeEvent.text)
                }
                placeholder={t('Search in {{provider}}', {
                  provider: provider.display_name,
                })}
                placeholderTextColor="#777"
                returnKeyType="search"
                className="flex-1 h-12 px-3 text-white text-base"
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('Clear search')}
                  onPress={() => {
                    setSuggestionsSuppressed(false);
                    setSearchText('');
                  }}
                  className="p-2">
                  <Feather name="x" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
          <View className="flex-1 pt-2">
            {suggestions.length > 0 ? (
              <SearchSuggestions
                suggestions={suggestions}
                onSelectSuggestion={handleSelectSuggestion}
              />
            ) : (
              <View className="flex-1 items-center justify-center px-8">
                <Ionicons name="search" size={34} color="#666" />
                <Text className="text-white/50 text-sm text-center mt-3">
                  {t('Type at least two characters for suggestions')}
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
