# Contributing

Contributions are welcome! This is a simple Chrome extension, so modifications are straightforward.

## Development Setup

1. Clone or download this repository
2. Install Ollama: https://ollama.ai
3. Pull a model: `ollama pull llama2`
4. Start Ollama: `ollama serve`
5. Open Chrome and go to `chrome://extensions/`
6. Enable "Developer mode"
7. Click "Load unpacked" and select this folder
8. Make changes to source files
9. Click the refresh icon on the extension card to reload

## Project Structure

```
.
├── manifest.json          # Chrome extension configuration
├── popup.html             # Main popup UI
├── popup.js               # Popup logic and Ollama API calls
├── content.js             # Text selection handler
├── background.js          # Background service worker
├── settings.html          # Settings page
├── settings.js            # Settings logic and template management
├── icon.svg               # Extension icon (SVG format)
├── README.md              # Documentation
├── INSTALLATION.md        # Installation instructions
├── LICENSE                # MIT License
└── .gitignore             # Git ignore rules
```

## Making Changes

**To modify the UI:**
- Edit `popup.html` for layout
- Edit `popup.html` CSS for styling (inline styles used for simplicity)

**To modify functionality:**
- `popup.js` - Main extension logic, Ollama API calls
- `content.js` - Text selection from webpages
- `settings.js` - Settings and template management
- `background.js` - Extension initialization

**To add new features:**
- Add permissions to `manifest.json` if needed
- Update README.md with new features
- Test thoroughly before submitting

## Testing

1. Load the extension in Chrome
2. Test on different websites (Facebook, LinkedIn, email, etc.)
3. Test with different Ollama models
4. Test template creation and usage
5. Test ngrok remote access
6. Test error handling (stop Ollama, wrong URL, etc.)

## Submitting Changes

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Guidelines

- Keep it simple - this is a lightweight extension
- Use vanilla JavaScript (no frameworks needed)
- Follow existing code style
- Update documentation for new features
- Test on multiple websites if possible
