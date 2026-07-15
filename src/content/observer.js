/**
 * @fileoverview MutationObserver-based DOM watcher for YouTube.
 * Sets window.SS_DOMObserver.
 */
(function () {
  'use strict';

  var C = window.SS_CONST;
  var Logger = window.SS_Logger;
  if (!C || !Logger) { console.error('[SS] Observer: dependencies not loaded'); return; }

  var log = Logger('Observer');

  /**
   * @param {object} deps
   * @param {object} deps.videoManager
   * @param {object} deps.navigationManager
   */
  function DOMObserver(deps) {
    this._videoManager = deps.videoManager;
    this._navigationManager = deps.navigationManager;
    this._observer = null;
    this._destroyed = false;
    this._pendingNav = null;
  }

  DOMObserver.prototype.start = function () {
    if (this._observer) return;

    var self = this;
    var target = this._getTarget();
    if (!target) {
      log.warn('Observer target not found, retrying…');
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(function () { self.start(); }, { timeout: 2000 });
      } else {
        setTimeout(function () { self.start(); }, 2000);
      }
      return;
    }

    this._observer = new MutationObserver(function (mutations) {
      if (self._destroyed) return;
      self._handleMutations(mutations);
    });

    this._observer.observe(target, C.OBSERVER_CONFIG);
    log.info('Observer started on', target.tagName);
  };

  DOMObserver.prototype.destroy = function () {
    this._destroyed = true;
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    if (this._pendingNav !== null) {
      cancelIdleCallback(this._pendingNav);
      this._pendingNav = null;
    }
    log.debug('Observer destroyed');
  };

  DOMObserver.prototype.reEvaluate = function () {
    this._videoManager.findVideo();
  };

  /** @private @returns {Node|null} */
  DOMObserver.prototype._getTarget = function () {
    var app = document.querySelector(C.YT_SELECTORS.APP);
    if (app) return app;
    var musicApp = document.querySelector(C.YT_SELECTORS.MUSIC_APP);
    if (musicApp) return musicApp;
    return document.body;
  };

  /** @private @param {MutationRecord[]} mutations */
  DOMObserver.prototype._handleMutations = function (mutations) {
    var videoChanged = false;

    for (var m = 0; m < mutations.length; m++) {
      var mutation = mutations[m];

      for (var i = 0; i < mutation.addedNodes.length; i++) {
        var node = mutation.addedNodes[i];
        if (node.nodeName === 'VIDEO' || (node.querySelector && node.querySelector('video'))) {
          videoChanged = true;
          break;
        }
      }

      if (!videoChanged) {
        for (var j = 0; j < mutation.removedNodes.length; j++) {
          var rnode = mutation.removedNodes[j];
          if (rnode.nodeName === 'VIDEO' || (rnode.querySelector && rnode.querySelector('video'))) {
            videoChanged = true;
            break;
          }
        }
      }

      if (videoChanged) break;
    }

    if (videoChanged) {
      this._debouncedNavDetection();
    }
  };

  /** @private */
  DOMObserver.prototype._debouncedNavDetection = function () {
    var self = this;
    if (this._pendingNav !== null) {
      if (typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(this._pendingNav);
      } else {
        clearTimeout(this._pendingNav);
      }
      this._pendingNav = null;
    }
    if (typeof requestIdleCallback === 'function') {
      this._pendingNav = requestIdleCallback(function () {
        self._pendingNav = null;
        self._videoManager.findVideo();
      }, { timeout: 1000 });
    } else {
      this._pendingNav = setTimeout(function () {
        self._pendingNav = null;
        self._videoManager.findVideo();
      }, 500);
    }
  };

  window.SS_DOMObserver = DOMObserver;
})();
