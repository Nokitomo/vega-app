import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {SearchStackParamList} from '../App';
import Slider from '../components/Slider';
import {HOME_FONT} from '../components/homePresentation';
import useThemeStore from '../lib/zustand/themeStore';
import {providerManager} from '../lib/services/ProviderManager';
import useContentStore from '../lib/zustand/contentStore';
import useSearchCacheStore, {
  SearchCacheEntry,
} from '../lib/zustand/searchCacheStore';

type Props = NativeStackScreenProps<SearchStackParamList, 'SearchResults'>;
type Result = SearchCacheEntry['searchData'][number];
type Section = {status: 'loading' | 'ready' | 'error'; result?: Result};
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

export default function SearchResults({route}: Props) {
  const {t} = useTranslation();
  const primary = useThemeStore(state => state.primary);
  const installedProviders = useContentStore(state => state.installedProviders);
  const getCache = useSearchCacheStore(state => state.getCache);
  const setCache = useSearchCacheStore(state => state.setCache);
  const [sections, setSections] = useState<Record<string, Section>>({});
  const retry = useRef<(value: string) => void>(() => {});
  const query = route.params.filter;

  useEffect(() => {
    const controller = new AbortController();
    const fingerprint = installedProviders
      .map(item =>
        [item.value, item.version || '', item.lastUpdated || 0].join(':'),
      )
      .sort()
      .join('|');
    const cacheKey = `${query.trim().toLowerCase()}::${fingerprint}`;
    const cached = getCache(cacheKey);
    const cachedResults = cached
      ? [...cached.searchData, ...cached.emptyResults]
      : [];
    // Older partial cache entries must not hide failed providers.
    const completeCache =
      cached &&
      cached.providerFingerprint === fingerprint &&
      Date.now() - cached.cachedAt < SEARCH_CACHE_TTL_MS &&
      installedProviders.every(provider =>
        cachedResults.some(item => item.value === provider.value),
      );
    let current: Record<string, Section> = Object.fromEntries(
      installedProviders.map(provider => [
        provider.value,
        completeCache
          ? {
              status: 'ready',
              result: cachedResults.find(item => item.value === provider.value),
            }
          : {status: 'loading'},
      ]),
    );
    setSections(current);
    const publish = (value: string, section: Section) => {
      if (controller.signal.aborted) {
        return;
      }
      current = {...current, [value]: section};
      setSections(current);
      if (
        installedProviders.every(
          provider => current[provider.value]?.status === 'ready',
        )
      ) {
        const results = installedProviders.map(
          provider => current[provider.value].result!,
        );
        setCache(cacheKey, {
          providerFingerprint: fingerprint,
          cachedAt: Date.now(),
          searchData: results.filter(item => item.Posts.length > 0),
          emptyResults: results.filter(item => item.Posts.length === 0),
        });
      }
    };
    const searchProvider = async (value: string) => {
      const provider = installedProviders.find(item => item.value === value);
      if (!provider || controller.signal.aborted) {
        return;
      }
      publish(value, {status: 'loading'});
      try {
        const posts = await providerManager.getSearchPosts({
          searchQuery: query,
          page: 1,
          providerValue: value,
          signal: controller.signal,
        });
        publish(value, {
          status: 'ready',
          result: {
            title: provider.display_name,
            name: provider.display_name,
            value,
            providerValue: value,
            filter: query,
            Posts: posts || [],
          },
        });
      } catch {
        publish(value, {status: 'error'});
      }
    };
    retry.current = value => {
      if (current[value]?.status === 'error') {
        searchProvider(value);
      }
    };
    if (!completeCache) {
      installedProviders.forEach(provider => {
        searchProvider(provider.value);
      });
    }
    return () => {
      controller.abort();
      retry.current = () => {};
    };
  }, [query, installedProviders, getCache, setCache]);

  const pending = installedProviders.some(
    provider =>
      !sections[provider.value] ||
      sections[provider.value].status === 'loading',
  );
  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 100}}>
        <View style={{backgroundColor: '#23252b', padding: 16}}>
          <Text
            style={{
              color: 'white',
              fontFamily: HOME_FONT.heading,
              fontSize: 22,
            }}>
            {t(pending ? 'Searching for' : 'Searched for')}{' '}
            <Text style={{color: primary}}>{query}</Text>
          </Text>
        </View>
        {installedProviders.length === 0 && (
          <Text style={{color: '#a0a0a0', padding: 16}}>
            {t('No installed providers to search')}
          </Text>
        )}
        <View style={{paddingHorizontal: 16}}>
          {installedProviders.map(provider => {
            const section = sections[provider.value];
            if (section?.status === 'ready' && section.result?.Posts.length) {
              return (
                <Slider
                  key={provider.value}
                  title={provider.display_name}
                  posts={section.result.Posts}
                  filter={query}
                  providerValue={provider.value}
                  isSearch
                  isLoading={false}
                />
              );
            }
            return (
              <View
                key={provider.value}
                testID={`search-provider-${provider.value}`}
                style={{paddingVertical: 20}}
                accessibilityLiveRegion="polite">
                <Text
                  style={{
                    color: primary,
                    fontFamily: HOME_FONT.bold,
                    fontSize: 20,
                    marginBottom: 12,
                  }}>
                  {provider.display_name}
                </Text>
                {!section || section.status === 'loading' ? (
                  <ActivityIndicator
                    color={primary}
                    accessibilityLabel={t('Searching for')}
                  />
                ) : (
                  <>
                    <Text
                      style={{
                        color: '#a0a0a0',
                        fontFamily: HOME_FONT.regular,
                        fontSize: 16,
                      }}>
                      {t(
                        section.status === 'error'
                          ? 'Failed to search'
                          : 'No Content Found',
                      )}
                    </Text>
                    {section.status === 'error' && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => retry.current(provider.value)}
                        style={{
                          minHeight: 48,
                          justifyContent: 'center',
                          alignSelf: 'flex-start',
                          paddingRight: 16,
                        }}>
                        <Text
                          style={{color: primary, fontFamily: HOME_FONT.bold}}>
                          {t('Retry')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
