import {StyleSheet} from 'react-native';
import {HOME_FONT} from './homePresentation';

export const settingsPresentation = StyleSheet.create({
  page: {flex: 1, backgroundColor: 'black'},
  body: {fontFamily: HOME_FONT.regular},
  medium: {fontFamily: HOME_FONT.medium},
  bold: {fontFamily: HOME_FONT.bold},
  title: {fontFamily: HOME_FONT.heading, fontSize: 22, color: 'white'},
});
