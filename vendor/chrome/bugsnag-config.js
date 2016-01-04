var extensionBugsnag = Bugsnag.noConflict();
extensionBugsnag.apiKey = 'a64b440be2fd46d943437900ce348d7e';
extensionBugsnag.autoNotify = false;
extensionBugsnag.notifyHandler = 'xhr';

(function (window) {
  'use strict';

  function wrap(func) {
    if (!func._wrapped) {
      func._wrapped = function () {
        try {
          func.apply(this, arguments);
        } catch (e) {
          extensionBugsnag.notifyException(e);
        }
      }
    }
    return func._wrapped;
  }

  var addEventListener = window.EventTarget.prototype.addEventListener;
  window.EventTarget.prototype.addEventListener = function (event, callback, bubble) {
    addEventListener.call(this, event, wrap(callback), bubble);
  };

})(window);
