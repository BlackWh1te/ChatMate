# Changelog

All notable changes to ChatMate will be documented in this file.

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
