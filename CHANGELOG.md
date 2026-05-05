# Changelog

All notable changes to ChatMate will be documented in this file.

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
