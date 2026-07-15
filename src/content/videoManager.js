/**
 * @fileoverview Tracks the active media element on YouTube / YouTube Music.
 * Sets window.SS_VideoManager.
 *
 * Uses multiple strategies to find the element:
 *   - DOM queries (YouTube-specific selectors, generic video/audio)
 *   - Shadow DOM traversal (open roots)
 *   - Capture-phase event listeners on window (catches elements in
 *     closed Shadow DOMs — YouTube Music)
 *
 * The event-listener fallback works by listening for `play`, `playing`,
 * and `loadedmetadata` events at window capture phase. Even when a
 * media element is inside a closed Shadow DOM, its events still bubble
 * to window, and e.target gives us a direct reference.
 */
(function () {
  'use strict';

  var C = window.SS_CONST;
  var Logger = window.SS_Logger;
  if (!C || !Logger) { console.error('[SS] VideoManager: dependencies not loaded'); return; }

  console.log('[SS] VideoManager module loaded');

  var log = Logger('VideoManager');

  var MEDIA_EVENTS = ['play', 'playing', 'loadedmetadata'];

  function VideoManager() {
    this._video = null;
    this._listeners = [];
    this._destroyed = false;
    this._boundMediaEvent = null;
  }

  /** Start listening for media events on window capture */
  VideoManager.prototype.startListening = function () {
    if (this._boundMediaEvent) return;
    var self = this;
    this._boundMediaEvent = function (e) {
      self._onMediaEvent(e);
    };
    for (var i = 0; i < MEDIA_EVENTS.length; i++) {
      window.addEventListener(MEDIA_EVENTS[i], this._boundMediaEvent, true);
    }
    log.debug('Media event listener started');
  };

  /** Stop listening for media events */
  VideoManager.prototype.stopListening = function () {
    if (!this._boundMediaEvent) return;
    for (var i = 0; i < MEDIA_EVENTS.length; i++) {
      window.removeEventListener(MEDIA_EVENTS[i], this._boundMediaEvent, true);
    }
    this._boundMediaEvent = null;
    log.debug('Media event listener stopped');
  };

  /**
   * Capture-phase handler — catches media events from closed Shadow DOMs.
   * @private @param {Event} e
   */
  VideoManager.prototype._onMediaEvent = function (e) {
    if (this._destroyed) return;
    var target = e.target;
    if (!target) return;
    var tag = target.tagName;
    if (tag !== 'VIDEO' && tag !== 'AUDIO') return;
    if (target === this._video) return;
    log.info('Media element found via event: <' + tag.toLowerCase() + '>');
    this._setVideo(target);
  };

  /** @param {function} fn */
  VideoManager.prototype.onChange = function (fn) {
    if (this._listeners.indexOf(fn) === -1) {
      this._listeners.push(fn);
    }
  };

  /** @param {function} fn */
  VideoManager.prototype.offChange = function (fn) {
    var idx = this._listeners.indexOf(fn);
    if (idx !== -1) this._listeners.splice(idx, 1);
  };

  /** @returns {HTMLVideoElement|null} */
  VideoManager.prototype.getVideo = function () {
    return this._video;
  };

  /** @returns {Promise<HTMLVideoElement|null>} */
  VideoManager.prototype.findVideo = function () {
    var el = this._queryVideo();
    if (el && el !== this._video) {
      this._setVideo(el);
    } else if (!el && this._video) {
      this._setVideo(null);
    }
    return Promise.resolve(this._video);
  };

  /** @returns {Promise<HTMLVideoElement|null>} */
  VideoManager.prototype.waitForVideo = function () {
    var self = this;
    return new Promise(function (resolve) {
      var attempts = 0;
      function poll() {
        var el = self._queryVideo();
        if (el) {
          if (el !== self._video) self._setVideo(el);
          resolve(el);
          return;
        }
        attempts++;
        if (attempts >= C.VIDEO_RETRY_MAX_ATTEMPTS) {
          log.warn('Video not found after ' + attempts + ' attempts');
          resolve(null);
          return;
        }
        setTimeout(poll, C.VIDEO_RETRY_INTERVAL);
      }
      poll();
    });
  };

  VideoManager.prototype.destroy = function () {
    this._destroyed = true;
    this.stopListening();
    this._listeners = [];
    this._video = null;
    log.debug('destroyed');
  };

  /**
   * Find the active video or audio element using multiple strategies.
   * @private @returns {HTMLMediaElement|null}
   */
  VideoManager.prototype._queryVideo = function () {
    // Strategy 1: YouTube-specific class selector (falls back to generic)
    var el = document.querySelector(C.YT_SELECTORS.VIDEO);
    if (el && el.tagName === 'VIDEO') return el;

    // Strategy 2: Any <video> or <audio> in the document
    el = document.querySelector(C.YT_SELECTORS.AUDIO);
    if (el) return el;

    // Strategy 3: Look inside common YouTube/YT Music containers
    el = document.querySelector(
      '#movie_player video, #player-container video, ' +
      '.html5-video-player video, ' +
      '#player-bar audio, #player audio'
    );
    if (el) return el;

    // Strategy 4: Look inside Shadow DOMs (both video and audio)
    el = this._queryShadowDom(C.YT_SELECTORS.AUDIO);
    if (el) return el;

    return null;
  };

  /**
   * Recursively search Shadow DOM roots for a matching element.
   * @private @param {string} selector
   * @param {Node} [root]
   * @returns {HTMLElement|null}
   */
  VideoManager.prototype._queryShadowDom = function (selector, root) {
    if (root === undefined) root = document.documentElement;
    var el = root.querySelector(selector);
    if (el) return el;

    // Search all elements with Shadow Root
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var shadow = all[i].shadowRoot;
      if (shadow) {
        el = this._queryShadowDom(selector, shadow);
        if (el) return el;
      }
    }
    return null;
  };

  /** @private @param {HTMLVideoElement|null} next */
  VideoManager.prototype._setVideo = function (next) {
    var prev = this._video;
    this._video = next;

    if (prev !== next) {
      log.info('Video changed: ' + (prev ? 'previous' : 'null') + ' → ' + (next ? 'new' : 'null'));
      for (var i = 0; i < this._listeners.length; i++) {
        try {
          this._listeners[i](next, prev);
        } catch (err) {
          log.error('Listener error', err);
        }
      }
    }
  };

  window.SS_VideoManager = VideoManager;
})();
