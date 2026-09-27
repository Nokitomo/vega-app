import React from 'react';
import {Image, type ImageStyle, type StyleProp} from 'react-native';
import {SvgUri} from 'react-native-svg';
import {isSvgArtworkUri} from '../lib/services/artworkSelection';

type RemoteLogoProps = {
  uri: string;
  width: number;
  height: number;
  onError: () => void;
  style?: StyleProp<ImageStyle>;
};

export default function RemoteLogo({
  uri,
  width,
  height,
  onError,
  style,
}: RemoteLogoProps): React.JSX.Element {
  if (isSvgArtworkUri(uri)) {
    return (
      <SvgUri
        uri={uri}
        width={width}
        height={height}
        onError={onError}
      />
    );
  }

  return (
    <Image
      source={{uri}}
      onError={onError}
      style={[{width, height, resizeMode: 'contain'}, style]}
    />
  );
}
