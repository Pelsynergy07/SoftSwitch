/**
 * @fileoverview Animates `video.volume` using requestAnimationFrame.
 * Sets window.SS_FadeController.
 */
(function () {
  'use strict';

  var Easing = window.SS_Easing;
  var Logger = window.SS_Logger;
  if (!Easing || !Logger) { console.error('[SS] FadeController: dependencies not loaded'); return; }

  var log = Logger('FadeController');

  function FadeController() {
    this._rafId = null;
    this._active = false;
  }

  Object.defineProperty(FadeController.prototype, 'active', {
    get: function () { return this._active; },
  });

  /**
   * @param {HTMLMediaElement} video
   * @param {number} fromVolume
   * @param {number} toVolume
   * @param {number} duration
   * @param {string} [curve]
   * @returns {Promise<void>}
   */
  FadeController.prototype.fade = function (video, fromVolume, toVolume, duration, curve) {
    var self = this;
    if (curve === undefined) curve = 'easeInOut';
    return new Promise(function (resolve) {
      self._cancelRaf();

      var easing = Easing.getEasing(curve);
      var startTime = performance.now();
      var delta = toVolume - fromVolume;

      self._active = true;

      function step(now) {
        var elapsed = now - startTime;
        var t = Math.min(elapsed / duration, 1);
        var easedT = easing(t);

        var currentVolume = fromVolume + delta * easedT;
        self._safeSetVolume(video, currentVolume);

        if (t < 1) {
          self._rafId = requestAnimationFrame(step);
        } else {
          self._safeSetVolume(video, toVolume);
          self._active = false;
          self._rafId = null;
          resolve();
        }
      }

      self._rafId = requestAnimationFrame(step);
    });
  };

  /** @param {HTMLMediaElement} video @param {number} fromVolume @param {number} duration @param {string} [curve] */
  FadeController.prototype.fadeOut = function (video, fromVolume, duration, curve) {
    if (curve === undefined) curve = 'easeInOut';
    return this.fade(video, fromVolume, 0, duration, curve);
  };

  /** @param {HTMLMediaElement} video @param {number} toVolume @param {number} duration @param {string} [curve] */
  FadeController.prototype.fadeIn = function (video, toVolume, duration, curve) {
    if (curve === undefined) curve = 'easeInOut';
    return this.fade(video, 0, toVolume, duration, curve);
  };

  FadeController.prototype.stopFade = function () {
    this._cancelRaf();
    this._active = false;
  };

  /** @param {HTMLMediaElement} video @param {number} value */
  FadeController.prototype.setVolume = function (video, value) {
    this._safeSetVolume(video, value);
  };

  /** @param {HTMLVideoElement} video @param {number} volume */
  /** @param {HTMLMediaElement} video @returns {number} */
  FadeController.prototype.getVolume = function (video) {
    try { return video.volume; } catch (e) { return 0; }
  };

  /** @param {HTMLMediaElement} video @returns {number} */
  FadeController.prototype.saveCurrentVolume = function (video) {
    return this.getVolume(video);
  };

  /** @private @param {HTMLMediaElement} video @param {number} value */
  FadeController.prototype._safeSetVolume = function (video, value) {
    try {
      var clamped = Math.min(1, Math.max(0, value));
      video.volume = clamped;
    } catch (err) {
      log.warn('Failed to set volume', err);
    }
  };

  /** @private */
  FadeController.prototype._cancelRaf = function () {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  };

  window.SS_FadeController = FadeController;
})();
