import {useState} from 'react';
import {LayoutChangeEvent} from 'react-native';
import {getHomeCardWidth} from './homePresentation';

export const getPosterGrid = (width: number) => {
  const available = Math.max(0, width);
  const columns = Math.max(
    1,
    Math.ceil((available + 12) / (getHomeCardWidth(available + 32) + 12)),
  );
  const cellWidth = available / columns;
  return {columns, cellWidth, posterWidth: Math.max(1, cellWidth - 12)};
};

export default function usePosterGrid() {
  const [width, setWidth] = useState(0);
  return {
    ...getPosterGrid(width),
    ready: width > 0,
    onLayout: (event: LayoutChangeEvent) =>
      setWidth(event.nativeEvent.layout.width),
  };
}
