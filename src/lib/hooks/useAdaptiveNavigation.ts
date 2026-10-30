import {Dimensions, useWindowDimensions} from 'react-native';
import {getAdaptiveNavigation} from '../utils/adaptiveNavigation';

export default function useAdaptiveNavigation() {
  const {width} = useWindowDimensions();
  const screen = Dimensions.get('screen');
  return getAdaptiveNavigation(width, screen.width, screen.height);
}
