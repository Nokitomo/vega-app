import React, {ReactNode} from 'react';
import {Platform, StyleProp, View, ViewStyle} from 'react-native';
import {TVOSSupport} from './TVOSSupport';
import {_styles} from '../styles';

interface OSSupport {
  children: ReactNode;
  containerStyles: StyleProp<ViewStyle>;
  onScreenTouch: () => void;
  showControls: boolean;
  testID?: string;
}

export const PlatformSupport = ({
  children,
  onScreenTouch,
  containerStyles,
  showControls,
  testID,
}: OSSupport) => {
  if (Platform.isTV) {
    return (
      <>
        <TVOSSupport
          showControls={showControls}
          onScreenTouch={onScreenTouch}
        />
        {children}
      </>
    );
  }

  // Touches on phones and tablets are owned by the GestureDetector rendered
  // by VideoPlayer. Keeping a second TouchableWithoutFeedback here makes a
  // single tap pass through two independent double-tap state machines, which
  // can cancel the control toggle or execute it twice. TV keeps its dedicated
  // remote-control path above.
  return (
    <View
      testID={testID}
      style={[_styles.player.container, containerStyles]}>
      {children}
    </View>
  );
};
