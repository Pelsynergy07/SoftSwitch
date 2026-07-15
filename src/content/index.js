/**
 * @fileoverview Main content script – wires together all modules.
 */
(function () {
  'use strict';

  console.log('[SS] index.js loaded');

  var Settings = window.SS_Settings;
  var VideoManager = window.SS_VideoManager;
  var NavigationManager = window.SS_NavigationManager;
  var DOMObserver = window.SS_DOMObserver;
  var FadeController = window.SS_FadeController;
  var FadeScheduler = window.SS_FadeScheduler;
  var ClickInterceptor = window.SS_ClickInterceptor;
  var Logger = window.SS_Logger;

  if (!Settings) { console.error('[SS] Missing: Settings'); return; }
  if (!VideoManager) { console.error('[SS] Missing: VideoManager'); return; }
  if (!NavigationManager) { console.error('[SS] Missing: NavigationManager'); return; }
  if (!DOMObserver) { console.error('[SS] Missing: DOMObserver'); return; }
  if (!FadeController) { console.error('[SS] Missing: FadeController'); return; }
  if (!FadeScheduler) { console.error('[SS] Missing: FadeScheduler'); return; }
  if (!ClickInterceptor) { console.error('[SS] Missing: ClickInterceptor'); return; }
  if (!Logger) { console.error('[SS] Missing: Logger'); return; }

  console.log('[SS] All dependencies loaded');

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  var settings = null;
  var videoManager = null;
  var navigationManager = null;
  var clickInterceptor = null;
  var observer = null;
  var controller = null;
  var scheduler = null;
  var log = null;

  var _initialised = false;
  var _initError = null;
  var _pendingFadeIn = false;

  // ---------------------------------------------------------------------------
  // Message listener – registered immediately so popup always gets a reply
  // ---------------------------------------------------------------------------

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    switch (msg.type) {
      case 'GET_STATUS':
        if (!_initialised) {
          sendResponse({
            status: _initError ? 'Error: ' + _initError : 'Initialising…',
            videoDetected: false,
            volume: null,
          });
        } else {
          sendResponse(getStatus());
        }
        break;
      case 'SETTINGS_UPDATED':
        if (settings && msg.payload) {
          for (var pk in msg.payload) {
            if (msg.payload.hasOwnProperty(pk)) {
              settings[pk] = msg.payload[pk];
            }
          }
        }
        break;
    }
  });

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  async function init() {
    if (_initialised) return;

    try {
      settings = await Settings.getAll();
    } catch (err) {
      console.error('[SS] Failed to load settings:', err);
      _initError = String(err);
      return;
    }

    log = Logger('Content', settings.debug);
    log.info('Settings loaded, enabled=' + settings.enabled);

    // Check sessionStorage BEFORE waitForVideo so handleNewVideo knows
    // not to touch volume on a pending fade-in page load
    var _pendingVolume = null;
    try {
      var stored = sessionStorage.getItem('ss_fadeTarget');
      if (stored !== null) {
        _pendingVolume = parseFloat(stored);
        sessionStorage.removeItem('ss_fadeTarget');
        if (_pendingVolume > 0) {
          _pendingFadeIn = true;
          settings.preferredVolume = _pendingVolume;
          log.info('Pending fade-in to ' + Math.round(_pendingVolume * 100) + '%');
        }
      }
    } catch (e) { /* sessionStorage unavailable */ }

    controller = new FadeController();
    scheduler = new FadeScheduler(controller);

    videoManager = new VideoManager();

    navigationManager = new NavigationManager({
      videoManager: videoManager,
      controller: controller,
      settings: settings,
    });

    clickInterceptor = new ClickInterceptor({
      videoManager: videoManager,
      controller: controller,
      settings: settings,
    });

    observer = new DOMObserver({
      videoManager: videoManager,
      navigationManager: navigationManager,
    });

    // --- New video detected → restore volume ---
    videoManager.onChange(function (video, prev) {
      if (!settings.enabled) return;
      if (_pendingFadeIn) return; // init will handle the fade-in
      if (video && !prev) {
        handleNewVideo(video);
      } else if (!video && prev && log) {
        log.info('Video removed');
      }
    });

    // --- Settings changes from storage ---
    Settings.onChange(function (changed) {
      for (var k in changed) {
        if (changed.hasOwnProperty(k)) {
          settings[k] = changed[k];
        }
      }
      if (changed.debug !== undefined && log) {
        log = Logger('Content', settings.debug);
      }
      if (log) log.debug('Settings updated', changed);
    });

    // --- Start watchers ---
    navigationManager.start();
    clickInterceptor.start();
    observer.start();

    // --- Find any existing video ---
    var existing = await videoManager.waitForVideo();
    if (existing && settings.enabled) {
      if (_pendingFadeIn && _pendingVolume > 0) {
        // Coming from a ClickInterceptor fade-out — fade in
        controller.setVolume(existing, 0);
        log.info('Fading in to ' + Math.round(_pendingVolume * 100) + '%');
        scheduler.schedule(function () {
          _pendingFadeIn = false;
          return controller.fadeIn(existing, _pendingVolume, settings.fadeDuration, settings.fadeCurve);
        });
      } else {
        // First-run capture: if the user's YouTube volume differs from default,
        // save it as their preferred volume
        var currentVol = controller.getVolume(existing);
        if (settings.preferredVolume === 1 && currentVol > 0 && currentVol < 0.99) {
          settings.preferredVolume = currentVol;
          log.info('Captured initial volume: ' + Math.round(currentVol * 100) + '%');
        }
        // Restore volume (handleNewVideo via onChange may also do this, but
        // restoreVolume is idempotent)
        restoreVolume(existing);
      }
    }

    _initialised = true;
    if (log) log.info('Content script initialised');
  }

  // ---------------------------------------------------------------------------
  // Volume helpers
  // ---------------------------------------------------------------------------

  function restoreVolume(video) {
    var target = settings.preferredVolume !== undefined ? settings.preferredVolume : 1;
    var current = controller.getVolume(video);
    if (Math.abs(current - target) > 0.01) {
      controller.setVolume(video, target);
    }
  }

  // ---------------------------------------------------------------------------
  // New video handling
  // ---------------------------------------------------------------------------

  function handleNewVideo(video) {
    var targetVol = settings.preferredVolume !== undefined ? settings.preferredVolume : 1;
    var currentVol = controller.getVolume(video);

    if (log) {
      log.info(
        'New video @ ' + Math.round(currentVol * 100) + '%, target ' +
        Math.round(targetVol * 100) + '%'
      );
    }

    // If volume is near zero (muted by NavigationManager), fade in
    if (currentVol < 0.01) {
      if (log) log.info('Volume near zero — fading in');
      scheduler.schedule(function () {
        return controller.fadeIn(video, targetVol, settings.fadeDuration, settings.fadeCurve);
      });
      return;
    }

    // If volume differs from target, restore the user's preferred volume
    if (Math.abs(currentVol - targetVol) > 0.01) {
      if (log) log.info('Restoring volume to ' + Math.round(targetVol * 100) + '%');
      controller.setVolume(video, targetVol);
    } else {
      if (log) log.info('Volume already at target');
    }
  }

  // ---------------------------------------------------------------------------
  // Status (for popup)
  // ---------------------------------------------------------------------------

  function getStatus() {
    var video = videoManager ? videoManager.getVideo() : null;

    var status = 'Waiting for video';
    if (!settings.enabled) status = 'Disabled';
    else if (video && controller && controller.active) {
      if (controller.getVolume(video) === 0) status = 'Fading out';
      else status = 'Fading in';
    } else if (video && video.readyState >= 3) status = 'Ready';
    else if (video) status = 'Video detected';

    return {
      status: status,
      videoDetected: !!video,
      volume: video ? controller.getVolume(video) : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  function boot() {
    init().catch(function (err) {
      console.error('[SS] init failed:', err);
      _initError = String(err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
