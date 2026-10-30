import useThemeStore from '../lib/zustand/themeStore';
import React, {useCallback, useState} from 'react';
import {
  Animated as NativeAnimated,
  StyleSheet,
  Keyboard,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Feather, Ionicons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {HomeStackParamList, SearchStackParamList} from '../App';
import useContentStore from '../lib/zustand/contentStore';
import useUiSettingsStore from '../lib/zustand/uiSettingsStore';
import SearchSuggestions from './SearchSuggestions';
import SearchToolbar from './SearchToolbar';
import SearchSuggestionState from './SearchSuggestionState';
import {HOME_FONT} from './homePresentation';
import {useSearchSuggestions} from '../lib/hooks/useSearchSuggestions';
import {sanitizeSearchQuery} from '../lib/utils/helpers';

export default function HomeHeader({
  isDrawerOpen,
  onOpenDrawer,
  searchActive,
  setSearchActive,
  backgroundOpacity,
}: {
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
  searchActive: boolean;
  setSearchActive: (active: boolean) => void;
  backgroundOpacity: NativeAnimated.AnimatedInterpolation<number>;
}) {
  const {t} = useTranslation();
  const primary = useThemeStore(state => state.primary);
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

  const {suggestions, status} = useSearchSuggestions({
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
      }}>
      <NativeAnimated.View
        testID="home-toolbar-background"
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, {backgroundColor: 'black', opacity: backgroundOpacity}]}
      />
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
              color: primary,
              fontSize: 29,
              fontFamily: HOME_FONT.heading,
              letterSpacing: -1,
            }}>
            vega
          </Text>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
          {showHamburgerMenu && !isDrawerDisabled && (
            <Pressable
              onPress={onOpenDrawer}
              style={{
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityState={{expanded: isDrawerOpen}}
              accessibilityLabel={t('Home providers')}>
              <Ionicons name="layers-outline" size={25} color="white" />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Search in {{provider}}', {
              provider: provider.display_name,
            })}
            onPress={() => setSearchActive(true)}
            style={{
              width: 48,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Feather name="search" size={25} color="white" />
          </Pressable>
        </View>
      </View>

      <Modal
        visible={searchActive}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeSearch}>
        <SafeAreaView className="flex-1 bg-black">
          <SearchToolbar
            testID="provider-search-input"
            autoFocus
            value={searchText}
            onChangeText={handleSearchTextChange}
            onSubmit={handleSearchSubmit}
            onBack={closeSearch}
            placeholder={t('Search')}
          />
          <Text style={{color: '#a0a0a0', fontFamily: HOME_FONT.regular, paddingHorizontal: 16, paddingTop: 12}}>
            {t('Search in {{provider}}', {provider: provider.display_name})}
          </Text>
          <View className="flex-1 pt-2">
            {suggestions.length > 0 ? (
              <SearchSuggestions
                suggestions={suggestions}
                onSelectSuggestion={handleSelectSuggestion}
              />
            ) : (
              <SearchSuggestionState status={status} />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
