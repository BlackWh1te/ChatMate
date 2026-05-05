# Changelog

All notable changes to ChatMate will be documented in this file.

## [1.0.7] - 2026-05-05

### Fixed
- **Trailing slash in Ollama URL** — entering an Ollama URL with a trailing slash (e.g. `http://localhost:11434/`) no longer creates broken API URLs like `//api/chat`. All URL constructions in `popup.js`, `content.js`, `background.js`, and `settings.js` now normalize trailing slashes before use.
- **Stream cleanup on incomplete response** — if the Ollama stream ends without an explicit `done` flag, the response is now properly cleaned (dedented, whitespace normalized) and action buttons are enabled, instead of leaving raw text and disabled buttons.
- **chrome.runtime.sendMessage lastError** — the popup now gracefully handles `chrome.runtime.lastError` when querying pending text from the background service worker, falling back to tab messaging instead of throwing an uncaught error.
- **Contenteditable paste reliability** — replaced deprecated `document.execCommand('insertText')` with modern Range/Selection API insertion in `content.js`. Pasting into rich-text editors is now more reliable across sites.
- **Selection start fallback** — `element.selectionStart || element.value.length` changed to use nullish coalescing (`??`) so a cursor position of `0` (start of input) is respected instead of jumping to the end.
- **Defensive storage access in settings page** — wrapped unprotected `chrome.storage.local.get` calls for theme loading, settings loading, history export, and history import in `settings.js` with try-catch. Prevents crashes if the extension is reloaded while the settings page is open.

## [1.0.6] - 2026-05-05

### Improved
- **Connection status cache** — the popup no longer flashes "Checking…" every time it opens. The last known Ollama status is cached for 10 seconds and shown instantly while a silent background refresh verifies it. Much snappier feel when you open the popup repeatedly.

## [1.0.5] - 2026-05-05

### Added
- **Ctrl+Enter (Cmd+Enter on Mac) to generate** — press `Ctrl+Enter` from the message textarea to trigger **Generate Reply** without leaving the keyboard. Works for both starting generation and cancelling an in-progress one.

## [1.0.4] - 2026-05-05

### Fixed
- **Merged duplicate message listeners** in `content.js` — the sidebar iframe was registering two separate `window.addEventListener('message')` handlers, causing redundant checks and potential race conditions.
- **Crash on chrome:// pages and special tabs** — `popup.js` and `background.js` now validate `tabs[0].id` exists before calling `chrome.tabs.sendMessage`, preventing crashes when the active tab is a system page or has no accessible ID.
- **Unchecked `chrome.runtime.lastError` in keyboard shortcut handler** — background service worker now logs and gracefully handles cases where the content script isn't loaded on the target tab.
- **Blob URL memory leak** — `fetchImageAsBase64()` in `popup.js` now revokes object URLs after image load or error, preventing memory accumulation when processing page images for vision models.
- **Defensive image resolution** — `resolveImages()` now catches individual image fetch failures instead of letting one bad URL break the entire batch.
- **`isVisible()` too strict** — content script paste helper now considers elements partially visible in the viewport (not just fully in-view), making paste work on more sites where inputs are near scroll boundaries.

## [1.0.3] - 2026-05-05

### Fixed
- Wrapped all remaining unprotected `chrome.storage.local` calls in `popup.js` with try-catch blocks. Prevents "Extension context invalidated" crashes when the popup is open during extension reload or update.
- Hardened `getSettings()` and `getTemplates()` to resolve gracefully instead of throwing when storage is unavailable.

## [1.0.2] - 2026-05-05

### Added
- **Regenerate button** — quickly re-run generation with the same prompt and tone without retyping.
- **Escape key to cancel** — press Escape during generation to immediately stop the AI reply.

### Fixed
- Regenerate and action buttons now properly enable/disable based on whether a response exists.

## [1.0.1] - 2026-05-05

### Added
- Manual **Read Page** button in popup — page reading is now opt-in instead of automatic.

### Fixed
- Wrapped all `chrome.storage` calls in try-catch to prevent "Extension context invalidated" crashes.
- Added defensive type checking in `getAvailableModels` to avoid runtime errors.
- AI now replies as a Reddit user instead of an assistant on Reddit pages.
- Improved Ollama 500 error messages and added context truncation to stay within token limits.
- Clear button now properly resets the page-read context.
- Added defensive checks for `chrome.storage` being undefined in certain browser states.
- Fixed JavaScript errors introduced during UI simplification.
- Compressed banner image for faster initial load.
