/**
 * @fileoverview Application-wide constants.
 * Loaded first. All values on window.SS_CONST.
 */
(function () {
  'use strict';

  const C = {};

  C.EXTENSION_NAME = 'SoftSwitch';
  C.EXTENSION_VERSION = '1.0.0';

  C.DEFAULTS = Object.freeze({
    ENABLED: true,
    FADE_DURATION: 700,
    FADE_CURVE: 'easeInOut',
    PREFERRED_VOLUME: 1,
    DEBUG: false,
  });

  C.FADE_DURATION_MIN = 100;
  C.FADE_DURATION_MAX = 3000;
  C.FADE_DURATION_STEP = 50;

  C.CURVES = Object.freeze(['linear', 'easeIn', 'easeOut', 'easeInOut']);

  C.READY_STATE_THRESHOLD = 3;

  C.VIDEO_RETRY_INTERVAL = 500;
  C.VIDEO_RETRY_MAX_ATTEMPTS = 10;

  C.OBSERVER_CONFIG = Object.freeze({
    childList: true,
    subtree: true,
  });

  C.STATUS = Object.freeze({
    WAITING: 'Waiting for video',
    DETECTED: 'Video detected',
    FADING_OUT: 'Fading out',
    WAITING_PLAYBACK: 'Waiting for playback',
    FADING_IN: 'Fading in',
    READY: 'Ready',
    DISABLED: 'Disabled',
  });

  C.STORAGE_KEYS = Object.freeze({
    ENABLED: 'softswitch_enabled',
    FADE_DURATION: 'softswitch_fadeDuration',
    FADE_CURVE: 'softswitch_fadeCurve',
    PREFERRED_VOLUME: 'softswitch_preferredVolume',
    DEBUG: 'softswitch_debug',
  });

  C.YT_SELECTORS = Object.freeze({
    VIDEO: 'video.video-stream.html5-main-video',
    APP: 'ytd-app',
    MUSIC_APP: 'ytmusic-app',
  });

  window.SS_CONST = C;
})();
