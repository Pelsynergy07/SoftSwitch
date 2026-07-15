/**
 * @fileoverview Ensures only one fade animation runs at a time.
 * Sets window.SS_FadeScheduler.
 */
(function () {
  'use strict';

  var Logger = window.SS_Logger;
  if (!Logger) { console.error('[SS] FadeScheduler: Logger not loaded'); return; }

  var log = Logger('FadeScheduler');

  /**
   * @param {object} controller - FadeController instance
   */
  function FadeScheduler(controller) {
    this._controller = controller;
    this._currentFade = null;
  }

  FadeScheduler.prototype.schedule = async function (fadeFn) {
    this._controller.stopFade();
    this._currentFade = null;

    this._currentFade = fadeFn();

    try {
      await this._currentFade;
    } catch (err) {
      log.error('Scheduled fade failed', err);
    } finally {
      this._currentFade = null;
    }
  };

  FadeScheduler.prototype.cancel = function () {
    this._controller.stopFade();
    this._currentFade = null;
  };

  Object.defineProperty(FadeScheduler.prototype, 'busy', {
    get: function () { return this._currentFade !== null; },
  });

  window.SS_FadeScheduler = FadeScheduler;
})();
