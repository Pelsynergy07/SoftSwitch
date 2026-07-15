/**
 * @fileoverview Detects non-click YouTube navigation and instantly mutes
 * the current video before YouTube destroys it.
 *
 * For click-based navigations, see ClickInterceptor.
 *
 * This handles: autoplay, keyboard (Shift+N/P), browser history,
 * and programmatic pushState/replaceState.
 *
 * The mute handler fires BEFORE the original history.pushState
 * so we can set video.volume = 0 while the element still exists.
 *
 * Sets window.SS_NavigationManager.
 */
(function () {
  'use strict';

  var Logger = window.SS_Logger;
  if (!Logger) { console.error('[SS] Navigation: Logger not loaded'); return; }

  console.log('[SS] Navigation module loaded');

  var log = Logger('Navigation');

  function NavigationManager(deps) {
    this._videoManager = deps.videoManager;
    this._controller = deps.controller;
    this._settings = deps.settings;
    this._listeners = [];
    this._destroyed = false;
    this._unpatchHistory = null;
    this._abortController = null;
  }

  /** @param {function} fn */
  NavigationManager.prototype.onNavigate = function (fn) {
    if (this._listeners.indexOf(fn) === -1) {
      this._listeners.push(fn);
    }
  };

  /** @param {function} fn */
  NavigationManager.prototype.offNavigate = function (fn) {
    var idx = this._listeners.indexOf(fn);
    if (idx !== -1) this._listeners.splice(idx, 1);
  };

  NavigationManager.prototype.start = function () {
    if (this._destroyed) return;

    var self = this;
    this._abortController = new AbortController();
    var signal = this._abortController.signal;

    window.addEventListener('popstate', function () { self._onNavigate(); }, { signal: signal });
    this._patchHistory();
    document.addEventListener('keydown', function (e) { self._onKeyDown(e); }, { signal: signal });

    log.info('NavigationManager started');
  };

  NavigationManager.prototype.destroy = function () {
    this._destroyed = true;
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    if (this._unpatchHistory) {
      this._unpatchHistory();
      this._unpatchHistory = null;
    }
    this._listeners = [];
    log.debug('NavigationManager destroyed');
  };

  /** @private */
  NavigationManager.prototype._onNavigate = function () {
    if (this._destroyed) return;
    this._muteCurrentVideo();
    this._emit();
  };

  /** @private @param {KeyboardEvent} e */
  NavigationManager.prototype._onKeyDown = function (e) {
    if (e.shiftKey && (e.key === 'N' || e.key === 'P')) {
      var self = this;
      requestAnimationFrame(function () {
        if (!self._destroyed) {
          self._muteCurrentVideo();
          self._emit();
        }
      });
    }
  };

  /**
   * Monkey-patch pushState/replaceState.
   * Runs mute + notify BEFORE the original function.
   * @private
   */
  NavigationManager.prototype._patchHistory = function () {
    var self = this;
    var origPush = history.pushState.bind(history);
    var origReplace = history.replaceState.bind(history);

    history.pushState = function () {
      self._muteCurrentVideo();
      self._emit();
      origPush.apply(history, arguments);
    };

    history.replaceState = function () {
      self._muteCurrentVideo();
      self._emit();
      origReplace.apply(history, arguments);
    };

    this._unpatchHistory = function () {
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  };

  /**
   * Mute the current video instantly AND persist the user's volume.
   * @private
   */
  NavigationManager.prototype._muteCurrentVideo = function () {
    var video = this._videoManager.getVideo();
    if (!video) return;

    try {
      var vol = this._controller.saveCurrentVolume(video);
      if (vol > 0) {
        this._settings.preferredVolume = vol;
      }
      this._controller.setVolume(video, 0);
      log.info('Muted instantly (' + Math.round(vol * 100) + '% → 0)');
    } catch (err) {
      log.warn('Failed to mute', err);
    }
  };

  /** @private */
  NavigationManager.prototype._emit = function () {
    for (var i = 0; i < this._listeners.length; i++) {
      try {
        this._listeners[i]();
      } catch (err) {
        log.error('Navigation callback error', err);
      }
    }
  };

  window.SS_NavigationManager = NavigationManager;
})();
