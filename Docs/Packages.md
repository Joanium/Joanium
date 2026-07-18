# Packages Reference

Detailed reference for every package in `Packages/`. Each package is an independent microservice with a single `Index.js` entry point.

---

## Package List

| Package | Type | Description |
|---|---|---|
| [Boot](#boot) | Infrastructure | Package auto-discovery engine |
| [Electron](#electron) | Infrastructure | Electron main process shell |
| [Shell](#shell) | Infrastructure | Main app shell and SPA router |
| [Shared](#shared) | Library | Cross-package shared utilities |
| [Chat](#chat) | Feature | Conversation engine |
| [Toolset](#toolset) | Feature | AI tools and connectors |
| [Providers](#providers) | Feature | AI provider management |
| [Memory](#memory) | Feature | Long-term personal memory |
| [Agents](#agents) | Feature | Scheduled background agents |
| [Channels](#channels) | Feature | External messaging gateway |
| [MCP](#mcp) | Feature | Model Context Protocol |
| [Setup](#setup) | Feature | Onboarding wizard |
| [History](#history) | Feature | Chat session persistence |
| [Themes](#themes) | Feature | UI theme management |
| [Security](#security) | Feature | App lock and password |
| [User](#user) | Feature | User profile and instructions |
| [About](#about) | Feature | App metadata and what's new |
| [Projects](#projects) | Feature | Project workspace management |
| [Templates](#templates) | Feature | Prompt template storage |
| [Skills](#skills) | Feature | AI skill documents |
| [Personas](#personas) | Feature | AI persona management |
| [SlashCommands](#slashcommands) | Feature | Chat slash command registry |
| [Events](#events) | Feature | Event feed panel |
| [Usage](#usage) | Feature | Token usage analytics |
| [Leaderboard](#leaderboard) | Feature | Usage leaderboard |
| [LiveBrowser](#livebrowser) | Feature | Embedded browser preview |
| [Marketplace](#marketplace) | Feature | Marketplace installer |
| [AppSettings](#appsettings) | Feature | Application settings + runtime |

---

## Boot

**Path**: `Packages/Boot/`
**Type**: Infrastructure

Auto-discovers packages by scanning `Packages/` for directories with non-empty `Index.js`.

### Exports

- `discoverPackages(packagesDirectory)` → `Map<name, { id, entryPath }>` — Scans for packages
- `loadPackageModule(registry, packageName)` → dynamic `import()` — Loads a package's Index.js
- `createBootLogger(logFilePath)` → timestamped logging function

### Behavior

- Filters out non-directories and directories without `Index.js`
- Skips empty files (size > 0 check)
- Uses `pathToFileURL` for cross-platform dynamic imports

---

## Electron

**Path**: `Packages/Electron/`
**Type**: Infrastructure

Electron main process configuration. Creates BrowserWindow, manages IPC registration, enforces production security.

### Exports

- `bootElectron({ entryPackage, loadPackage })` — Creates window, registers IPC, starts app

### Behavior

**Chromium flags** (applied before app ready):

- `disable-renderer-backgrounding` — Prevents timer/IPC throttling when backgrounded
- `disable-background-timer-throttling` — Same for background timers
- `disable-backgrounding-occluded-windows` — Same for occluded windows
- `force-color-profile srgb` — Consistent color rendering
- `disable-features CalculateNativeWinOcclusion,OccludedWindowWebContentsExperiment` — Prevents Windows occlusion-based throttling
- `enable-features EarlyEstablishGpuChannel,EstablishGpuChannelAsync` — Faster GPU initialization

**Protocol registration**:

- Registers `app://` as a privileged scheme with `standard`, `secure`, and `supportFetchAPI` privileges
- Protocol handler serves files from resource directories via `app://AssetName/path`

**Window creation**:

- Frameless window with `titlebarStyle: hidden` (macOS native) or `titlebarOverlay` (Windows/Linux)
- Min size: 1160×780
- Background color: `#f2eafa`
- Context isolation enabled, sandbox disabled, node integration disabled
- DevTools disabled in packaged builds
- Window state persistence (bounds, maximized) via `Data/WindowState.json`

**Production hardening** (packaged builds only):

- Blocks reload, hard-reload, DevTools, view-source keyboard shortcuts via `before-input-event`
- Suppresses default Chromium context menu (removes "Inspect" and "View Page Source")
- Strips default application menu (removes Ctrl+R, F5, Ctrl+Shift+R, F12, Ctrl+U accelerators)
- Applied to all WebContents via `web-contents-created` event

**Other behaviors**:

- `powerSaveBlocker.start('prevent-app-suspension')` on launch
- Geolocation permission granted for Location tools
- Background throttling disabled on both webPreferences and WebContents level
- Compositor invalidated on window focus/show for immediate repaint
- Boot logging to `Build/Logs/electron-boot.log` (dev) or `process.resourcesPath/Logs/electron-boot.log` (packaged)
- Navigation via `app:navigate` IPC — creates new window, destroys old one, transfers IPC handlers

### Internal

- `Core/WindowState.js` — Reads/writes window bounds to `Data/WindowState.json`

---

## Shell

**Path**: `Packages/Shell/`
**Type**: Infrastructure

Main app container. Declares all other packages as `ipcCompanions`, merging their IPC handlers into one BrowserWindow.

### Exports

- `createPackage({ rootDirectory, registry })` — Returns package config with `ipcCompanions` resolved dynamically

### Behavior

- Excludes `Boot`, `Electron`, `LiveBrowser`, `Setup`, `Shared`, and `Shell` itself from companions
- All other packages are sorted alphabetically and merged as companions
- `shell:bootstrap` IPC handler returns user state for renderer

### Internal

- `UI/App.html` — Main app shell HTML
- `UI/Preload.js` — Preload script
- `UI/ShellApp.js` — SPA router
- `UI/ShellApp.css` — Main styles
- `UI/Shortcuts.js` — Keyboard shortcuts
- `UI/ShortcutsPanel.js` — Shortcuts reference panel

---

## Shared

**Path**: `Packages/Shared/`
**Type**: Library

The ONLY package other packages may import from. Contains 34+ modules organized by concern.

See [SharedLibrary.md](SharedLibrary.md) and [AssistantPipeline.md](AssistantPipeline.md) for full details.

---

## Chat

**Path**: `Packages/Chat/`
**Type**: Feature

Core conversation engine. Builds AI system prompts, handles streaming completions, manages attachments.

### IPC Handlers (11 channels)

| Channel | Purpose |
|---|---|
| `chat:bootstrap` | Initial chat state for renderer |
| `chat:stream-message` | Streams AI response with chunk/done/error events |
| `chat:cancel-stream` | Aborts a specific stream |
| `chat:cancel-all-streams` | Aborts all active streams |
| `chat:stream-message-agent` | Routes streaming to agent channels |
| `chat:complete-message` | Non-streaming completion |
| `chat:enhance-prompt` | AI-powered prompt rewriting |
| `chat:select-attachments` | Native file picker with multi-select |
| `chat:process-dropped-files` | Drag-and-drop file processing |
| `chat:get-terminal-prompt` | Terminal prompt context |
| `chat:fetch-url` | Proxies HTTP GET (CSP bypass) |

### Behavior

**System prompt assembly** (`ChatState.js`):

1. Reads `Prompts/System.md` and appends runtime metadata (user, version, time, timezone, locale, platform, home directory)
2. Concatenates: base prompt + persona + mode instruction + custom instructions + project context + memory context + terminal tools + toolset tools + skills context
3. When no project is open, appends "No Project Context" instruction restricting AI to conversational responses
4. Prepends `latestUserMessageAnchor` for weak model grounding

**Streaming** (`ChatState.js`):

- Uses Node.js HTTP (not Electron's fetch) for direct SSE streaming
- Three provider-specific paths: OpenAI-compatible, Anthropic, Google Gemini
- Supports multimodal user turns (image attachments as base64)
- Retry logic: up to 3 attempts with exponential backoff for transient errors (429, 500, 502, 503, 504, network codes)
- Empty responses are retried as transient failures
- Once tokens start streaming, failures are surfaced immediately (no mid-stream retry)

**Provider support**:

- OpenAI-compatible: 30+ providers (OpenAI, Anthropic via proxy, DeepSeek, Groq, Mistral, etc.)
- Anthropic native: Extended thinking support (thinking_delta events)
- Google Gemini: Native API with endpoint swap to streamGenerateContent

**Usage tracking**:

- Estimates tokens (~4 chars/token) for input and output
- Records per-model usage in `Data/Usage/`

### Internal

- `Core/ChatState.js` — AI request builder, provider routing, streaming
- `Core/ChatAttachments.js` — File extraction for PDF, DOCX, XLSX, PPTX, code, images
- `UI/` — ChatApp, MessageElements, TerminalPanel, ThinkingBlock, SubAgentSections, ModelPickerPanel, AttachmentPill, BrowserPreviewPanel, DropZoneOverlay, FileDiffTracker, GitBranchPickerPanel, TechFeedPanel, DiagnosticPanel, CompletionSound, WhatsNewOverlay, Utils
- `Prompts/Prompts.js` — Chat-specific prompt templates

See [ChatUI.md](ChatUI.md) and [Prompts.md](Prompts.md) for full details.

---

## Toolset

**Path**: `Packages/Toolset/`
**Type**: Feature

Discovers, manages, and executes AI-callable tools. Handles connector credentials and OAuth.

### IPC Handlers (6 channels)

| Channel | Purpose |
|---|---|
| `toolset:list-tools` | Active tools filtered by connector state |
| `toolset:execute-tool` | Execute a tool by name with parameters |
| `connectors:list` | All connectors with status |
| `connectors:save` | Save connector credentials |
| `connectors:remove` | Remove a connector |
| `connectors:google-oauth` | Google OAuth flow |

### Behavior

**Tool discovery** (`ToolDiscovery.js`):

- Scans `Tools/` for subdirectories with `Index.js` (skips `Core/` support directory)
- Discovers external tool packages from other packages (e.g., `LiveBrowser`)
- Each tool package exports: `toolDefinitions`, `toolHandlers`, `promptSections`, `connectors`, `ipcHandlers`
- Normalizes connector definitions (adds `optional: false`, `credentialKey: 'token'` defaults)

**Tool execution** (`ToolsetService.js`):

- 30-second default timeout per tool
- Normalizes parameters: merges `parameters`, `arguments`, and top-level keys into one object
- Returns `{ ok, tool, output }` on success or `{ ok, tool, error }` on failure
- Debug logging for execution duration and output length

**Connector filtering** (`ConnectorFilter.js`):

- Partitions connectors into active/disconnected
- Filters tool definitions and prompt sections by active connector IDs
- Builds connected/disconnected hint messages for the system prompt

**Tool packages** (27):
Cloudflare, Command, ComputerUse, Directory, Figma, Git, GitHub, GitLab, Google, GoogleWorkspace, HubSpot, Jira, Knowledge, Linear, Location, Netlify, Notion, OpenWeather, Productivity, PublicData, Sentry, Spotify, Stripe, SubAgents, Supabase, Unsplash, Vercel

**Built-in tools** (in ToolsetService.js):
Math (expression evaluator), unit conversion (30+ units), date/time utilities (20+ functions), URL parsing/manipulation (15+ functions), geospatial math (8 functions), UUID generation, hashing (SHA-1/256/384/512), Base64 encode/decode, JSON formatting, text transforms, text stats, password generation

See [Toolset.md](Toolset.md) for full details.

---

## Providers

**Path**: `Packages/Providers/`
**Type**: Feature

Manages AI provider configuration — API keys, endpoints, model lists.

### IPC Handlers (6 channels)

| Channel | Purpose |
|---|---|
| `providers:list-catalog` | Full provider catalog with model lists |
| `providers:list-configured` | Only configured providers |
| `providers:save` | Save provider config + trigger model sync |
| `providers:remove` | Remove provider config |
| `providers:list-model-favourites` | List favourited models |
| `providers:toggle-model-favourite` | Toggle model favourite status |

### Behavior

**Provider state** (`ProviderState.js`):

- Reads/writes provider state from `Data/User.json`
- Background model-list sync with 1-hour TTL per provider
- Sync delayed by 15 seconds on startup to avoid boot interference
- No-op in packaged builds

**Model favourites** (`ModelFavouritesState.js`):

- Persists favourited models per provider
- Used for quick model selection in the UI

**Supported providers**: 35 provider definitions including OpenAI, Anthropic, Google Gemini, xAI, Mistral, Cohere, DeepSeek, Groq, Fireworks, Together, Perplexity, AI21, Alibaba, MiniMax, Moonshot, Writer, StepFun, ZAI, OpenRouter, Requesty, Ollama, LM Studio, Cerebras, HuggingFace, Hyperbolic, Lambda, Novita, Nvidia, Parasail, SambaNova, SiliconFlow, GitHub Models, Vercel AI Gateway, MuleRouter, and Poe.

See [Providers.md](Providers.md) for full details.

---

## Memory

**Path**: `Packages/Memory/`
**Type**: Feature

Long-term personal memory stored as markdown files in `Data/Memories/`.

### IPC Handlers (16 channels)

| Channel | Purpose |
|---|---|
| `memory:list` | List all memory files |
| `memory:read` | Read a memory file |
| `memory:save` | Save/update a memory file |
| `memory:search` | Search memories by query |
| `memory:get-context` | Get memory context for AI (max chars) |
| `memory:get-catalog` | Memory catalog |
| `memory:get-export-prompt` | Prompt for exporting memory |
| `memory:get-triage-prompt` | Prompt for triaging memory |
| `memory:get-import-prompt` | Prompt for importing memory |
| `memory:apply-updates` | Apply AI-generated memory updates |
| `memory:delete` | Delete a memory file |
| `memory:cleanup-ai-reply` | Handle AI cleanup response |
| `memory:cleanup-renderer-ready` | Renderer ready for cleanup |
| `memory:run-cleanup` | Trigger memory cleanup |
| `memory:list-dreams` | List dream journal entries |
| `memory:read-dream` | Read a dream journal entry |

### Behavior

**Auto memory updates**:
After saved non-private chat sessions, `History` marks sessions as pending memory sync. Background sync uses `Prompts/Memory.md` to extract durable user facts. `memory:apply-updates` writes facts back to `Data/Memories`. Session is marked as memory-synced.

**Memory cleanup** (`MemoryCleanup.js`):

- Automatic deduplication service started on package creation
- Uses AI to identify redundant memories
- Merges or removes duplicates
- Dream journal for periodic memory consolidation

**Memory context**:
`memory:get-context` returns a compact representation of memories for the AI's system context, limited to a maximum character count.

See [Memory.md](Memory.md) for full details.

---

## Agents

**Path**: `Packages/Agents/`
**Type**: Feature

Background agent scheduling and execution. Uses renderer-delegated tool loop pattern.

### IPC Handlers (13 channels)

| Channel | Purpose |
|---|---|
| `agents:renderer-ready` | Handshake — unblocks startup agents |
| `agents:tool-reply` | Resolves pending agent runs |
| `agents:progress` | Streaming progress to run log |
| `agents:save-agent` | Create/update an agent |
| `agents:list-agents` | List all agents |
| `agents:load-agent` | Load a specific agent |
| `agents:delete-agent` | Delete an agent |
| `agents:run-agent` | Manually trigger an agent |
| `agents:list-runs` | List run history |
| `agents:clear-runs` | Clear run history |
| `agents:list-avatars` | List agent avatar images |
| `agents:load-run-detail` | Load a single run log enriched with steps |
| `agents:list-run-ids` | Lightweight list of run IDs + metadata |

### Behavior

**Scheduler** (`AgentScheduler.js`):

- Ticks every 60 seconds
- Checks each enabled agent's schedule against current time
- Runs agents sequentially with 5-second gaps (prevents rate limiting)
- Pre-queues agents so the Events feed shows pending status immediately
- Waits for renderer-ready handshake before dispatching startup agents

**Schedule types**:

- `startup` — Runs once when the app starts
- `daily` — Runs every day at `HH:MM`
- `weekly` — Runs on a specific day at `HH:MM` (0=Sun, 6=Sat)
- `weekdays` — Runs Mon–Fri at `HH:MM`
- `weekends` — Runs Sat–Sun at `HH:MM`

**Execution**:

1. Main process scheduler sends `agents:run-with-tools` to the renderer
2. `AgentGateway.js` runs the shared assistant pipeline using `chat:complete-message`
3. Results flow back via `agents:tool-reply` IPC handler
4. 30-minute timeout per agent
5. Run logs stored in `Data/Agents/Runs/` with full execution trace

**Key differences from Chat**:

- `maxToolCalls` is 1000 (vs 10 for Chat)
- Uses `AGENT_TERMINAL_TOOLS` (all terminal tools)
- Includes agent-specific prompt context
- Streams progress via `agents:progress` to run log

See [AgentInternals.md](AgentInternals.md) for full details.

---

## Channels

**Path**: `Packages/Channels/`
**Type**: Feature

Multi-platform messaging gateway. Supports Telegram, WhatsApp, Discord, Slack, Mattermost, Zulip, ntfy.

### IPC Handlers (12 channels)

| Channel | Purpose |
|---|---|
| `channels:icon-paths` | Channel icon file paths |
| `channels:list` | List all channels |
| `channels:get` | Get a specific channel |
| `channels:save` | Save/update a channel |
| `channels:remove` | Remove a channel |
| `channels:toggle` | Enable/disable a channel |
| `channels:validate` | Validate credentials per channel type |
| `channels:reply` | Send reply to a channel message |
| `channels:save-message` | Save a channel message |
| `channels:list-messages` | List channel messages |
| `channels:delete-message` | Delete a channel message |
| `channels:clear-messages` | Clear all channel messages |

### Behavior

**Runtime** (`ChannelRuntime.js`):

- Periodic message polling for channels that don't support webhooks
- Credential verification per channel type
- AI response dispatch back to channels
- Uses shared assistant pipeline for replies

**Channel-specific validation**:

- Telegram: Verify bot token
- WhatsApp: Verify Twilio accountSid and auth token
- Discord: Verify bot token and channel ID
- Slack: Verify bot token and channel ID
- Zulip: Verify site URL, bot email, API key, and stream
- Mattermost: Verify site URL, access token, and channel ID
- ntfy: Verify site URL and topic

See [Channels.md](Channels.md) for full details.

---

## MCP

**Path**: `Packages/MCP/`
**Type**: Feature

Manages Model Context Protocol server connections.

### IPC Handlers (8 channels)

| Channel | Purpose |
|---|---|
| `mcp:list-servers` | List all MCP servers with connection status |
| `mcp:save-server` | Save/update an MCP server configuration |
| `mcp:remove-server` | Remove an MCP server |
| `mcp:set-enabled` | Enable/disable a server (auto-connects/disconnects) |
| `mcp:connect-server` | Manually connect to a server |
| `mcp:disconnect-server` | Manually disconnect from a server |
| `mcp:list-tools` | List tools from all connected servers |
| `mcp:call-tool` | Execute an MCP tool |

### Behavior

**Registry** (`MCPRegistry.js`):

- Manages connections using JSON-RPC 2.0 (protocol version `2024-11-05`)
- Client info: `{ name: 'Joanium', version: '0.2.0' }`
- Transport types: stdio (child process) or SSE (HTTP Server-Sent Events)
- Auto-connects all enabled servers on app startup
- Each connection managed by `MCPSession` class (tracks pending requests, dispatches responses)

**Tool integration**:
MCP tools are exposed to the AI through the Toolset system. `mcp:list-tools` returns all tools from connected servers, merged with built-in and connector tools.

See [MCP.md](MCP.md) for full details.

---

## Setup

**Path**: `Packages/Setup/`
**Type**: Feature

First-run onboarding wizard. Has its own BrowserWindow (separate from Shell).

### Exports

- `createPackage()` — Standard package factory
- `resolveLaunchPackage()` — Returns `'Setup'` or `'Shell'` based on onboarding state

### IPC Handlers (4 channels)

| Channel | Purpose |
|---|---|
| `setup:bootstrap` | Current onboarding state |
| `setup:save-draft` | Save partial onboarding state |
| `setup:complete` | Mark onboarding complete |
| `setup:import-backup` | Import backup during onboarding |

### Onboarding Flow

1. Greet user, accept terms and conditions
2. Ask for user's name
3. Ask for user's age
4. AI model selection (API or local)
5. "Congrats" confirmation → navigate to chat

---

## History

**Path**: `Packages/History/`
**Type**: Feature

Chat session persistence. Backend-only (no renderer).

### IPC Handlers (11 channels)

| Channel | Purpose |
|---|---|
| `history:save-session` | Save a chat session |
| `history:list-sessions` | List sessions (project-filtered) |
| `history:load-session` | Load a session |
| `history:delete-session` | Delete a session |
| `history:delete-all-sessions` | Delete all sessions for a project |
| `history:rename-session` | Rename a session |
| `history:pin-session` | Pin/unpin a session |
| `history:list-memory-pending` | Sessions pending memory sync |
| `history:mark-memory-synced` | Mark session as memory-synced |
| `history:fork-session` | Fork session at a message index |
| `history:search-sessions` | Search sessions by query |

---

## Themes

**Path**: `Packages/Themes/`
**Type**: Feature

UI theme management (light/dark mode, reduced motion, interface font).

### IPC Handlers (2 channels)

`themes:get`, `themes:save`

---

## Security

**Path**: `Packages/Security/`
**Type**: Feature

Password protection and app lock.

### IPC Handlers (10 channels)

| Channel | Purpose |
|---|---|
| `security:get-status` | Lock status |
| `security:enable` | Enable lock with password and recovery |
| `security:disable` | Disable lock (requires current password) |
| `security:verify-password` | Verify password |
| `security:verify-answer` | Verify recovery answer |
| `security:get-auto-lock-timeout` | Get auto-lock timeout |
| `security:set-auto-lock-timeout` | Set auto-lock timeout |
| `security:change-password` | Change password |
| `security:get-backup-state` | Get backup for tamper detection |
| `security:restore-from-backup` | Restore from backup |

### Behavior

**Password hashing**: PBKDF2-SHA512 with 210,000 iterations, 64-byte hash, 256-bit salt
**Rate limiting**: Progressive lockout (3+ → 30s, 5+ → 5min, 7+ → 15min, 10+ → 1hr)
**Tamper detection**: Renderer stores backup in sessionStorage/localStorage for credential recovery

See [Security.md](Security.md) for full details.

---

## User

**Path**: `Packages/User/`
**Type**: Feature

User identity management and custom instructions.

### IPC Handlers (7 channels)

| Channel | Purpose |
|---|---|
| `user:get-profile` | Get user profile |
| `user:save-profile` | Save user profile |
| `user:get-custom-instructions` | Get custom AI behavior |
| `user:save-custom-instructions` | Save custom AI behavior |
| `user:pick-avatar` | Native file picker for avatar |
| `user:save-avatar` | Save avatar image |
| `user:remove-avatar` | Remove avatar image |

---

## About

**Path**: `Packages/About/`
**Type**: Feature

App metadata, external links, and what's new.

### IPC Handlers (4 channels)

| Channel | Purpose |
|---|---|
| `about:get-info` | App version, system info |
| `about:open-external` | Opens URLs in system browser |
| `whats-new:get` | Get changelog data |
| `whats-new:mark-seen` | Mark changelog as seen |

---

## Projects

**Path**: `Packages/Projects/`
**Type**: Feature

Project workspace management.

### IPC Handlers (7 channels)

| Channel | Purpose |
|---|---|
| `projects:save-project` | Save/update a project |
| `projects:list-projects` | List all projects |
| `projects:load-project` | Load a project |
| `projects:delete-project` | Delete a project |
| `projects:select-cover` | Image picker for project cover |
| `projects:read-project-docs` | Reads and formats project documentation |
| `projects:select-directory` | Directory picker |

---

## Templates

**Path**: `Packages/Templates/`
**Type**: Feature

Prompt template storage. Backend-only.

### IPC Handlers (4 channels)

`templates:save-template`, `templates:list-templates`, `templates:load-template`, `templates:delete-template`

---

## Skills

**Path**: `Packages/Skills/`
**Type**: Feature

Read-only AI skill documents (markdown files in `Skills/`).

### IPC Handlers (3 channels)

`skills:list-skills`, `skills:load-skill`, `skills:delete-skill`

---

## Personas

**Path**: `Packages/Personas/`
**Type**: Feature

AI persona documents (markdown files in `Personas/`).

### IPC Handlers (5 channels)

| Channel | Purpose |
|---|---|
| `personas:list-personas` | List all personas |
| `personas:load-persona` | Load a persona |
| `personas:delete-persona` | Delete a persona |
| `personas:get-active-persona` | Get active persona |
| `personas:set-active-persona` | Set active persona |

---

## SlashCommands

**Path**: `Packages/SlashCommands/`
**Type**: Feature

Slash command registry for chat input.

### IPC Handlers (2 channels)

`slash-commands:list`, `slash-commands:get-mode-instruction`

### Behavior

- 10 action commands (`/lock`, `/close`, `/restart`, `/memory-sync`, `/private`, `/new`, `/terminal`, `/settings`, `/light`, `/dark`)
- 101 mode commands (`/judge`, `/human`, `/godmode`, `/eli5`, etc.) — each reads from `Prompts/Modes/<id>.md`
- 9 navigation commands (`/projects`, `/memory`, `/templates`, `/agents`, `/skills`, `/personas`, `/marketplace`, `/events`, `/usage`)

See [SlashCommands.md](SlashCommands.md) for full details.

---

## Events

**Path**: `Packages/Events/`
**Type**: Feature

Event feed panel. UI-only stub with no IPC handlers.

---

## Usage

**Path**: `Packages/Usage/`
**Type**: Feature

Token usage analytics.

### IPC Handler (1 channel)

`usage:get-data` — Returns aggregated usage data.

---

## Leaderboard

**Path**: `Packages/Leaderboard/`
**Type**: Feature

Usage leaderboard. UI-only stub with no IPC handlers.

---

## LiveBrowser

**Path**: `Packages/LiveBrowser/`
**Type**: Feature

Embedded Chromium browser view with AI tools.

### Dual Export Pattern

```js
// For Shell (IPC handlers)
export async function createPackage({ rootDirectory }) { ... }

// For Toolset (tool discovery)
export function createToolPackage() { ... }
```

### IPC Handlers (18 channels)

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

### Browser Tools

12 AI-callable tools: `browser_navigate`, `browser_get_state`, `browser_snapshot`, `browser_get_text`, `browser_click`, `browser_type`, `browser_press_key`, `browser_scroll`, `browser_back`, `browser_forward`, `browser_refresh`, `browser_screenshot`

See [LiveBrowser.md](LiveBrowser.md) for full details.

---

## Marketplace

**Path**: `Packages/Marketplace/`
**Type**: Feature

Installs marketplace items (skills, personas).

### IPC Handler (1 channel)

`marketplace:install-item` — Writes markdown to appropriate directory.

---

## AppSettings

**Path**: `Packages/AppSettings/`
**Type**: Feature

Application settings with runtime side effects. The most complex settings package.

### IPC Handlers (10 channels)

| Channel | Purpose |
|---|---|
| `app-settings:get` | Get current settings |
| `app-settings:save` | Save settings (triggers runtime side effects) |
| `auto-update:get-state` | Get auto-update state |
| `auto-update:check` | Check for updates |
| `auto-update:install` | Install available update |
| `app-settings:reset-app` | Factory reset (deletes user data, relaunches) |
| `app-settings:restart-app` | Restart the app |
| `app-settings:quit-app` | Quit the app |
| `data:export` | Export all data as ZIP |
| `data:import` | Import data from ZIP |

### Runtime Side Effects

- **Keep-awake**: Starts/stops `powerSaveBlocker`
- **Auto-update**: Checks for updates on app start if enabled
- **Run-on-startup**: Sets `app.setLoginItemSettings({ openAtLogin })` (with `openAsHidden` on macOS/Windows)
- **App reset**: Deletes all entries from `KNOWN_DATA_ENTRIES` and relaunches
- **Data portability**: ZIP export/import using jszip

See [AppSettings.md](AppSettings.md) for full details.
