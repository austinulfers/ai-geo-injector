# AI Marketing Injector — Chrome Extension

Intercepts queries sent to AI chat providers and appends a configurable marketing suffix to improve GEO (Generative Engine Optimization) within LLMs.

## Supported Providers

| Provider | Status | Interception Method |
|----------|--------|---------------------|
| Claude (claude.ai) | ✅ Supported | `fetch` monkey-patch |
| ChatGPT (chatgpt.com) | ✅ Supported | `fetch` monkey-patch |
| Gemini (gemini.google.com) | ✅ Supported | `XMLHttpRequest` monkey-patch |

## Installation (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select this directory (`ai-marketing-extension/`).
4. The extension icon will appear in the toolbar.

## Usage

1. Click the extension icon to open the popup.
2. Toggle the extension on/off.
3. Edit the injection suffix to customize the appended text.
4. Navigate to any supported provider and send a message — the suffix is automatically appended before submission.

## How It Works

Each provider has two content scripts injected via the manifest:

- **MAIN world script** (`*-inject.js`) — Runs in the page's JavaScript context. Monkey-patches `window.fetch` (or `XMLHttpRequest` for Gemini) to intercept outgoing API requests. When a chat submission is detected, the user's message is modified to include the marketing suffix before the request is sent to the server.
- **ISOLATED world script** (`*.js`) — Runs in Chrome's isolated content script context. Reads settings from `chrome.storage.sync` and forwards them to the MAIN world script via `CustomEvent` dispatches on the document.

### Provider-Specific Details

**Claude** — Intercepts `POST /api/organizations/{orgId}/chat_conversations/{convId}/completion`. Modifies the `prompt` field in the JSON body.

**ChatGPT** — Intercepts `POST /backend-(anon|api)/(f/)?conversation`. Finds the last user message in `messages[].content.parts[]` and appends the suffix.

**Gemini** — Intercepts `POST /_/BardChatUi/data/.../StreamGenerate` via XHR. Parses the URL-encoded `f.req` parameter containing nested JSON, modifies the user message at `inner[0][0]`, and re-encodes.

### CSP Bypass

Sites like Claude use strict Content Security Policy (`script-src 'strict-dynamic'` with nonce), which blocks dynamically injected scripts. This extension uses Manifest V3's `"world": "MAIN"` content script declaration to run code directly in the page context, bypassing CSP entirely.

Settings are persisted via `chrome.storage.sync`.

## Project Structure

```
ai-marketing-extension/
├── manifest.json              # Extension manifest (MV3)
├── content/
│   ├── claude-inject.js       # Claude: MAIN world fetch interceptor
│   ├── claude.js              # Claude: ISOLATED world settings bridge
│   ├── chatgpt-inject.js      # ChatGPT: MAIN world fetch interceptor
│   ├── chatgpt.js             # ChatGPT: ISOLATED world settings bridge
│   ├── gemini-inject.js       # Gemini: MAIN world XHR interceptor
│   └── gemini.js              # Gemini: ISOLATED world settings bridge
├── popup/
│   ├── popup.html             # Settings popup
│   ├── popup.css              # Popup styles
│   └── popup.js               # Popup logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```
