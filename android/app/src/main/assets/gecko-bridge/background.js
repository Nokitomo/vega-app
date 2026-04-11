/* global browser */

const NATIVE_APP = 'vega_bridge';

function sendToNative(payload) {
  return browser.runtime.sendNativeMessage(NATIVE_APP, payload).catch(() => null);
}

sendToNative({
  type: 'bridge_ready',
  source: 'background',
  timestamp: Date.now(),
});

browser.runtime.onMessage.addListener(message =>
  sendToNative({
    type: 'runtime_message',
    source: 'background',
    timestamp: Date.now(),
    payload: message,
  }),
);
