/**
 * @fileoverview Scoped logger. DEBUG gated by debugMode flag.
 * Sets window.SS_Logger.
 */
(function () {
  'use strict';

  const LOG_LEVELS = Object.freeze({
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  });

  const PREFIX = '[SS]';

  /**
   * @param {string} scope
   * @param {boolean} [debugMode=false]
   * @returns {{debug: Function, info: Function, warn: Function, error: Function}}
   */
  function Logger(scope, debugMode) {
    if (debugMode === undefined) debugMode = false;
    const ts = () => new Date().toISOString().slice(11, 23);

    function log(level) {
      if (level < LOG_LEVELS.INFO && !debugMode) return;
      const label = Object.keys(LOG_LEVELS).find(function (k) {
        return LOG_LEVELS[k] === level;
      });
      var args = Array.prototype.slice.call(arguments, 1);
      args.unshift(ts() + ' ' + PREFIX + ' [' + label + '] [' + scope + ']');
      console.log.apply(console, args);
    }

    return Object.freeze({
      debug: function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(LOG_LEVELS.DEBUG);
        log.apply(null, args);
      },
      info: function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(LOG_LEVELS.INFO);
        log.apply(null, args);
      },
      warn: function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(LOG_LEVELS.WARN);
        log.apply(null, args);
      },
      error: function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(LOG_LEVELS.ERROR);
        log.apply(null, args);
      },
    });
  }

  window.SS_Logger = Logger;
})();
