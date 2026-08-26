/**
 * @format
 */

import 'react-native';
import React, {act} from 'react';
import {it, jest} from '@jest/globals';

jest.mock('react-native-screens', () => {
  const screens = jest.requireActual<typeof import('react-native-screens')>(
    'react-native-screens',
  );
  return {...screens, enableFreeze: jest.fn(), enableScreens: jest.fn()};
});
jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: {hide: jest.fn(async () => undefined)},
}));
jest.mock('react-native-orientation-locker', () => ({
  __esModule: true,
  default: {
    lockToLandscape: jest.fn(),
    lockToPortrait: jest.fn(),
    unlockAllOrientations: jest.fn(),
  },
}));
jest.mock('../src/screens/home/Home', () => () => null);
jest.mock('../src/screens/home/Info', () => () => null);
jest.mock('../src/screens/home/Player', () => () => null);
jest.mock('../src/screens/settings/Settings', () => () => null);
jest.mock('../src/screens/WatchList', () => () => null);
jest.mock('../src/screens/Search', () => () => null);
jest.mock('../src/screens/ScrollList', () => () => null);
jest.mock('../src/screens/WebView', () => () => null);
jest.mock('../src/screens/SearchResults', () => () => null);
jest.mock('../src/screens/settings/About', () => ({
  __esModule: true,
  checkForUpdate: jest.fn(async () => undefined),
  cleanupDownloadedUpdateApk: jest.fn(async () => undefined),
  default: () => null,
}));
jest.mock('../src/screens/settings/Preference', () => () => null);
jest.mock('../src/screens/settings/Downloads', () => () => null);
jest.mock('../src/screens/settings/SeriesEpisodes', () => () => null);
jest.mock('../src/screens/WatchHistory', () => () => null);
jest.mock('../src/screens/settings/SubtitleSettings', () => () => null);
jest.mock('../src/screens/settings/Extensions', () => () => null);
jest.mock('../src/components/WafWebViewDialog', () => () => null);
jest.mock('../src/lib/services/UpdateProviders', () => ({
  updateProvidersService: {
    startAutomaticUpdateCheck: jest.fn(),
    stopAutomaticUpdateCheck: jest.fn(),
  },
}));

const App =
  jest.requireActual<typeof import('../src/App')>('../src/App').default;

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

it('renders correctly', async () => {
  let app: ReturnType<typeof renderer.create> | undefined;

  await act(async () => {
    app = renderer.create(<App />);
  });

  await act(async () => {
    app?.unmount();
  });
});
