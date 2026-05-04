# ChatMate - AI Chat Assistant

Get AI help writing replies on any website. Works with your own computer's AI (via Ollama) — no subscriptions, no data sent to the cloud.

Source https://github.com/BlackWh1te/ChatMate

## What it does

- **Always-visible sidebar** — ChatMate sits on the right edge of every page. No more clicking a tiny toolbar icon.
- Highlight any text → click **Grab** → get a natural, human-sounding reply
- Works on Facebook, LinkedIn, WhatsApp, Slack, Discord, and everywhere else
- Reads the current page to give better, more accurate replies
- One click to copy or paste the reply into your chat

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
2. Click the **⚙️ Settings** link in the footer → enter `http://localhost:11434` → click **Find Models** → pick a model → **Save**
3. Highlight text on any page, click **📋 Grab**, then **✨ Write a Reply**

That's it. The AI will write a reply for you.

## Tips

- **Pick a tone** — Choose from built-in styles (Casual, Short & Sweet, Warm, Witty, Polished) to match your voice
- **Turn on "Use this page for context"** when replying to forum posts or support tickets — the AI will know what the conversation is about
- **Add Reference URLs** in Settings (like your company FAQ) — the AI will use them as background knowledge
- **Not working?** Make sure Ollama is running (`ollama serve` in your terminal)

## License

MIT
