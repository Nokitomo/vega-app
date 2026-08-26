module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '\\.(css)$': '<rootDir>/__mocks__/styleMock.js',
    '^react-native-mmkv-storage$': '<rootDir>/__mocks__/mmkvStorageMock.js',
    '^@dr\\.pogodin/react-native-fs$':
      '<rootDir>/__mocks__/reactNativeFsMock.js',
    '^expo-file-system/legacy$':
      '<rootDir>/__mocks__/expoFileSystemLegacyMock.js',
    '^expo-crypto$': '<rootDir>/__mocks__/expoCryptoMock.js',
    '^@expo/vector-icons(?:/.*)?$':
      '<rootDir>/__mocks__/expoVectorIconsMock.js',
    '^react-native-haptic-feedback$':
      '<rootDir>/__mocks__/hapticFeedbackMock.js',
    '^@notifee/react-native$': '<rootDir>/__mocks__/notifeeMock.js',
    '^@himanshu8443/react-native-apk-installer$':
      '<rootDir>/__mocks__/apkInstallerMock.js',
  },
};
