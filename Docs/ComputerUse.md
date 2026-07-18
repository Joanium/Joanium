# Computer Use Tools

OS-level screen, mouse, keyboard, clipboard, and window tools.

---

## Architecture

```text
Packages/Toolset/Tools/ComputerUse/
├── Index.js        — Tool package entry
├── Tools.js        — Tool definitions
├── Prompt.js       — Prompt section builder
└── Core/
    ├── ComputerUseTools.js — Tool handlers
    └── Chat/
        └── Tools.js       — Tool definitions for chat context
```

---

## Purpose

ComputerUse provides local OS interaction tools that allow the AI to:

- Capture screenshots
- Inspect display and cursor position
- Move, click, and drag the mouse
- Scroll
- Send keyboard input
- Inspect and edit clipboard content
- Control window focus, state, and bounds
- Open local files and URLs
- Wait between UI actions

---

## Tool Categories

### Screen Tools

| Tool | Description |
|---|---|
| `screenshot` | Capture a screenshot of the screen or a region |
| `display_info` | Get display resolution and scaling info |
| `cursor_position` | Get current cursor position |

### Mouse Tools

| Tool | Description |
|---|---|
| `mouse_move` | Move cursor to absolute coordinates |
| `mouse_click` | Click at coordinates (left, right, middle) |
| `mouse_double_click` | Double-click at coordinates |
| `mouse_drag` | Drag from one point to another |
| `mouse_scroll` | Scroll at coordinates |

### Keyboard Tools

| Tool | Description |
|---|---|
| `key_press` | Press a single key |
| `key_combo` | Press a key combination (e.g., Ctrl+C) |
| `type_text` | Type a string of text |

### Clipboard Tools

| Tool | Description |
|---|---|
| `clipboard_read` | Read clipboard contents |
| `clipboard_write` | Write to clipboard |

### Window Tools

| Tool | Description |
|---|---|
| `window_list` | List open windows |
| `window_focus` | Focus a window by title or ID |
| `window_get_bounds` | Get window position and size |
| `window_set_bounds` | Set window position and size |
| `window_minimize` | Minimize a window |
| `window_maximize` | Maximize a window |
| `window_close` | Close a window |

### Utility Tools

| Tool | Description |
|---|---|
| `open_url` | Open a URL in the default browser |
| `open_file` | Open a local file with the default application |
| `wait` | Wait for a specified duration (ms) |

---

## Important Notes

- These are **local tools**, not connector tools — they do not require API keys
- Tool definitions must not set connector-gated `category` values
- Tools execute on the user's machine with full OS access
- Use with caution — the AI can interact with the user's desktop

---

## Tool Format

AI invokes computer use tools via `joanium-tool` blocks:

````markdown
```joanium-tool
{"tool":"screenshot","parameters":{}}
```
````

---

## Implementation

`ComputerUseTools.js` creates handlers for each tool:

```js
export function createComputerUseToolHandlers() {
  return {
    screenshot(params) { /* ... */ },
    mouse_move(params) { /* ... */ },
    // ...
  };
}
```

Handlers use Electron's `desktopCapturer`, `screen`, and native APIs to interact with the OS.

---

## Prompt Section

`Prompt.js` builds instructions that tell the AI how and when to use computer use tools:

```js
export function buildComputerUsePromptSection() {
  return '...';  // Loaded from prompt template
}
```
