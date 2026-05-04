![ChatMate Banner](banner.png)

# ChatMate - AI Chat Assistant

Get AI help writing replies on any website. Works with your own computer's AI (via Ollama) — no subscriptions, no data sent to the cloud.

## What it does

- **Always-visible sidebar** — ChatMate sits on the right edge of every page. No more clicking a tiny toolbar icon.
- Highlight any text → click **📋** → get a natural, human-sounding reply
- Works on Facebook, LinkedIn, WhatsApp, Slack, Discord, Reddit, and everywhere else
- Automatically reads the current page to give better, more accurate replies
- One click to copy or paste the reply into your chat
- Modern, clean interface with dark mode support

## Setup (3 steps)

1. **Install Ollama** — Download from [ollama.ai](https://ollama.ai)
2. **Get a model** — Open your terminal and run: `ollama pull llama3`
3. **Start Ollama** — Run: `ollama serve`

> For the best replies, use modern instruction-tuned models like `llama3.1`, `mistral`, `phi4`, or `gemma2`. Older models like `llama2` tend to sound robotic.

## Install the Extension

1. Open Chrome → go to `chrome://extensions/`
2. Turn on **Developer mode** (top right switch)
3. Click **Load unpacked** → select this folder

## First Use

1. The ChatMate sidebar appears automatically on the right side of every page
2. Click the **⚙️ Settings** link in the footer → enter `http://localhost:11434` → click **🔍 Find Models** → pick a model → **Save**
3. Highlight text on any page, click **📋**, then **✨ Generate Reply**

That's it. The AI will write a reply for you.

## Tips

- **Pick a tone** — Choose from 15+ built-in styles (Casual, Professional, Helpful, Tech, ELI5, and more) to match your voice
- **Reddit-specific tones** — Use tones marked with 🐱 for Reddit replies with proper formatting
- **Create custom tones** — Save your own instructions in Settings for consistent replies
- **Not working?** Make sure Ollama is running (`ollama serve` in your terminal)

## Keyboard Shortcuts

- `Ctrl+Shift+O` (Mac: `Cmd+Shift+O`) — Open ChatMate
- `Ctrl+Shift+G` (Mac: `Cmd+Shift+G`) — Generate response for selected text

## License

MIT
