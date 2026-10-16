import React from 'react';
import {Image, type ImageStyle, type StyleProp} from 'react-native';
import {SvgUri} from 'react-native-svg';
import {isSvgArtworkUri} from '../lib/services/artworkSelection';

type RemoteLogoProps = {
  uri: string;
  width: number;
  height: number;
  onError: () => void;
  onLoad?: () => void;
  style?: StyleProp<ImageStyle>;
};

export default function RemoteLogo({
  uri,
  width,
  height,
  onError,
  onLoad,
  style,
}: RemoteLogoProps): React.JSX.Element {
  if (isSvgArtworkUri(uri)) {
    return (
      <SvgUri
        uri={uri}
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
      onLoad={onLoad}
      style={[{width, height, resizeMode: 'contain'}, style]}
    />
  );
}
