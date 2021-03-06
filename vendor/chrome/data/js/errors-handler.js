(function (window, HandsomeTrello) {
  'use strict';

  function sendError(e) {
    var xhr = new XMLHttpRequest();

    xhr.open('POST', 'https://api.airtable.com/v0/appubz6id6ulcTeUr/Errors', true);

    xhr.setRequestHeader('Authorization', 'Bearer keyU9uhDHsoLen1Gs');
    xhr.setRequestHeader('Content-type', 'application/json');

    xhr.send(JSON.stringify({
      fields: {
        Message: e.message,
        Date: new Date().toISOString(),
        Version: chrome.runtime.getManifest().version,
        Notes: e.stack,
        Browser: navigator.userAgent,
        URL: window.location.href
      }
    }));
  }

  function wrap(func) {
    if (!func._wrapped) {
      func._wrapped = function () {
        try {
          func.apply(this, arguments);
        } catch (e) {
          sendError(e);
        }
      }
    }
    return func._wrapped;
  }

  loadSettings(HandsomeTrello.settings.options, function (options) {
    if (options.sendAnonymousStatistics) {
      var addEventListener = window.EventTarget.prototype.addEventListener;
      window.EventTarget.prototype.addEventListener = function (event, callback, bubble) {
        addEventListener.call(this, event, wrap(callback), bubble);
      };
    }
  });

})(window, HandsomeTrello);
