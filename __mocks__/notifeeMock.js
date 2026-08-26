const resolved = value => jest.fn().mockResolvedValue(value);
const notifee = {
  cancelAllNotifications: resolved(undefined),
  cancelNotification: resolved(undefined),
  createChannel: resolved('mock-channel'),
  displayNotification: resolved('mock-notification'),
  onForegroundEvent: jest.fn(() => jest.fn()),
  onBackgroundEvent: jest.fn(),
  requestPermission: resolved({authorizationStatus: 1}),
};

module.exports = {
  __esModule: true,
  AndroidImportance: {DEFAULT: 3, HIGH: 4, LOW: 2, MIN: 1, NONE: 0},
  AuthorizationStatus: {AUTHORIZED: 1, DENIED: 0},
  EventType: {ACTION_PRESS: 2, DISMISSED: 0, PRESS: 1},
  default: notifee,
  ...notifee,
};
