import React from 'react';
import {View} from 'react-native';
import {HOME_NAVIGATION_COLOR} from '../lib/utils/homeNavigationBar';

export default function TabBarBackgound() {
  return <View style={{flex: 1, backgroundColor: HOME_NAVIGATION_COLOR}} />;
}
