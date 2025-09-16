# Polite Text Rewriter (Chrome Extension)

A minimal Chrome (Manifest V3) content script that places a single persistent floating "Rewrite" button next to the currently focused text field on any site. Clicking the button sends the entire content of that field to Google's Gemini API and replaces it with the rewritten result.

The current prompt is tailored to "only rewrite sentences which contain bad words without changing the meaning" and uses the Gemini 2.5 Flash model.

## Features

- Single, persistent floating Rewrite button that follows the focused field
- Works on most text inputs:
  - `textarea`
  - `input` types: `text`, `search`, `email`, `url`, `tel`, `password`, `number`
  - Any element with `contenteditable` (except explicit `contenteditable="false"`)
- Status-driven button label: `Rewrite` → `Rewriting…` → `Rewrite` (or `Error`)
- Sends full field content to Gemini and replaces with the response
- Emits `input` and `change` events after replacement so sites detect updates
- Runs in all frames (helps Gmail/Twitter/Docs which render in iframes)

## Repository Layout

```
rewrite/
  ├─ content.js        # Minimal singleton-button logic and Gemini API call
  ├─ manifest.json     # MV3 manifest (content script, permissions)
  ├─ popup.html        # UI to set your Gemini API key (stored in chrome.storage.sync)
  ├─ popup.js          # Persists the API key and basic feedback
  └─ icon.png          # Extension icon (placeholder)
README.md
```

## Requirements

- Google Gemini API key (from Google AI Studio)
  - Sign up and create an API key at: https://aistudio.google.com/
  - Ensure the key has access to the model used by this extension
- Chrome-based browser that supports Manifest V3 (Chrome, Edge, Brave)

## Installation (Developer Mode)

1. Clone or download this repository.

2. Open Chrome and navigate to:
   - `chrome://extensions/`

3. Enable "Developer mode" (toggle at top-right).

4. Click "Load unpacked" and select the `rewrite/` folder.

5. The extension should now appear in your toolbar.

## Configure Your API Key

1. Click the extension icon in Chrome’s toolbar to open the popup.
2. Paste your Gemini API key and click "Save".
   - The key is stored in `chrome.storage.sync` and never hard-coded in `content.js`.

## Usage

1. Navigate to any website with a text field (e.g., Gmail compose, Twitter post box, Google search box).
2. Click into a text field (or contenteditable area). The floating `Rewrite` button should appear, positioned to the right of the field.
3. Enter some text.
4. Click `Rewrite`.
   - The button shows `Rewriting…` while the request is in progress.
   - On success, the field’s content is replaced with the model output and the button returns to `Rewrite`.
   - On error, the button shows `Error` temporarily and the reason is logged to the Console.

## How It Works (High Level)

- `content.js` injects a global singleton button and listens for `focusin` so it can attach to the currently focused editable element.
- When clicked, it reads the element’s text, calls Gemini’s `generateContent` endpoint, and replaces the text with the response.
- It dispatches `input` and `change` events to make web apps react as if a user typed the updated content.

## Model and Prompt

- Model: `gemini-2.5-flash`
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- Prompt (in `rewrite/content.js` → `rewriteText()`):
  - `Only rewite the sentences which contains bad words don't change the meaning of the text: <your_text> don't add anything else.`

You can customize the prompt in `rewrite/content.js` if you want different rewrite behavior.

## Permissions

`rewrite/manifest.json` (MV3):

- `permissions`: `activeTab`, `storage`
  - `storage` is used to persist your API key via the popup
- `host_permissions`: `<all_urls>`
  - Allows the content script to run on any site where you need the rewrite button
- `content_scripts`: runs on `<all_urls>`, `run_at: document_end`, `all_frames: true`
  - `all_frames: true` is important for sites that render editable UI inside iframes

## Security & Privacy

- Your API key is stored locally in Chrome’s `chrome.storage.sync` and retrieved by the content script when needed.
- The extension does not transmit data to any server other than Google’s Gemini endpoint.
- All rewrite requests are initiated by clicking the button—no background processing or automatic rewriting.

## Troubleshooting

- Button doesn’t appear:
  - Reload the extension at `chrome://extensions` and refresh the page
  - Make sure you’re focused in a text-like field (textarea, input, or contenteditable)
  - Some sites use deeply nested iframes; we’ve enabled `all_frames`, but if a specific site fails, open DevTools (Inspect → Console) to see any errors

- Button shows `Error`:
  - Open DevTools Console to view the exact error message
  - Common causes:
    - Missing or invalid API key
    - Network errors or blocked calls
    - Model name not available for your key/region

- Text doesn’t update in app UI:
  - We dispatch both `input` and `change` events, but some web apps require special synthetic events. If you hit a specific app that doesn’t reflect the update, tell us which one and we’ll add a compatibility path.

## Customization

- Change button label/position: Edit the singleton button block in `rewrite/content.js`
- Change model/prompt: Update `rewriteText()`
- Restrict sites: Change `matches` or add include/exclude rules in `manifest.json`

## Development Notes

- This project uses only vanilla JS and Chrome MV3 APIs—no build step required.
- If you edit `manifest.json`, you must reload the extension in `chrome://extensions`.
- If you edit only `content.js`, a page refresh is typically enough once the extension is reloaded.

## Known Limitations

- Some complex editors (e.g., heavy WYSIWYG within multiple iframes/shadow DOMs) may still require additional hooks. The current implementation should cover the majority of inputs (Gmail, Twitter/X, search boxes, basic editors).
- Google Docs’ main editor uses a highly customized environment; results can vary. If it’s critical, open an issue with details.

## License

MIT
