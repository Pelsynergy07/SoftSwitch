/**
 * @fileoverview Invisible overlay-based click interceptor.
 *
 * Strategy (per user's design):
 *
 * 1. An invisible <div> covers the entire viewport.
 *    Normally it has pointer-events: none (events pass through).
 *
 * 2. When the user clicks a video link, we detect it via a
 *    capture-phase pointerdown on window.
 *
 * 3. IMMEDIATELY we switch the overlay to pointer-events: auto.
 *    YouTube receives ZERO events from this point — no pointerdown,
 *    no mousedown, no mouseup, no click, nothing. The overlay
 *    physically swallows every subsequent event.
 *
 * 4. We fade the current video's volume from its current level
 *    down to 0 over the user-configured fade duration
 *    (default 700ms, never exceeding the configured max).
 *
 * 5. After the fade completes we set the overlay back to
 *    pointer-events: none and navigate to the target URL
 *    via window.location.href.
 *
 * 6. The new page loads. The content script re-injects and
 *    fades the new video in from 0 to the saved volume.
 *
 * Benefits over event-blocking only:
 *  - The overlay is a PHYSICAL barrier. YouTube cannot receive
 *    ANY event, not just the one we blocked.
 *  - No race condition with YouTube's capture listeners.
 *  - Full 700ms+ available for the fade — no rush.
 *  - Works regardless of YouTube's internal event architecture.
 *
 * Sets window.SS_ClickInterceptor.
 */
(function () {
  'use strict';

  var Logger = window.SS_Logger;
  if (!Logger) { console.error('[SS] ClickInterceptor: Logger not loaded'); return; }

  console.log('[SS] ClickInterceptor module loaded');

  var log = Logger('ClickInterceptor');

  // ---------------------------------------------------------------------------
  // Overlay element
  // ---------------------------------------------------------------------------

  var OVERLAY_ID = 'ss-invisible-overlay';

  /**
   * Create (or return existing) invisible overlay.
   * @returns {HTMLDivElement}
   */
  function getOverlay() {
    var existing = document.getElementById(OVERLAY_ID);
    if (existing) return existing;

    var div = document.createElement('div');
    div.id = OVERLAY_ID;
    div.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;' +
      'pointer-events:none;background:transparent;opacity:0;';
    document.documentElement.appendChild(div);
    return div;
  }

  // ---------------------------------------------------------------------------
  // ClickInterceptor
  // ---------------------------------------------------------------------------

  function ClickInterceptor(deps) {
    this._videoManager = deps.videoManager;
    this._controller = deps.controller;
    this._settings = deps.settings;
    this._active = false;
    this._navTimer = null;
    this._overlay = null;
    this._boundPointerDown = this._onPointerDown.bind(this);
  }

  ClickInterceptor.prototype.start = function () {
    if (this._active) return;
    this._overlay = getOverlay();
    window.addEventListener('pointerdown', this._boundPointerDown, true);
    this._active = true;
    log.info('Started (invisible overlay, window capture pointerdown)');
  };

  ClickInterceptor.prototype.stop = function () {
    if (!this._active) return;
    window.removeEventListener('pointerdown', this._boundPointerDown, true);
    this._releaseOverlay();
    this._clearNav();
    this._active = false;
    log.info('Stopped');
  };

  ClickInterceptor.prototype.destroy = function () {
    this.stop();
  };

  // ---------------------------------------------------------------------------
  // Capture handler
  // ---------------------------------------------------------------------------

  /**
   * pointerdown capture on window — fires BEFORE any of YouTube's handlers.
   * @private @param {PointerEvent} e
   */
  ClickInterceptor.prototype._onPointerDown = function (e) {
    // Only left button, no modifiers
    if (e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    // If overlay is already active, ignore (nested events during fade)
    if (this._overlay && this._overlay.style.pointerEvents === 'auto') return;

    var result = this._resolveLink(e);
    if (!result) return;

    var video = this._videoManager.getVideo();
    if (!video) {
      log.debug('No video element — not intercepting');
      return;
    }

    log.info('INTERCEPTING click on [' + result.href + ']');

    // 1. Activate overlay — YouTube receives NOTHING from this point onward
    this._activateOverlay();

    // 2. Save current volume
    var fromVol = this._controller.saveCurrentVolume(video);
    if (fromVol > 0) {
      this._settings.preferredVolume = fromVol;
    }

    // 3. Fade out over the configured duration
    var duration = Math.min(
      this._settings.fadeDuration || 700,
      3000 // safety cap
    );

    log.info(
      'Fading ' + Math.round(fromVol * 100) + '% → 0 over ' + duration + 'ms'
    );

    this._controller.fadeOut(video, fromVol, duration, this._settings.fadeCurve);

    // 4. Store volume in sessionStorage so the new page knows to fade in
    try {
      sessionStorage.setItem('ss_fadeTarget', String(fromVol));
    } catch (e) { /* sessionStorage may be unavailable */ }

    // 5. Safety timeout — release overlay + navigate even if something stalls
    this._clearNav();

    var self = this;
    this._navTimer = setTimeout(function () {
      self._navTimer = null;
      self._releaseOverlay();
      log.info('Navigating to [' + result.href + ']');
      window.location.href = result.link.href;
    }, duration + 50); // +50ms buffer for RAF to finish
  };

  // ---------------------------------------------------------------------------
  // Overlay helpers
  // ---------------------------------------------------------------------------

  /** @private */
  ClickInterceptor.prototype._activateOverlay = function () {
    if (this._overlay) {
      this._overlay.style.pointerEvents = 'auto';
    }
  };

  /** @private */
  ClickInterceptor.prototype._releaseOverlay = function () {
    if (this._overlay) {
      this._overlay.style.pointerEvents = 'none';
    }
  };

  /** @private */
  ClickInterceptor.prototype._clearNav = function () {
    if (this._navTimer !== null) {
      clearTimeout(this._navTimer);
      this._navTimer = null;
    }
  };

  // ---------------------------------------------------------------------------
  // Link resolution
  // ---------------------------------------------------------------------------

  /**
   * Check if the event target is a video link.
   * @private @param {Event} e
   * @returns {{ link: HTMLAnchorElement, href: string }|null}
   */
  ClickInterceptor.prototype._resolveLink = function (e) {
    var link = e.target.closest('a');
    if (!link) return null;

    var href = link.getAttribute('href');
    if (!href) return null;

    if (!this._isVideoNavigation(link, href)) return null;
    if (link.getAttribute('target') === '_blank') return null;

    return { link: link, href: href };
  };

  /**
   * Determine whether clicking this link navigates to a video page.
   * @private @param {HTMLAnchorElement} link
   * @param {string} href
   * @returns {boolean}
   */
  ClickInterceptor.prototype._isVideoNavigation = function (link, href) {
    if (href.indexOf('/watch') !== -1) return true;
    if (href.indexOf('/shorts') !== -1) return true;
    if (href.indexOf('youtu.be') !== -1) return true;
    if (href.indexOf('/playlist') !== -1) return true;

    if (href.indexOf('/') === 0) {
      var path = href.split('?')[0];
      if (path === '/watch' || path.indexOf('/shorts') === 0) return true;
    }

    var resolved = link.href;
    if (resolved && resolved.indexOf('/watch') !== -1) return true;

    return false;
  };

  window.SS_ClickInterceptor = ClickInterceptor;
})();
