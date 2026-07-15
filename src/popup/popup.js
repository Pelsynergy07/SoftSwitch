/**
 * @fileoverview Popup UI logic.
 *
 * Loaded after constants.js and settings.js via <script> tags.
 * Uses window.SS_CONST and window.SS_Settings.
 */
(function () {
  'use strict';

  var C = window.SS_CONST;
  var Settings = window.SS_Settings;

  if (!C || !Settings) {
    console.error('[SS] Popup: dependencies not loaded');
    return;
  }

  // ---------------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------------

  var enabledChk     = document.getElementById('enabled');
  var durationSlider = document.getElementById('fadeDuration');
  var durationValue  = document.getElementById('durationValue');
  var curveSelect    = document.getElementById('fadeCurve');
  var debugChk       = document.getElementById('debug');
  var statusEl       = document.getElementById('status');
  var videoStatusEl  = document.getElementById('videoStatus');
  var volumeDisplay  = document.getElementById('volumeDisplay');
  var versionEl      = document.getElementById('version');
  var resetBtn       = document.getElementById('reset');

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  versionEl.textContent = 'v' + C.EXTENSION_VERSION;

  (async function init() {
    var settings = await Settings.getAll();

    enabledChk.checked     = settings.enabled;
    durationSlider.value   = settings.fadeDuration;
    durationValue.textContent = settings.fadeDuration + ' ms';
    curveSelect.value      = settings.fadeCurve;
    debugChk.checked       = settings.debug;

    requestStatus();
  })();

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  enabledChk.addEventListener('change', function () {
    Settings.set({ enabled: enabledChk.checked });
    broadcast({ type: 'SETTINGS_UPDATED', payload: { enabled: enabledChk.checked } });
  });

  durationSlider.addEventListener('input', function () {
    var val = Number(durationSlider.value);
    durationValue.textContent = val + ' ms';
  });

  durationSlider.addEventListener('change', function () {
    var val = Number(durationSlider.value);
    Settings.set({ fadeDuration: val });
    broadcast({ type: 'SETTINGS_UPDATED', payload: { fadeDuration: val } });
  });

  curveSelect.addEventListener('change', function () {
    Settings.set({ fadeCurve: curveSelect.value });
    broadcast({ type: 'SETTINGS_UPDATED', payload: { fadeCurve: curveSelect.value } });
  });

  debugChk.addEventListener('change', function () {
    Settings.set({ debug: debugChk.checked });
    broadcast({ type: 'SETTINGS_UPDATED', payload: { debug: debugChk.checked } });
  });

  resetBtn.addEventListener('click', async function () {
    await Settings.reset();
    var defaults = await Settings.getAll();

    enabledChk.checked     = defaults.enabled;
    durationSlider.value   = defaults.fadeDuration;
    durationValue.textContent = defaults.fadeDuration + ' ms';
    curveSelect.value      = defaults.fadeCurve;
    debugChk.checked       = defaults.debug;

    broadcast({ type: 'SETTINGS_UPDATED', payload: defaults });
    requestStatus();
  });

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  function requestStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0]) return;
      var tab = tabs[0];
      if (!tab.url || (tab.url.indexOf('youtube.com') === -1 && tab.url.indexOf('music.youtube.com') === -1)) {
        setStatus('Not YouTube', 'Inactive');
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, function (response) {
        if (chrome.runtime.lastError || !response) {
          setStatus('Waiting for video', 'Not detected');
          return;
        }
        updateUI(response);
      });
    });
  }

  /** @param {{ status: string, videoDetected: boolean, volume: number|null }} data */
  function updateUI(data) {
    setStatus(data.status || 'Unknown', data.videoDetected ? 'Detected' : 'Not detected');
    volumeDisplay.textContent = data.volume !== null ? Math.round(data.volume * 100) + '%' : '--';
  }

  /** @param {string} status @param {string} videoLabel */
  function setStatus(status, videoLabel) {
    statusEl.textContent = status;
    statusEl.className = 'status-badge';
    if (status === 'Ready' || status === 'Video detected') {
      statusEl.classList.add('active');
    }

    videoStatusEl.textContent = videoLabel;
    videoStatusEl.className = 'status-badge';
    if (videoLabel === 'Detected') {
      videoStatusEl.classList.add('active');
    }
  }

  /** @param {object} msg */
  function broadcast(msg) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0]) return;
      try {
        chrome.tabs.sendMessage(tabs[0].id, msg);
      } catch (e) { /* ignore */ }
    });
  }
})();
