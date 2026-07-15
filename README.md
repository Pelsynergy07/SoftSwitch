# SoftSwitch

**Smooth audio transitions between YouTube videos.**

SoftSwitch fades out your current video when you click a recommendation, then fades the next video in — no more abrupt audio cuts when navigating YouTube.

## Features

- **Smooth fade-out** when clicking video links, thumbnails, or recommendations
- **Smooth fade-in** on the next page — volume rises from silence
- **Non-click navigation** (autoplay, keyboard shortcuts, browser history) instantly mutes the old video
- **Configurable fade duration** — 100ms to 3000ms (default 700ms)
- **Multiple fade curves** — Linear, Ease In, Ease Out, Ease In-Out
- **Works on YouTube and YouTube Music**
- **Lightweight** — no polling, no Web Audio API, just `video.volume` via `requestAnimationFrame`

## How It Works

### Click Navigation (recommendations, thumbnails)

1. You click a video link on YouTube
2. An invisible overlay instantly blocks all further events from reaching YouTube
3. The current video's audio fades from its current level to 0 over the configured duration
4. After the fade completes, the page navigates to the clicked link
5. The new page loads and the video fades in from 0 to your preferred volume

This gives you a seamless listening experience — no abrupt stop, no silence gap beyond what the network requires.

### Non-Click Navigation (autoplay, keyboard, history)

For navigations triggered by autoplay, keyboard shortcuts (Shift+N/P), or browser history, SoftSwitch instantly mutes the current video before YouTube destroys the element, then restores volume when the new video appears.

## Installation

### From Chrome Web Store

_(Coming soon)_

### Developer Mode (manual)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the `softswitch` folder
5. The extension is now active — visit YouTube to test

## Usage

Open the SoftSwitch popup by clicking the icon in Chrome's toolbar.

| Control | Description |
|---------|-------------|
| **Extension Enabled** | Toggle SoftSwitch on/off |
| **Fade Duration** | How long the fade-out/in takes (100–3000ms) |
| **Fade Curve** | The easing function for the animation |
| **Debug Mode** | Enable verbose console logging |
| **Reset Settings** | Restore all defaults |

For debugging, enable Debug Mode and open DevTools (`F12`) on YouTube — look for `[SS]` log lines.

## Privacy

SoftSwitch does **not** collect, store, or transmit any data. All settings are stored locally via `chrome.storage.sync`. No network requests are made beyond what YouTube itself initiates.

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Save your preferences (fade duration, curve, etc.) |
| `https://www.youtube.com/*` | Inject the content script on YouTube |
| `https://music.youtube.com/*` | Inject the content script on YouTube Music |

## Architecture

```
softswitch/
  manifest.json
  icons/
  src/
    background/background.js    — Service worker (seeds defaults, relays messages)
    constants.js                — Shared constants and defaults
    utils/
      easing.js                 — Easing functions (linear, easeIn, easeOut, easeInOut)
      logger.js                 — Scoped console logger with debug gating
    storage/
      settings.js               — chrome.storage.sync wrapper (read/write/observe)
    fade/
      FadeController.js         — RAF-based volume animation
      FadeScheduler.js          — Ensures one fade at a time
    content/
      index.js                  — Main entry: wires all modules together
      clickInterceptor.js       — Invisible overlay + pointerdown capture for click nav
      navigation.js             — pushState/replaceState patch + keyboard detection
      observer.js               — MutationObserver for SPA navigation
      videoManager.js           — Video element tracking (query + Shadow DOM)
    popup/
      popup.html / .css / .js   — Extension popup UI
```

All content scripts use IIFEs and a `window.SS_*` namespace (no ES module `import`/`export`) for maximum Chrome compatibility.

## Building from Source

No build step is required. The extension is plain JavaScript that runs directly in Chrome. Load the `softswitch` folder as an unpacked extension.

## License

MIT
