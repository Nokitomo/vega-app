const React = require('react');
const {View} = require('react-native');

const Icon = props =>
  React.createElement(View, {...props, testID: 'mock-icon'});
const iconNames = [
  'AntDesign',
  'Entypo',
  'Feather',
  'FontAwesome',
  'FontAwesome6',
  'Ionicons',
  'MaterialCommunityIcons',
  'MaterialIcons',
  'Octicons',
];

module.exports = iconNames.reduce((icons, name) => ({...icons, [name]: Icon}), {
  __esModule: true,
  default: Icon,
});
