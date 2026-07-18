# LiveBrowser

Embedded Chromium browser view with AI interaction tools.

---

## Architecture

```text
Packages/LiveBrowser/
├── Index.js                    — IPC handlers, dual export
├── Core/
│   ├── BrowserPreviewService.js — Browser view management
│   └── BrowserRuntime.js       — Browser runtime, global state
└── I18n/
    └── en.js                   — Browser strings
```

---

## Purpose

LiveBrowser provides an embedded browser that:

- Displays web pages within the app
- Allows AI to interact with web pages via tools
- Tracks browsing history
- Supports screenshots and DOM snapshots

---

## Dual Export Pattern

LiveBrowser exports two shapes:

```js
// For Shell (IPC handlers)
export async function createPackage({ rootDirectory }) { ... }

// For Toolset (tool discovery)
export function createToolPackage() { ... }
```

This allows it to function both as an IPC package and as a tool provider.

---

## IPC Handlers (18 channels)

| Channel | Purpose |
|---|---|
| `browser-preview:get-state` | Get current browser state (URL, title, history) |
| `browser-preview:load-url` | Navigate to a URL |
| `browser-preview:load-html` | Load raw HTML content |
| `browser-preview:set-visible` | Show/hide the browser view |
| `browser-preview:set-bounds` | Set browser view dimensions |
| `browser-preview:hide` | Hide the browser view |
| `browser-preview:hide-native-view` | Pause history view |
| `browser-preview:show-native-view` | Resume history view |
| `browser-preview:go-back` | Navigate back |
| `browser-preview:go-forward` | Navigate forward |
| `browser-preview:reload` | Reload the page |
| `browser-preview:pause` | Pause the browser |
| `browser-preview:resume` | Resume the browser |
| `browser-preview:close` | Close the browser view |
| `browser-preview:get-history` | Get browsing history |
| `browser-preview:clear-history` | Clear browsing history |
| `browser-preview:delete-history-entry` | Delete a history entry |
| `browser-preview:execute-tool` | Execute a browser AI tool |

---

## Browser Tools

The AI can interact with the browser via tools defined in `LIVE_BROWSER_TOOL_NAMES`:

| Tool | Description |
|---|---|
| `browser_navigate` | Navigate to a URL |
| `browser_get_state` | Get current page state |
| `browser_snapshot` | Take a DOM snapshot |
| `browser_get_text` | Get visible text content |
| `browser_click` | Click an element |
| `browser_type` | Type text into an input |
| `browser_press_key` | Press a keyboard key |
| `browser_scroll` | Scroll the page |
| `browser_back` | Navigate back |
| `browser_forward` | Navigate forward |
| `browser_refresh` | Refresh the page |
| `browser_screenshot` | Take a screenshot |

---

## BrowserPreviewService

Manages the BrowserView lifecycle:

- `attachToWindow(window)` — Attaches browser view to an Electron window
- `loadUrl(url, options)` — Navigates to a URL
- `loadHtml(html, options)` — Loads raw HTML
- `setVisible(visible)` — Shows/hides the view
- `setHostBounds(bounds)` — Resizes the view
- `getState()` — Returns current state (URL, title, canGoBack, canGoForward)
- `goBack()` / `goForward()` / `reload()` — Navigation
- `pause()` / `resume()` — Lifecycle management
- `executeTool(tool, params, context)` — Execute browser AI tools

---

## BrowserRuntime

Global state management:

```js
import { getBrowserPreviewService, setBrowserPreviewService } from './Core/BrowserRuntime.js';
```

Provides a singleton pattern for the browser preview service.

---

## Usage in Chat

The browser preview can be embedded in the chat layout:

```js
import { createBrowserPreviewPanel } from './Chat/UI/BrowserPreviewPanel.js';

const browserPanel = createBrowserPreviewPanel(container);
```

The AI can open URLs, interact with pages, and take screenshots during conversations.

---

## Browsing History

Browsing history is stored in `Data/Browsing/` organized by date:

```text
Data/Browsing/
└── 2026/
    └── 07/
        └── 01.json
```

History entries include URL, title, timestamp, and visit count.
