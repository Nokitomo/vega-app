import React from 'react';
import {Modal, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import useAdaptiveNavigation from '../lib/hooks/useAdaptiveNavigation';

export default function InfoDialog({visible, onClose, onShow, children, width: dialogWidth = 460}: {
  width?: number; visible: boolean; onClose: () => void; onShow?: () => void; children: React.ReactNode;
}) {
  const {isTabletDevice} = useAdaptiveNavigation();
  const {width, height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent={isTabletDevice}
    animationType={isTabletDevice ? 'fade' : 'slide'} onRequestClose={onClose} onShow={onShow}>
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center',
      paddingTop: insets.top, paddingBottom: insets.bottom,
      backgroundColor: isTabletDevice ? 'rgba(0,0,0,0.65)' : 'black'}}>
      <View style={isTabletDevice ? {width: Math.min(dialogWidth, width - 48),
        height: Math.min(640, height - insets.top - insets.bottom - 64), backgroundColor: '#23252b'}
        : {flex: 1, width: '100%', backgroundColor: 'black'}}>
        {children}
      </View>
    </View>
  </Modal>;
}
