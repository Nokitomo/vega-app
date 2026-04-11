/* global browser */

(function () {
  function send(message) {
    return browser.runtime.sendMessage({
      type: 'page_message',
      source: 'messaging.js',
      payload: message,
      timestamp: Date.now(),
    });
  }

  if (typeof window !== 'undefined') {
    window.VegaGeckoBridge = {
      send,
    };
  }
})();
