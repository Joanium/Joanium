# Architecture

Joanium is a **local-first AI desktop assistant** built with Electron and vanilla JavaScript (ESM). No React, no frameworks. Node.js 24.18.0. Cross-platform: Windows, macOS, Linux.

---

## Core Principles

- **Local-first**: User data lives on the user's machine. No telemetry, no cloud sync unless opt-in.
- **Provider-agnostic**: No single AI vendor is a dependency. Swap models freely.
- **Composable**: Capabilities, features, skills, and personas are modular and independently extensible.
- **Desktop-grade UX**: Native desktop app, not a web app wrapped in a frame.
- **Developer-friendly**: Readable, well-structured vanilla JavaScript — no heavy build toolchain.

---

## Tech Stack

- **Runtime**: Node.js 24.18.0, Electron 43.1.1
- **Language**: JavaScript (ESM only — no CommonJS)
- **UI**: Vanilla JS, CSS, custom DOM utilities
- **Build**: electron-builder 26.11.1, custom build scripts
- **Linting**: ESLint 10.7.0, Prettier 3.9.5, markdownlint 0.49.0
- **Testing**: Fast-check (fuzz), manual
- **Key dependencies**: electron-updater 6.8.9, jszip, mammoth (DOCX), pdf-parse, exceljs

---

## Folder Roles

| Folder | Purpose | Read/Write | Packaging |
|---|---|---|---|
| `Packages/` | All features. Each is an independent package. | Read (code) | Inside asar |
| `Packages/Shared/` | Code used by more than one package. | Read (code) | Inside asar |
| `Assets/` | Images, audio, video. | Read-only | Inside asar |
| `Config/` | App config files (model catalogs). | Read-only | Inside asar |
| `Data/` | User data. | Read-write | Outside asar |
| `Datasets/` | Static datasets (greetings, suggestions). | Read-only | Inside asar |
| `Personas/` | AI persona markdown files. | Read-write | Outside asar |
| `Prompts/` | System prompt markdown files. | Read-only | Inside asar |
| `Scripts/` | Build scripts only. | Read-only | N/A |
| `Skills/` | AI skill markdown files. | Read-write | Outside asar |
| `Docs/` | Developer documentation. | Read-only | N/A |

---

## Package Internal Structure

Every package follows this layout:

```text
Packages/<Name>/
├── Index.js       ← Only public entry point. Other packages import ONLY this.
├── Core/          ← Backend logic (state, services, business rules)
├── UI/            ← Renderer process (HTML, CSS, JS)
├── IPC/           ← Inter-process communication handlers
├── I18n/          ← All user-facing strings (English is default/fallback)
└── Utils.js       ← Helpers for this package (only if needed)
```

### Package Index

There are **28 packages** in `Packages/` (plus `Index.js` which is the bootstrap entry):

| Package | Type | Description |
|---|---|---|
| Boot | Infrastructure | Package auto-discovery engine |
| Electron | Infrastructure | Electron main process shell, window creation, production hardening |
| Shell | Infrastructure | Main app shell, SPA router, ipcCompanion resolution |
| Shared | Library | Cross-package shared utilities, components, runtime |
| Chat | Feature | Conversation engine, AI streaming, prompt assembly |
| Toolset | Feature | AI tools, connectors, built-in utilities |
| Providers | Feature | AI provider management, model catalogs |
| Memory | Feature | Long-term personal memory |
| Agents | Feature | Scheduled background agents |
| Channels | Feature | External messaging gateway |
| MCP | Feature | Model Context Protocol server connections |
| Setup | Feature | Onboarding wizard |
| History | Feature | Chat session persistence |
| Themes | Feature | UI theme management |
| Security | Feature | App lock, password protection |
| User | Feature | User profile and custom instructions |
| About | Feature | App metadata, what's new |
| Projects | Feature | Project workspace management |
| Templates | Feature | Prompt template storage |
| Skills | Feature | AI skill documents |
| Personas | Feature | AI persona management |
| SlashCommands | Feature | Chat slash command registry |
| Events | Feature | Event feed panel (stub) |
| Usage | Feature | Token usage analytics |
| Leaderboard | Feature | Usage leaderboard (stub) |
| LiveBrowser | Feature | Embedded browser preview with AI tools |
| Marketplace | Feature | Marketplace installer |
| AppSettings | Feature | Application settings with runtime side effects |

---

## Architectural Pattern: Feature-Based / Vertical Slice

Each package owns its complete vertical slice — backend, UI, IPC, and i18n. Packages communicate exclusively via IPC. The only shared code lives in `Packages/Shared/`.

### IPC Composition

The Shell package declares all other packages as `ipcCompanions`. This merges every package's IPC handlers into a single BrowserWindow without cross-package imports:

```text
Shell BrowserWindow
├── Shell's own IPC handlers (shell:bootstrap)
├── Chat's IPC handlers (11 channels)
├── Memory's IPC handlers (16 channels)
├── Toolset's IPC handlers (6 channels)
├── ... (all other packages)
```

The companion resolution excludes: `Boot`, `Electron`, `LiveBrowser`, `Setup`, `Shared`, and `Shell` itself. All other packages are automatically discovered and merged. Circular companion dependencies are detected and throw an error.

### Package Communication Rules

1. **Never import across packages** — if something is shared, it lives in `Packages/Shared/`.
2. **IPC for cross-package signals** — packages communicate through IPC channels.
3. **Shared events** — `Packages/Shared/Events/` defines custom DOM events for renderer-side communication.
4. **Auto-discovery** — Packages are discovered dynamically by scanning `Packages/` for directories with non-empty `Index.js`.

---

## Path Resolution (Critical for Packaged Builds)

In production builds, `extraResources` files live at `process.resourcesPath`, not the app root:

```js
const dataRoot = app.isPackaged ? process.resourcesPath : rootDirectory;
```

| Path | Dev | Packaged |
|---|---|---|
| `rootDirectory` | Project root | Inside asar |
| `process.resourcesPath` | Undefined | `resources/` folder |
| `app.getPath('userData')` | OS user data dir | OS user data dir |

Files in `extraResources` (Data, Skills, Personas) must be resolved via `process.resourcesPath` when `app.isPackaged` is `true` for bundled reads. Writable Data uses `app.getPath('userData')`.

---

## File Packaging Strategy

### Inside asar (`files` in electron-builder)

- `App.js` — main entry point
- `Assets/` — images, audio, video
- `Packages/` — all package code
- `Datasets/` — static datasets
- `Prompts/` — system prompts
- `Config/` — model catalogs

### Outside asar (`extraResources` in electron-builder)

- `Data/` — user data (ships only seed/static files)
- `Skills/` — AI skill markdown files
- `Personas/` — AI persona markdown files

User-generated data (chats, memories, agents, channels, projects, security, avatar, usage, templates, channel messages, model cache, logs, screenshots, MCP servers, system info) is excluded from the build via filters.

---

## Data Storage

User data is stored in the `Data/` folder:

| Path | Purpose |
|---|---|
| `Data/Chats/` | Chat session files |
| `Data/Memories/` | Long-term memory markdown files |
| `Data/Agents/` | Agent definitions and run logs |
| `Data/Channels.json` | Channel configurations |
| `Data/ChannelMessages/` | Channel message history |
| `Data/Projects/` | Project workspace records |
| `Data/Templates/` | Prompt templates |
| `Data/Usage/` | Token usage analytics |
| `Data/Browsing/` | Browser history |
| `Data/Screenshots/` | Browser screenshots |
| `Data/Dreams/` | Dream journal (memory consolidation) |
| `Data/User.json` | User profile, providers, connectors, settings |
| `Data/Security.json` | App lock configuration |
| `Data/System.json` | System info snapshot |
| `Data/Avatar.jpg` | User avatar image |

---

## System Prompt Assembly

The system prompt is assembled in `ChatState.js` by concatenating multiple sources:

```text
1. Prompts/System.md + Runtime info (user, version, time, timezone, platform)
2. Active persona (from Personas/ directory)
3. Mode instruction (if a slash command mode is active)
4. Custom user instructions (from user profile)
5. Project context (from project documentation)
6. Memory context (from Data/Memories/ via memory:get-context)
7. Terminal tool instructions (from Prompts/Terminal.md with tool names injected)
8. Toolset tool instructions (from Prompts/Toolset.md with tool list injected)
9. Skills context (from Skills/ directory)
10. "No Project Context" instruction (if source is 'chat' and no project is open)
```

The final prompt is prepended with `latestUserMessageAnchor` — a lightweight multi-turn anchor so weaker models always know which message they should respond to.

### Provider-Specific Streaming

The chat engine uses Node.js HTTP (not Electron's fetch) to stream responses directly from the IncomingMessage. Three streaming paths:

- **OpenAI-compatible**: Standard SSE with `delta.content` for text and `delta.reasoning_content` / `delta.reasoning` for thinking tokens (DeepSeek-R1, Qwen-QwQ)
- **Anthropic**: Native API with `content_block_delta` events for text and `thinking_delta` for extended thinking (claude-3-7-sonnet, claude-4)
- **Google Gemini**: Native API with `generateContent` → `streamGenerateContent` endpoint swap and `?alt=sse` format

All three paths support multimodal user turns (image attachments as base64 inline data).

### Retry Logic

Transient errors (429, 500, 502, 503, 504, network codes like ECONNRESET) are retried up to 3 times with exponential backoff (800ms base). Retries only happen before any tokens are emitted — once streaming starts, mid-stream failures are surfaced immediately.

Empty responses (stream ends with zero tokens) are also retried as transient failures.

---

## Tool Execution Flow

The tool loop is implemented in `Shared/ToolLoop/RendererToolLoop.js` and runs in the renderer process:

```text
AI response contains tool call block
    ↓
parseAllToolRequests() — extracts joanium-terminal and joanium-tool blocks
    ↓
Falls back to plain JSON / ```json blocks for reasoning models
    ↓
Deduplicates identical tool calls
    ↓
Terminal tools → toolset:execute-tool IPC call → ToolsetService
Toolset tools → toolset:execute-tool IPC call → ToolsetService
    ↓
Handler executes with 30-second timeout
    ↓
Result injected into AI context as tool response
    ↓
Loop repeats up to maxToolCalls (10 for chat, 1000 for agents)
```

Tool calls use fenced code blocks:

- `joanium-terminal` — local tools (shell, filesystem, git, browser)
- `joanium-tool` — connector/API tools (GitHub, Jira, etc.)

### Built-in Tools (in ToolsetService.js)

The tool executor registers built-in handlers for:

- **Math**: `calculate_expression` (full expression evaluator with operator precedence)
- **Unit conversion**: `convert_units` (30+ units across length, weight, volume, speed, temperature)
- **Date/time**: `get_time_in_timezone`, `calculate_date`, `convert_timezone`, `is_weekend`, `business_days_between`, `add_business_days`, `next_weekday_occurrence`, `age_calculator`, `days_until_birthday`, `get_season`, `get_month_info`, `get_quarter_info`, `lunar_phase`, `week_bounds`, `month_bounds`, `year_progress`, `detailed_difference`, `nth_weekday_of_month`, `timezone_overlap`, `century_decade_info`, `unix_converter`, `time_until_datetime`
- **URL**: `parse_url`, `extract_query_params`, `build_url`, `add_utm_params`, `remove_tracking_params`, `encode_url`, `decode_url`, `extract_domain`, `slugify_to_url`, `extract_urls_from_text`, `compare_urls`, `url_to_markdown_link`, `url_to_html_link`, `url_to_base64`, `count_url_params`
- **Geospatial**: `get_distance`, `get_midpoint`, `check_point_in_radius`, `convert_dms_to_dd`, `convert_dd_to_dms`, `encode_geohash`, `decode_geohash`, `get_map_url`
- **Crypto**: `generate_uuid`, `hash_text` (SHA-1/256/384/512)
- **Encoding**: `encode_base64`, `decode_base64`
- **JSON**: `format_json` (with optional key sorting)
- **Text**: `convert_text_case`, `get_text_stats`
- **Security**: `generate_password`

### Tool Discovery

`ToolDiscovery.js` scans `Tools/` for subdirectories with `Index.js`, skipping `Core/` (support directory). It also discovers external tool packages from other packages (e.g., `LiveBrowser`). Each tool package exports:

- `toolDefinitions` — name, description, parameters
- `toolHandlers` — execution functions
- `promptSections` — additional system prompt content
- `connectors` — required API credentials
- `ipcHandlers` — additional IPC channels

---

## IPC Communication

### Main Process (handler registration)

```js
ipcMain.handle('package:action', async (_event, payload) => {
  // logic
  return result;
});
```

### Renderer Process (calling IPC)

```js
const result = await window.Joanium.ipc.invoke('package:action', payload);
```

### Streaming Pattern

For long-running operations (AI completions), the streaming pattern uses abort controllers:

```js
// Main process
ipcMain.handle('chat:stream-message', async (event, payload) => {
  const streamId = payload.streamId;
  const abortController = new AbortController();
  activeStreams.set(streamId, abortController);
  
  // Stream chunks via event.sender.send()
  for await (const chunk of stream) {
    event.sender.send('chat:stream-chunk', { streamId, chunk });
  }
  
  event.sender.send('chat:stream-done', { streamId });
  activeStreams.delete(streamId);
});
```

### Custom Renderer Events

`Packages/Shared/Events/RendererEvents.js` defines custom DOM events for renderer-side communication:

| Event | Purpose |
|---|---|
| `PROVIDERS_CHANGED` | Provider configuration changed |
| `CONNECTORS_CHANGED` | Connector configuration changed |
| `APP_SETTINGS_CHANGED` | App settings changed |
| `MEMORY_SYNC` | Memory sync triggered |
| `TRIGGER_MEMORY_SYNC` | Request memory sync |
| `THEME_CHANGED` | Theme changed |

---

## Must Follow

1. Always use `CustomScrollbar` from `Packages/Shared` for scrollable areas.
2. Keep code clean and organized. No dead code, no commented-out blocks.
3. Small single-line prompts go in `Prompts/Prompts.js`; longer ones go in `Prompts/` folder.
4. No package imports from another package — use `Packages/Shared`.
5. No HTML attributes that expose the DOM (`data-*`, `title`).
6. Scalable, maintainable, upgradable, easy-to-debug architecture.
7. Documentation updated when changes are made.
8. Auto-discovery for packages — no hardcoding.
9. ESM only — no CommonJS.
10. No hardcoded text in JS or HTML — all from i18n files.
11. App should feel like a native macOS app.
12. Helpers go in `Utils.js`.
