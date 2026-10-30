import React, {useEffect, useState} from 'react';
import {Platform, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NavigationContainerRefWithCurrent} from '@react-navigation/native';
import type {RootStackParamList} from '../App';
import useAdaptiveNavigation from '../lib/hooks/useAdaptiveNavigation';
import {hasAppBottomBar, HOME_NAVIGATION_COLOR} from '../lib/utils/homeNavigationBar';

export {HOME_NAVIGATION_COLOR};

// Local state updates only this frame; children retain their identity, so
// navigation and video trees do not rerender when the inset color changes.
export default function HomeNavigationInset({navigation, children}: {
  children?: React.ReactNode;
  navigation: NavigationContainerRefWithCurrent<RootStackParamList>;
}) {
  const [visible, setVisible] = useState(true);
  const {useSideTabLayout: sideTabs} = useAdaptiveNavigation();
  useEffect(() => {
    const sync = () => setVisible(hasAppBottomBar(navigation.getRootState()));
    const unsubscribe = navigation.addListener('state', sync);
    if (navigation.isReady()) {sync();}
    return unsubscribe;
  }, [navigation]);
  const color = Platform.OS === 'android' && visible && !sideTabs ? HOME_NAVIGATION_COLOR : 'black';
  return <SafeAreaView
    edges={{right: 'off', top: 'off', left: 'off', bottom: 'additive'}}
    style={{flex: 1, backgroundColor: color}}>
    <View style={{flex: 1, backgroundColor: 'black'}}>{children}</View>
  </SafeAreaView>;
}
