import React, {useState} from 'react';
import {Image, type ImageStyle, type StyleProp} from 'react-native';
import {SvgUri} from 'react-native-svg';
import {isSvgArtworkUri} from '../lib/services/artworkSelection';

type RemoteLogoProps = {
  align?: 'left' | 'center';
  uri: string;
  width: number;
  height: number;
  onError: () => void;
  onLoad?: () => void;
  style?: StyleProp<ImageStyle>;
};

export default function RemoteLogo({
  align = 'center',
  uri,
  width,
  height,
  onError,
  onLoad,
  style,
}: RemoteLogoProps): React.JSX.Element {
  const [intrinsic, setIntrinsic] = useState<{uri: string; width: number; height: number} | null>(null);
  const imageWidth = align === 'left' && intrinsic?.uri === uri
    ? Math.min(width, height * intrinsic.width / intrinsic.height) : width;
  if (isSvgArtworkUri(uri)) {
    return (
      <SvgUri
        uri={uri}
        preserveAspectRatio={align === 'left' ? 'xMinYMid meet' : 'xMidYMid meet'}
        width={width}
        height={height}
        onError={onError}
        onLoad={onLoad}
      />
    );
  }

  return (
    <Image
      source={{uri}}
      onError={onError}
      onLoad={event => {
        const source = event.nativeEvent.source;
        if (align === 'left' && source?.width > 0 && source?.height > 0) {
          setIntrinsic(previous => previous?.uri === uri && previous.width === source.width && previous.height === source.height
            ? previous : {uri, width: source.width, height: source.height});
        }
        onLoad?.();
      }}
      style={[{width: imageWidth, height, resizeMode: 'contain'}, style]}
    />
  );
}
