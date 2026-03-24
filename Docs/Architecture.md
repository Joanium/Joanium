# Architecture

Romelson is an Electron app. Understanding Electron's two-process model is the key to understanding everything else.

---

## The Two Processes

### Main Process (`App.js` → `Packages/Main/`)
- Runs in Node.js. Has full access to the file system, OS APIs, and native Electron APIs.
- Creates the `BrowserWindow`, manages the app lifecycle.
- Hosts the `AutomationEngine` and `ConnectorEngine` as singletons.
- Registers IPC handlers — these are the bridge to the renderer.
- **Never touches the DOM.**

### Renderer Process (`Public/`)
- Runs in Chromium. A normal browser environment.
- Has NO direct Node.js access (contextIsolation is ON, nodeIntegration is OFF — this is intentional for security).
- Communicates with main via `window.electronAPI` — a safe bridge injected by the preload script.
- **Never touches the file system directly.**

---

## How a Chat Message Flows

```
User types a message and hits Send
    ↓
Composer.js collects text + attachments from state
    ↓
Chat.js sendMessage() is called
    ↓
Agent.js planRequest() — one AI call determines which tools/skills are needed
    ↓
Agent.js agentLoop() — streams the response, executes tool calls
    ↓
  [If a tool call is needed]
  Tool executor (e.g. GmailExecutor.js) runs
  It calls window.electronAPI.gmailGetBrief() 
      ↓
  IPC: renderer → main via ipcRenderer.invoke('gmail-get-brief')
      ↓
  GmailIPC.js handler runs in main process
      ↓
  Gmail.js calls the Gmail REST API with stored credentials
      ↓
  Result sent back to renderer via IPC return value
      ↓
  Tool result injected into AI conversation as a user message
    ↓
Agent loop continues until AI produces a final text response
    ↓
Live bubble in Chat.js finalizes — markdown rendered, token footer appended
    ↓
Chat.js saves the conversation to Data/Chats/{chatId}.json via IPC
```

---

## IPC Architecture

The preload script (`Packages/Electron/Preload.js`) is the only file that can use both `contextBridge` and `ipcRenderer`. It exposes a single `window.electronAPI` object to the renderer — a clean, explicit API surface.

Every IPC channel is registered in a dedicated file under `Packages/Main/IPC/`. Each file handles one domain:

| File | Channels |
|---|---|
| `ChatIPC.js` | save-chat, get-chats, load-chat, delete-chat |
| `UserIPC.js` | get-user, get-models, save-user-profile, get-memory, save-memory, etc. |
| `SystemIPC.js` | get-system-prompt |
| `ConnectorIPC.js` | get-connectors, save-connector, remove-connector, toggle-free-connector, etc. |
| `GmailIPC.js` | gmail-oauth-start, gmail-get-brief, gmail-get-unread, gmail-send, gmail-search |
| `GithubIPC.js` | github-get-repos, github-get-file, github-get-tree, github-get-issues, etc. |
| `AutomationIPC.js` | get-automations, save-automation, delete-automation, toggle-automation |
| `SkillsIPC.js` | get-skills |
| `PersonasIPC.js` | get-personas, get-active-persona, set-active-persona, reset-active-persona |
| `UsageIPC.js` | track-usage, get-usage, clear-usage, launch-usage |
| `WindowIPC.js` | window-minimize, window-maximize, window-close |
| `SetupIPC.js` | save-user, save-api-keys, launch-main, launch-skills, launch-personas |

---

## Data Layer

All data lives in `Data/` at the project root. The main process reads and writes these files directly using Node.js `fs`. The renderer never touches the file system.

```
Data/
├── User.json              — name, api_keys, preferences
├── Models.json            — provider/model definitions with pricing (static, ships with app)
├── Connectors.json        — connector credentials and enabled state
├── Automations.json       — saved automation definitions
├── ActivePersona.json     — which persona is currently active (if any)
├── Usage.json             — token usage records (up to 20,000 entries)
├── Memory.md              — user's persistent memory notes
├── CustomInstructions.md  — AI behaviour instructions
└── Chats/
    └── {chatId}.json      — one file per conversation
```

**Paths are centralised in `Packages/Main/Paths.js`** — every module imports from there, never constructs its own paths.

---

## The Agent Loop

`Agent.js` contains the intelligence layer of the chat system. It has three responsibilities:

### 1. `buildFailoverCandidates()`
Produces an ordered list of model candidates to try if the primary model fails. Same-provider models are tried first (ranked by `rank` field), then the best model from each other provider.

### 2. `planRequest()`
Before the main response, a fast planning call analyses the user's message and returns:
- Which **skills** to surface (injected as context into the system prompt area of the log)
- Which **tools** to call and with what **exact parameters**

This planning step eliminates the "missing required parameter" failure mode — the planner pre-fills arguments before the agent loop starts.

### 3. `agentLoop()`
The main streaming loop. On each turn it:
1. Calls the model with the current message history
2. If the model returns **text** → done, finalize the bubble
3. If the model returns a **tool call** → execute it, inject the result, loop again
4. Repeats up to 10 turns

The loop also handles:
- Per-turn model failover (tries each candidate in order on error)
- Retry with exponential backoff (up to 3× on transient errors)
- Stream interruption detection (doesn't retry if tokens were already visible)

---

## System Prompt Construction

`Packages/System/SystemPrompt.js` builds the system prompt dynamically on each request. It includes:

- Active persona instructions (or default assistant text)
- User's name, local time, OS info, country (via ip-api.co)
- Connected services (Gmail email, GitHub username + repo list)
- User's Memory.md content
- User's CustomInstructions.md content
- All installed Skills (name + trigger + description)

The built prompt is **cached for 5 minutes** by `SystemPromptService.js` and invalidated whenever settings change (settings save, connector connect/disconnect, persona switch).

---

## Multi-Page Architecture

Romelson is not a single-page app. Each page is a separate HTML file loaded into the same `BrowserWindow`:

| HTML file | Purpose |
|---|---|
| `Setup.html` | First-run onboarding wizard |
| `index.html` | Main chat interface |
| `Automations.html` | Automation builder and grid |
| `Skills.html` | Skills browser |
| `Personas.html` | Persona selection grid |
| `Usage.html` | Token usage analytics |

Navigation between pages is handled by IPC (`loadPage()` in `Window.js`) — the automation engine and connector engine remain alive in the main process across page navigations.

---

## State Management

The renderer uses a simple shared mutable state object (`Packages/Shared/State.js`):

```javascript
export const state = {
  messages: [],           // current conversation
  composerAttachments: [],
  isTyping: false,
  currentChatId: null,
  providers: [],          // AI providers with valid API keys
  selectedProvider: null,
  selectedModel: null,
  userName: '',
  systemPrompt: '',
  theme: 'dark',
}
```

This is imported directly by any module that needs it. There is no Redux, no Zustand, no reactivity layer — state changes trigger DOM updates via explicit function calls.
