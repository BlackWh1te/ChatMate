# ChatMate - AI Chat Assistant

A Chrome extension that helps you write better chat responses using your local Ollama AI model.

## Features

- Select text on any webpage and get AI-powered response suggestions
- Connect to local Ollama instance or remote via ngrok
- Response history tracking (last 50 entries)
- Customizable model selection
- **Response templates** - Create custom response styles (professional, casual, formal, etc.)
- **Right-click context menu** - Generate response from selected text directly
- **Keyboard shortcuts** - Quick access without clicking:
  - `Ctrl+Shift+O` (or `Cmd+Shift+O` on Mac) - Open extension
  - `Ctrl+Shift+G` (or `Cmd+Shift+G` on Mac) - Generate response for selected text
- **Dark mode** - Toggle between light and dark themes
- Simple, clean interface

## Setup Instructions

### 1. Install Ollama

Download and install Ollama from [ollama.ai](https://ollama.ai)

### 2. Pull a Model

Open your terminal and run:
```bash
ollama pull llama2
```

Or choose another model like `mistral`, `codellama`, etc.

### 3. Start Ollama

```bash
ollama serve
```

Ollama will start on `http://localhost:11434`

### 4. (Optional) Set Up ngrok for Remote Access

If you want to access Ollama from multiple devices or share the tunnel:

```bash
ngrok http 11434
```

Copy the HTTPS URL from ngrok (e.g., `https://abc123.ngrok-free.app`)

### 5. Install the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select this extension folder

### 6. Configure Settings

1. Click the extension icon in your browser toolbar
2. Click "⚙️ Settings"
3. Enter your Ollama URL:
   - For local: `http://localhost:11434`
   - For remote (ngrok): `https://your-ngrok-url.ngrok-free.app`
4. Enter your model name (e.g., `llama2`)
5. Click "Save Settings"

## Usage

### Method 1: Click Extension Icon
1. Navigate to any webpage (Facebook, LinkedIn, email, etc.)
2. Select the text you want help responding to
3. Click the extension icon in your toolbar
4. The selected text will appear in the popup
5. Optionally select a response style from the dropdown
6. Click "Generate Response"
7. Copy the AI response and paste it back

### Method 2: Right-Click Context Menu
1. Select text on any webpage
2. Right-click and choose "Generate AI Response"
3. The popup will open with the selected text
4. Click "Generate Response"

### Method 3: Keyboard Shortcuts
1. Select text on any webpage
2. Press `Ctrl+Shift+O` (or `Cmd+Shift+O` on Mac) to open the extension
3. The selected text will be automatically captured
4. Click "Generate Response"

You can also use `Ctrl+Shift+G` (or `Cmd+Shift+G` on Mac) to directly generate a response for the selected text.

## Response Templates

Create custom response styles to match different contexts:

1. Click the extension icon → Settings
2. Scroll to "Response Templates"
3. Enter a template name (e.g., "Professional")
4. Enter a system prompt (e.g., "Write a professional and polite business response")
5. Click "Add Template"

Now when generating responses, you can select your custom style from the dropdown in the popup.

Example templates:
- **Professional**: "Write a professional and polite business response"
- **Casual**: "Write a friendly and casual response"
- **Formal**: "Write a formal and respectful response"
- **Concise**: "Write a brief and to-the-point response"

## Dark Mode

Toggle between light and dark themes:

1. Click the moon/sun icon (🌙/☀️) in the top-right corner of the popup or settings page
2. Your preference is automatically saved
3. The theme applies to both the popup and settings pages

## Troubleshooting

**Extension won't connect to Ollama:**
- Make sure Ollama is running (`ollama serve`)
- Check that the URL in settings is correct
- If using ngrok, make sure ngrok is running and the URL is current

**"Ollama error" message:**
- Verify your model is installed: `ollama list`
- Try pulling the model again: `ollama pull llama2`
- Check Ollama logs for errors

**Text selection not working:**
- Refresh the page after installing the extension
- Make sure you're selecting text before clicking the extension

## Development

To modify the extension:
1. Edit the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on this extension card

## License

MIT
