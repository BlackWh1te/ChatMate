# ChatMate - Getting Started

## What you need

- Chrome browser
- [Ollama](https://ollama.ai) installed on your computer (free)

## Setup

1. **Install Ollama** — Download from [ollama.ai](https://ollama.ai)
2. **Get an AI model** — Open your terminal and run:
   ```
   ollama pull llama3
   ```
3. **Start Ollama** — Run:
   ```
   ollama serve
   ```
4. **Install the extension** — Open Chrome → `chrome://extensions/` → turn on **Developer mode** → click **Load unpacked** → select this folder
5. **Connect** — Click the ChatMate icon → **Settings** → enter `http://localhost:11434` → click **Find Models** → pick one → **Save**

## How to use

1. Highlight text on any website
2. Click the ChatMate icon
3. Click **Write a Reply**
4. Copy or paste the reply into your chat

## Not working?

- Make sure `ollama serve` is running in your terminal
- Try refreshing the webpage after installing the extension
- Open Settings and click **Find Models** again

## Want to use it from your phone or another computer?

Use [ngrok](https://ngrok.com) to create a tunnel:
```
ngrok http 11434
```
Copy the HTTPS link into Settings instead of `localhost`.
