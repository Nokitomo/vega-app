import {View, Text, Image, FlatList, ScrollView} from 'react-native';
import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {WatchListStackParamList} from '../App';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {TouchableOpacity} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import useWatchListStore, {
  WatchList as WatchListItem,
} from '../lib/zustand/watchListStore';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  CATALOG_CARD_TITLE_STYLE,
  HOME_FONT,
  getHomeCardWidth,
} from '../components/homePresentation';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {StatusBar} from 'expo-status-bar';
import {useTranslation} from 'react-i18next';
import {hasItaBadge} from '../lib/utils/helpers';

const WatchList = () => {
  const {primary} = useThemeStore(state => state);
  const {t} = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<WatchListStackParamList>>();
  const {watchList} = useWatchListStore(state => state);
  const [listWidth, setListWidth] = React.useState(0);

  const itemSpacing = 12;

  // Use the stable viewport, excluding sidebar and outer padding. Do not
  // render columns from a provisional window width before it is measured.
  const availableWidth = listWidth;

  // Determine number of columns and adjusted item width
  const numColumns = Math.max(
    1,
    Math.ceil(
      (availableWidth + itemSpacing) /
        (getHomeCardWidth(availableWidth + 32) + itemSpacing),
    ),
  );

  // Calculate the actual item width to fill the space exactly
  const itemWidth =
    (availableWidth - itemSpacing * (numColumns - 1)) / numColumns;

  // Render each grid item
  const renderItem = ({item, index}: {item: WatchListItem; index: number}) => (
    <TouchableOpacity
      key={item.link + index}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={() =>
        navigation.navigate('Info', {
          link: item.link,
          provider: item.provider,
          poster: item.poster,
        })
      }
      style={{
        width: itemWidth,
        marginBottom: 20,
      }}>
      <View className="relative overflow-hidden">
        <Image
          resizeMode="cover"
          style={{
            width: itemWidth,
            height: itemWidth * 1.5,
            backgroundColor: '#23252b',
          }}
          source={{uri: item.poster}}
        />
        {hasItaBadge(item.title) ? (
          <View
            className="absolute top-2 left-2 rounded-full px-2 py-0.5"
            style={{backgroundColor: primary}}>
            <Text className="text-black text-[10px] font-semibold">
              {t('ITA')}
            </Text>
          </View>
        ) : null}
        <Text
          style={{
            ...CATALOG_CARD_TITLE_STYLE,
            color: 'white',
            maxWidth: itemWidth,
          }}
          numberOfLines={3}>
          {item.title}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{flex: 1, backgroundColor: 'black'}}>
      <StatusBar translucent backgroundColor="transparent" />

      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#23252b',
        }}>
        <Text
          accessibilityRole="header"
          style={{fontFamily: HOME_FONT.heading, fontSize: 22, color: 'white'}}>
          {t('Watchlist')}
        </Text>
      </View>
      <View style={{flex: 1, paddingHorizontal: 16, paddingTop: 20}}>
        <View
          testID="watchlist-viewport"
          style={{flex: 1, minWidth: 0}}
          onLayout={({nativeEvent: {layout}}) => {
            setListWidth(Math.max(0, layout.width));
          }}>
          {watchList.length > 0 ? (
            listWidth > 0 ? (
              <FlatList
                key={`watchlist-grid-${numColumns}`}
                data={watchList}
                renderItem={renderItem}
                keyExtractor={(item, index) => item.link + index}
                numColumns={numColumns}
                columnWrapperStyle={
                  numColumns > 1
                    ? {
                        gap: itemSpacing,
                        justifyContent: 'flex-start',
                      }
                    : undefined
                }
                contentContainerStyle={{
                  paddingBottom: 24,
                }}
                showsVerticalScrollIndicator={false}
              />
            ) : null
          ) : (
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 32,
              }}>
              <MaterialCommunityIcons
                name="bookmark-outline"
                size={80}
                color={primary}
              />
              <Text
                style={{
                  fontFamily: HOME_FONT.regular,
                  color: '#dadada',
                  fontSize: 18,
                  textAlign: 'center',
                  marginTop: 24,
                  maxWidth: 420,
                }}>
                {t('Your watchlist is empty')}
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default WatchList;
