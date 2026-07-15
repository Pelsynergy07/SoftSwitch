/**
 * @fileoverview Read/write extension settings via chrome.storage.sync.
 * Sets window.SS_Settings.
 *
 * Uses callback-based chrome.storage.sync wrapped in Promises for
 * maximum compatibility across Chrome versions.
 */
(function () {
  'use strict';

  var C = window.SS_CONST;
  var Logger = window.SS_Logger;

  if (!C || !Logger) {
    console.error('[SS] Settings: dependencies not loaded');
    return;
  }

  console.log('[SS] Settings module loaded');

  var log = Logger('Settings');

  var KEY_MAP = Object.freeze({
    enabled:             C.STORAGE_KEYS.ENABLED,
    fadeOutDuration:     C.STORAGE_KEYS.FADE_OUT_DURATION,
    fadeInDuration:      C.STORAGE_KEYS.FADE_IN_DURATION,
    fadeCurve:           C.STORAGE_KEYS.FADE_CURVE,
    preferredVolume:     C.STORAGE_KEYS.PREFERRED_VOLUME,
    debug:               C.STORAGE_KEYS.DEBUG,
  });

  var KEY_REVERSE = {};
  for (var k in KEY_MAP) {
    if (KEY_MAP.hasOwnProperty(k)) {
      KEY_REVERSE[KEY_MAP[k]] = k;
    }
  }

  /**
   * Promise-based wrapper for chrome.storage.sync.get.
   * Uses the callback API for maximum compatibility.
   * @param {string|string[]|null} keys
   * @returns {Promise<object>}
   */
  function storageGet(keys) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.sync.get(keys, resolve);
      } catch (err) {
        console.error('[SS] storage.get error:', err);
        resolve({});
      }
    });
  }

  /**
   * Promise-based wrapper for chrome.storage.sync.set.
   * @param {object} obj
   * @returns {Promise<void>}
   */
  function storageSet(obj) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.sync.set(obj, resolve);
      } catch (err) {
        console.error('[SS] storage.set error:', err);
        resolve();
      }
    });
  }

  /**
   * Promise-based wrapper for chrome.storage.sync.remove.
   * @param {string[]} keys
   * @returns {Promise<void>}
   */
  function storageRemove(keys) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.sync.remove(keys, resolve);
      } catch (err) {
        console.error('[SS] storage.remove error:', err);
        resolve();
      }
    });
  }

  /** @returns {Promise<{enabled: boolean, fadeOutDuration: number, fadeInDuration: number, fadeCurve: string, preferredVolume: number, debug: boolean}>} */
  async function getAll() {
    try {
      var raw = await storageGet(null);
      return {
        enabled:             raw[C.STORAGE_KEYS.ENABLED]            !== undefined ? raw[C.STORAGE_KEYS.ENABLED]            : C.DEFAULTS.ENABLED,
        fadeOutDuration:     raw[C.STORAGE_KEYS.FADE_OUT_DURATION]  !== undefined ? raw[C.STORAGE_KEYS.FADE_OUT_DURATION]  : C.DEFAULTS.FADE_OUT_DURATION,
        fadeInDuration:      raw[C.STORAGE_KEYS.FADE_IN_DURATION]   !== undefined ? raw[C.STORAGE_KEYS.FADE_IN_DURATION]   : C.DEFAULTS.FADE_IN_DURATION,
        fadeCurve:           raw[C.STORAGE_KEYS.FADE_CURVE]         !== undefined ? raw[C.STORAGE_KEYS.FADE_CURVE]         : C.DEFAULTS.FADE_CURVE,
        preferredVolume:     raw[C.STORAGE_KEYS.PREFERRED_VOLUME]   !== undefined ? raw[C.STORAGE_KEYS.PREFERRED_VOLUME]   : C.DEFAULTS.PREFERRED_VOLUME,
        debug:               raw[C.STORAGE_KEYS.DEBUG]              !== undefined ? raw[C.STORAGE_KEYS.DEBUG]              : C.DEFAULTS.DEBUG,
      };
    } catch (err) {
      console.error('[SS] getAll error:', err);
      return {
        enabled:             C.DEFAULTS.ENABLED,
        fadeOutDuration:     C.DEFAULTS.FADE_OUT_DURATION,
        fadeInDuration:      C.DEFAULTS.FADE_IN_DURATION,
        fadeCurve:           C.DEFAULTS.FADE_CURVE,
        preferredVolume:     C.DEFAULTS.PREFERRED_VOLUME,
        debug:               C.DEFAULTS.DEBUG,
      };
    }
  }

  /** @param {object} partial */
  async function set(partial) {
    var toStore = {};
    for (var key in partial) {
      if (partial.hasOwnProperty(key) && KEY_MAP[key] !== undefined) {
        toStore[KEY_MAP[key]] = partial[key];
      }
    }
    if (Object.keys(toStore).length > 0) {
      await storageSet(toStore);
      log.debug('Settings saved', toStore);
    }
  }

  async function reset() {
    var toRemove = [];
    for (var sk in C.STORAGE_KEYS) {
      if (C.STORAGE_KEYS.hasOwnProperty(sk)) {
        toRemove.push(C.STORAGE_KEYS[sk]);
      }
    }
    await storageRemove(toRemove);
    log.info('Settings reset to defaults');
  }

  /**
   * @param {function(object): void} cb
   * @returns {function(): void} unsubscribe
   */
  function onChange(cb) {
    function handler(changes, area) {
      if (area !== 'sync') return;
      var parsed = {};
      for (var storageKey in changes) {
        if (changes.hasOwnProperty(storageKey)) {
          var name = KEY_REVERSE[storageKey];
          if (name !== undefined) {
            parsed[name] = changes[storageKey].newValue;
          }
        }
      }
      if (Object.keys(parsed).length > 0) {
        cb(parsed);
      }
    }
    chrome.storage.onChanged.addListener(handler);
    return function () { chrome.storage.onChanged.removeListener(handler); };
  }

  window.SS_Settings = {
    getAll: getAll,
    set: set,
    reset: reset,
    onChange: onChange,
  };
})();
