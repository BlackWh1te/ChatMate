# Changelog

All notable changes to ChatMate will be documented in this file.

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
