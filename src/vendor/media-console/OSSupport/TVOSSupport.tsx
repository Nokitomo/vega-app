import * as ReactNative from 'react-native';

interface OSSupport {
  showControls: boolean;
  onScreenTouch: () => void;
}

export const TVOSSupport = ({showControls, onScreenTouch}: OSSupport) => {
  const useTVEventHandlerCompat =
    (ReactNative as {
      useTVEventHandler?: (handler: (event: unknown) => void) => void;
    }).useTVEventHandler || ((_handler: (event: unknown) => void) => {});

  useTVEventHandlerCompat(() => {
    if (!showControls) {
      onScreenTouch();
    }
  });

  return null;
};
