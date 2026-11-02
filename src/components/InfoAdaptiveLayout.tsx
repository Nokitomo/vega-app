import React, {useEffect, useRef} from 'react';
import {Animated, ScrollView, View} from 'react-native';

// Keep the same component tree across rotation so season/search state survives.
export default function InfoAdaptiveLayout({landscape, summary, children, tabs, footer, background, scrollY, toolbarHeight, refreshControl}: {
  landscape: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
  tabs: React.ReactNode;
  footer: React.ReactNode;
  background: React.ReactNode;
  scrollY: Animated.Value;
  toolbarHeight: number;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
}) {
  const pageRef = useRef<ScrollView>(null);
  const summaryRef = useRef<ScrollView>(null);
  const assetsRef = useRef<ScrollView>(null);
  useEffect(() => {
    // A disabled scroller must not retain an offset from the other layout.
    if (landscape) {
      pageRef.current?.scrollTo({y: 0, animated: false});
      scrollY.setValue(0);
    } else {
      summaryRef.current?.scrollTo({y: 0, animated: false});
      assetsRef.current?.scrollTo({y: 0, animated: false});
    }
  }, [landscape, scrollY]);
  return <View style={{flex: 1, backgroundColor: 'black', paddingTop: landscape ? toolbarHeight : 0}}>
    {!landscape && background}
    <Animated.ScrollView ref={pageRef} showsVerticalScrollIndicator={false} scrollEnabled={!landscape}
      contentContainerStyle={landscape ? {height: '100%'} : {flexGrow: 1}}
      onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {useNativeDriver: true})}
      scrollEventThrottle={16} refreshControl={landscape ? undefined : refreshControl}>
      <View style={{flexDirection: landscape ? 'row' : 'column', flex: landscape ? 1 : undefined}}>
        <View style={{width: landscape ? '63%' : '100%'}}>
          <ScrollView ref={summaryRef} showsVerticalScrollIndicator={false} scrollEnabled={landscape} style={{flex: landscape ? 1 : undefined}}
            refreshControl={landscape ? refreshControl : undefined}>
            {landscape && background}
            {summary}
          </ScrollView>
          {landscape && footer}
        </View>
        <View style={{width: landscape ? '37%' : '100%'}}>
          {tabs}
          <ScrollView ref={assetsRef} showsVerticalScrollIndicator={false} scrollEnabled={landscape}>
          {children}
          <View style={{height: 32, backgroundColor: 'black'}} />
          </ScrollView>
        </View>
      </View>
    </Animated.ScrollView>
    {!landscape && footer}
  </View>;
}
