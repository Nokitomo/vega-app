import {View, Text, Platform, Image, FlatList} from 'react-native';
import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {WatchListStackParamList} from '../App';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {TouchableOpacity} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import useWatchListStore from '../lib/zustand/watchListStore';
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

  const itemSpacing = 10;

  // Use the stable viewport, excluding sidebar and outer padding. Do not
  // render columns from a provisional window width before it is measured.
  const availableWidth = listWidth;

  // Determine number of columns and adjusted item width
  const numColumns = Math.max(
    1,
    Math.floor((availableWidth + itemSpacing) / (100 + itemSpacing)),
  );

  // Calculate the actual item width to fill the space exactly
  const itemWidth =
    (availableWidth - itemSpacing * (numColumns - 1)) / numColumns;

  // Render each grid item
  const renderItem = ({item, index}: {item: any; index: number}) => (
    <TouchableOpacity
      key={item.link + index}
      onPress={() =>
        navigation.navigate('Info', {
          link: item.link,
          provider: item.provider,
          poster: item.poster,
        })
      }
      style={{
        width: itemWidth,
        marginBottom: 16,
      }}>
      <View className="relative overflow-hidden">
        <Image
          className="rounded-xl"
          resizeMode="cover"
          style={{
            width: itemWidth,
            height: 155,
            borderRadius: 10,
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
          className="text-white text-xs truncate text-center mt-1"
          style={{maxWidth: itemWidth}}
          numberOfLines={1}>
          {item.title}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-black justify-center items-center">
      <StatusBar translucent backgroundColor="transparent" />

      <View
        className="w-full bg-black"
        style={{
          paddingTop: Platform.OS === 'android' ? 15 : 0, // Adjust for Android status bar height
        }}
      />

      <View className="flex-1 w-full px-3">
        <Text
          className="text-2xl text-center font-bold mb-6 mt-4"
          style={{color: primary}}>
          {t('Watchlist')}
        </Text>

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
                  paddingBottom: 50,
                }}
                showsVerticalScrollIndicator={false}
              />
            ) : null
          ) : (
            <View className="flex-1">
              <View className="items-center justify-center mt-20 mb-12">
                <MaterialCommunityIcons
                  name="playlist-remove"
                  size={80}
                  color={primary}
                />
                <Text className="text-white/70 text-base mt-4 text-center">
                  {t('Your watchlist is empty')}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export default WatchList;
