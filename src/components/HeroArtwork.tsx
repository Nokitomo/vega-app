import React, {useEffect, useRef} from 'react';
import {Animated, Image} from 'react-native';

// Mounted per artwork URI: a late load cannot animate the next slide.
export default function HeroArtwork({
  uri,
  reducedMotion,
  onError,
  onLoad,
}: {
  uri: string;
  reducedMotion: boolean;
  onError: () => void;
  onLoad?: () => void;
}) {
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const loaded = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    if (reducedMotion) {
      opacity.stopAnimation();
      opacity.setValue(1);
    }
    return () => {
      active.current = false;
      opacity.stopAnimation();
    };
  }, [opacity, reducedMotion]);
  return (
    <Animated.View style={{width: '100%', height: '100%', opacity}}>
      <Image
        source={{uri}}
        onError={onError}
        onLoad={() => {
          if (!active.current || loaded.current) {
            return;
          }
          loaded.current = true;
          onLoad?.();
          Animated.timing(opacity, {
            toValue: 1,
            duration: reducedMotion ? 0 : 240,
            useNativeDriver: true,
          }).start();
        }}
        style={{width: '100%', height: '100%', resizeMode: 'cover'}}
      />
    </Animated.View>
  );
}
