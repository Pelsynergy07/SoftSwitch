/**
 * @fileoverview Tracks the active <video> element on YouTube.
 * Sets window.SS_VideoManager.
 *
 * Uses multiple query strategies to find the video element,
 * including Shadow DOM traversal.
 */
(function () {
  'use strict';

  var C = window.SS_CONST;
  var Logger = window.SS_Logger;
  if (!C || !Logger) { console.error('[SS] VideoManager: dependencies not loaded'); return; }

  console.log('[SS] VideoManager module loaded');

  var log = Logger('VideoManager');

  function VideoManager() {
    this._video = null;
    this._listeners = [];
    this._destroyed = false;
  }

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
