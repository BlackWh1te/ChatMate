# ChatMate - AI Chat Assistant

A Chrome extension that helps you write better chat responses using your local Ollama AI model. Perfect for customer support, sales outreach, social media, and everyday messaging.

## Features

- **AI Response Generation** - Select text on any webpage and get intelligent response suggestions
- **Streaming Responses** - See responses appear in real-time as they're generated
- **Multiple Variants** - Generate 2-3 different response options to choose from
- **Smart Text Extraction** - Works with Facebook, LinkedIn, WhatsApp Web, Slack, Discord, Twitter/X, Telegram, Instagram, and more
- **One-Click Paste** - Automatically insert responses into chat input fields (supported sites)
- **Connection Status** - Live indicator showing Ollama connection state

### Response Templates
- 5 built-in templates: Professional, Casual, Formal, Concise, Empathetic
- Create unlimited custom templates for different contexts
- Switch templates instantly from the popup

### Quick Access
- **Right-click context menu** - "Generate AI Response" on any selected text
- **Keyboard shortcuts**:
  - `Ctrl+Shift+O` (or `Cmd+Shift+O` on Mac) - Open extension
  - `Ctrl+Shift+G` (or `Cmd+Shift+G` on Mac) - Generate response for selected text

### Customization
- **Auto-detect models** - Automatically fetch available models from your Ollama instance
- **Temperature control** - Adjust creativity (0.0 = focused, 2.0 = very creative)
- **Max tokens** - Control response length (50 - 4096 tokens)
- **Dark mode** - Toggle between light and dark themes
- **Streaming toggle** - Enable/disable real-time response streaming

### History & Management
- **Response history** - Automatically saves last 50 conversations
- **Search history** - Find past responses quickly
- **Export/Import** - Backup and restore your history as JSON
- **Model info** - See which model and endpoint you're using

## Setup Instructions

### 1. Install Ollama

Download and install Ollama from [ollama.ai](https://ollama.ai)

### 2. Pull a Model

```bash
ollama pull llama2
```

Popular alternatives: `mistral`, `codellama`, `llama3`, `phi3`

### 3. Start Ollama

```bash
ollama serve
```

Default endpoint: `http://localhost:11434`

### 4. (Optional) Remote Access with ngrok

```bash
ngrok http 11434
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### 5. Install the Extension

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this folder

### 6. Configure Settings

1. Click the ChatMate icon → Settings
2. Enter your Ollama URL
3. Click **Detect Models** to auto-populate available models
4. Select your preferred model
5. Adjust generation settings (optional):
   - **Temperature**: 0.7 (default) - higher = more creative
   - **Max tokens**: 500 (default) - max response length
   - **Variants**: 1-3 options per generation
   - **Streaming**: On (recommended)
6. Click "Save Settings"

## Usage

### Method 1: Extension Popup
1. Select text on any webpage
2. Click the ChatMate icon in your toolbar
3. The text appears in the popup
4. Select a template style (optional)
5. Click **Generate Response**
6. Copy or paste the AI response

### Method 2: Right-Click
1. Select text on any webpage
2. Right-click → "Generate AI Response"
3. The popup opens with the selected text

### Method 3: Keyboard Shortcuts
1. Select text
2. Press `Ctrl+Shift+O` to open, or `Ctrl+Shift+G` to generate directly

## Tips

**Generate multiple variants** - Set "Generate multiple variants" to 2 or 3 in Settings to get different response options. Each variant has a slightly different temperature for diversity.

**Use templates** - Create templates for common scenarios:
- Sales: "Write a persuasive but not pushy sales response"
- Support: "Write a helpful, empathetic customer support response"
- LinkedIn: "Write a professional networking message"

**Paste into chats** - The Paste button works on Facebook, LinkedIn, WhatsApp Web, Slack, Discord, and other sites. If it doesn't work on a specific site, Copy and manual paste is the fallback.

**Stop generation** - Click the Stop button during generation to cancel and save tokens.

## Troubleshooting

**Extension won't connect:**
- Check Ollama is running: `ollama serve`
- Click **Detect Models** in Settings to verify connection
- Check the URL is correct (no trailing slash)

**"Ollama error" message:**
- Verify model is installed: `ollama list`
- Re-pull the model: `ollama pull llama2`
- Check Ollama logs for errors

**Paste button doesn't work:**
- Some sites (like Twitter/X) have strict security - use Copy instead
- The site must have a visible text input field

**Slow responses:**
- Larger models (70B+) are slower - try smaller models like `phi3` or `llama3`
- Enable streaming to see responses in real-time
- Reduce max tokens for shorter, faster responses

## Supported Sites for Auto-Paste

- Facebook Messenger
- LinkedIn Messaging
- WhatsApp Web
- Slack
- Discord
- Telegram Web
- Instagram DMs
- Generic textareas and inputs

## Development

1. Edit source files
2. Go to `chrome://extensions/`
3. Click refresh on the ChatMate card

## License

MIT
