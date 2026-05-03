# ChatMate - Installation Instructions

## Quick Start

### 1. Install Ollama
Download from [ollama.ai](https://ollama.ai) and install it.

### 2. Pull a Model
Open terminal and run:
```bash
ollama pull llama2
```

### 3. Start Ollama
```bash
ollama serve
```

### 4. (Optional) Set Up ngrok for Remote Access
If you want to use this from multiple devices:
```bash
ngrok http 11434
```
Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### 5. Install the Chrome Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select this folder: `C:\Users\Shukhrat\Desktop\New folder\git\extesion`

### 6. Configure Settings
1. Click the extension icon in your browser toolbar
2. Click "⚙️ Settings"
3. Enter your Ollama URL:
   - Local: `http://localhost:11434`
   - Remote (ngrok): `https://your-ngrok-url.ngrok-free.app`
4. Enter model name: `llama2` (or whatever model you pulled)
5. Click "Save Settings"

## Usage

### Method 1: Click Extension Icon
1. Go to any webpage (Facebook, LinkedIn, email, etc.)
2. Select text you want help responding to
3. Click the extension icon
4. The selected text appears in the popup
5. Click "Generate Response"
6. Copy the AI response and paste it back

### Method 2: Right-Click Context Menu
1. Select text on any webpage
2. Right-click and choose "Generate AI Response"
3. The popup opens with the selected text

### Method 3: Keyboard Shortcuts
1. Select text on any webpage
2. Press `Ctrl+Shift+O` (or `Cmd+Shift+O` on Mac) to open the extension
3. The selected text is automatically captured

### Response Templates
1. Click extension icon → Settings
2. Scroll to "Response Templates"
3. Create templates for different response styles (professional, casual, etc.)

### Dark Mode
Click the moon/sun icon (🌙/☀️) in the top-right corner to toggle between light and dark themes.

## Troubleshooting

**"Please configure your Ollama URL" error:**
- Go to Settings and enter your Ollama URL
- Make sure Ollama is running (`ollama serve`)

**"Ollama error" message:**
- Check Ollama is running: `ollama list`
- Verify your model is installed: `ollama pull llama2`
- Check the URL in settings is correct

**Text selection not working:**
- Refresh the page after installing the extension
- Make sure you select text before clicking the extension

**ngrok connection issues:**
- Make sure ngrok is running
- Copy the current ngrok URL (it changes each time you restart ngrok)
- Update the extension settings with the new URL

## Files Created

- `manifest.json` - Chrome extension configuration
- `popup.html` - Main UI with dark mode support
- `popup.js` - Popup logic, Ollama API calls, theme handling
- `content.js` - Text selection handler
- `background.js` - Background service worker, context menu, keyboard shortcuts
- `settings.html` - Settings page with templates and dark mode
- `settings.js` - Settings logic, template management, theme handling
- `icon.svg` - Extension icon
- `README.md` - Full documentation
- `INSTALLATION.md` - This file
- `LICENSE` - MIT License
- `CONTRIBUTING.md` - Contribution guidelines
- `validate.js` - Extension validation script
- `.gitignore` - Git ignore rules
