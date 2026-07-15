/**
 * @fileoverview Background service worker.
 *
 * Seeded defaults on install, and relays messages between
 * popup and content scripts.
 */

const EXTENSION_NAME = 'SoftSwitch';
const EXTENSION_VERSION = '1.0.0';

const STORAGE_KEYS = {
  ENABLED: 'softswitch_enabled',
  FADE_OUT_DURATION: 'softswitch_fadeOutDuration',
  FADE_IN_DURATION: 'softswitch_fadeInDuration',
  FADE_CURVE: 'softswitch_fadeCurve',
  PREFERRED_VOLUME: 'softswitch_preferredVolume',
  DEBUG: 'softswitch_debug',
};

const DEFAULTS = {
  ENABLED: true,
  FADE_OUT_DURATION: 700,
  FADE_IN_DURATION: 700,
  FADE_CURVE: 'easeInOut',
  PREFERRED_VOLUME: 1,
  DEBUG: false,
};

// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.ENABLED]:             DEFAULTS.ENABLED,
      [STORAGE_KEYS.FADE_OUT_DURATION]:   DEFAULTS.FADE_OUT_DURATION,
      [STORAGE_KEYS.FADE_IN_DURATION]:    DEFAULTS.FADE_IN_DURATION,
      [STORAGE_KEYS.FADE_CURVE]:          DEFAULTS.FADE_CURVE,
      [STORAGE_KEYS.PREFERRED_VOLUME]:    DEFAULTS.PREFERRED_VOLUME,
      [STORAGE_KEYS.DEBUG]:               DEFAULTS.DEBUG,
    });
    console.log(`[${EXTENSION_NAME}] v${EXTENSION_VERSION} installed – defaults seeded.`);
  }

  if (details.reason === 'update') {
    console.log(`[${EXTENSION_NAME}] updated to v${EXTENSION_VERSION}`);
  }
});

// Relay messages from popup → content script
chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.tab === undefined && message.type) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
      }
    });
  }
  return false;
});
