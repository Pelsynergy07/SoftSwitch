/**
 * @fileoverview Detects non-click YouTube / YT Music navigation and
 * fades (or mutes) the current video before navigation proceeds.
 *
 * For click-based navigations, see ClickInterceptor.
 *
 * Three navigation paths:
 *
 * 1. pushState / replaceState (clicking Up Next on YT Music, autoplay)
 *    → Fades out current video (capped at 500ms) then calls origPush
 *    → YouTube's SPA navigation loads the next song
 *    → DOMObserver detects new video → handleNewVideo fades in
 *
 * 2. popstate (browser back/forward)
 *    → Instant mute (navigation already happened)
 *
 * 3. Keyboard (Shift+N/P on YouTube)
 *    → Instant mute (navigation already in progress)
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
    this._scheduler = deps.scheduler;
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

    window.addEventListener('popstate', function () { self._onPopState(); }, { signal: signal });
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

  /** @private — popstate fires after navigation, so just mute */
  NavigationManager.prototype._onPopState = function () {
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
   *
   * SPA navigation (YT Music Up Next, autoplay):
   *   - Save volume to sessionStorage for fade-in on next page
   *   - Start a non-blocking async fade-out (RAF runs in the background)
   *   - Call origPush immediately — DO NOT block YT Music's navigation
   *
   * We do NOT block because YT Music stops the old audio on click and
   * waits for pushState to return before loading the next song. Blocking
   * would create dead silence (no old audio, no new yet).
   * @private
   */
  NavigationManager.prototype._patchHistory = function () {
    var self = this;
    var origPush = history.pushState.bind(history);
    var origReplace = history.replaceState.bind(history);

    history.pushState = function () {
      self._fadeOutAsync();
      self._emit();
      origPush.apply(history, arguments);
    };

    history.replaceState = function () {
      self._fadeOutAsync();
      self._emit();
      origReplace.apply(history, arguments);
    };

    this._unpatchHistory = function () {
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  };

  /**
   * Start an async fade-out (non-blocking). Called from patched pushState.
   * Does NOT overwrite preferredVolume — the ClickInterceptor's preemptive
   * fade (or _muteCurrentVideo) already set it to the correct original value.
   * @private
   */
  NavigationManager.prototype._fadeOutAsync = function () {
    var self = this;
    var video = this._videoManager.getVideo();
    if (!video) return;

    try {
      var currentVol = video.volume;
      if (currentVol < 0.01) return;

      var duration = Math.min(this._settings.fadeOutDuration || 700, 500);
      log.info('Async fade-out (' + Math.round(currentVol * 100) + '% → 0 over ' + duration + 'ms)');

      this._scheduler.schedule(function () {
        return self._controller.fadeOut(video, currentVol, duration, self._settings.fadeCurve);
      });
    } catch (err) {
      log.warn('Async fade-out failed', err);
    }
  };

  /**
   * Mute the current video instantly AND persist the user's volume.
   * Used for popstate and keyboard where navigation is already in flight.
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
