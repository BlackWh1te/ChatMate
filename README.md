# ChatMate - AI Chat Assistant

Get AI help writing replies on any website. Works with your own computer's AI (via Ollama) — no subscriptions, no data sent to the cloud.

## What it does

- Highlight any text on a website → get a smart reply suggestion
- Works on Facebook, LinkedIn, WhatsApp, Slack, Discord, and everywhere else
- Reads the current page to give better, more accurate replies
- One click to copy or paste the reply into your chat

## Setup (3 steps)

1. **Install Ollama** — Download from [ollama.ai](https://ollama.ai)
2. **Get a model** — Open your terminal and run: `ollama pull llama3`
3. **Start Ollama** — Run: `ollama serve`

## Install the Extension

1. Open Chrome → go to `chrome://extensions/`
2. Turn on **Developer mode** (top right switch)
3. Click **Load unpacked** → select this folder

## First Use

1. Click the ChatMate icon in Chrome
2. Go to **Settings** → enter `http://localhost:11434` → click **Detect** → pick a model → **Save**
3. Highlight text on any page, open ChatMate, click **Generate Response**

That's it. The AI will write a reply for you.

## Tips

- **Turn on "Include page context"** in the popup when replying to forum posts or support tickets — the AI will know what the conversation is about
- **Add Reference URLs** in Settings (like your company FAQ) — the AI will use them as background knowledge
- **Use the Slack or Reddit tone** when on those sites — the AI will write in the right style automatically
- **Not working?** Make sure Ollama is running (`ollama serve` in your terminal)

## License

MIT
