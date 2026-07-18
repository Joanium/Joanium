# Shared Library

`Packages/Shared/` is the ONLY package other packages may import from. Contains 34+ modules organized by concern.

---

## Exports

`Packages/Shared/Index.js` re-exports selected public symbols:

```js
export * as Bubbly from './Bubbly/Index.js';
export * as AssistantPipeline from './AssistantRuntime/AssistantPipeline.js';
export * as DebugLogger from './Debug/DebugLogger.js';
export * as TerminalCallCard from './TerminalCallCard/TerminalCallCard.js';
export { appendTimestampedLog, createTimestampedFileLogger } from './Debug/FileLogger.js';
export { formatRelativeSessionTime, getRelativeDayGroup, sortByDate, startOfLocalDay, toIso, todayDateString } from './Utils/DateUtils.js';
export { createElement, escapeHtml, formatText, makeEditableTextarea } from './Utils/DomUtils.js';
export { computeDiff } from './Utils/DiffUtils.js';
export { collapseWhitespace, createSlugId, createUniqueId, escapeRegex, extractJsonObject, getNameInitials, normalizeString, truncate } from './Utils/StringUtils.js';
export { clampInteger, compactObject, deepClone, formatBytes, optionalText, toBoolean } from './Utils/ValueUtils.js';
export { createNamespacedMarkdownLibrary, mapNamespacedMarkdownResource } from './Markdown/NamespacedResourceLibrary.js';
export { createSearchableListColumn, populateSearchableCards } from './PanelList/PanelList.js';
export { pickOpenPath } from './Electron/DialogUtils.js';
export { orderProvidersBySelection, providerIsConfigured } from './ProviderCatalog/ProviderUtils.js';
export { createEnqueue, tryParseJson } from './Utils/AsyncUtils.js';
export { readJsonDirectory } from './Storage/JsonDirectory.js';
export { deleteJsonFile, jsonFilePath, listJsonDirectory, readJsonFile, serializeJson, writeJsonFile } from './Storage/JsonFileStore.js';
export { createProviderIcon } from './Icons/Icons.js';
export { formatPrice, formatTokenCount, hasModelInfo, resolveContextWindow, resolveMaxOutput } from './Utils/ModelInfoUtils.js';
export { CHANNEL_NAMES } from './Utils/ChannelConstants.js';
export { createSecretField } from './UI/SecretField.js';
export { createSingleFileState } from './Storage/SingleFileState.js';
export { EVENTS, dispatchEvent } from './Events/RendererEvents.js';
export { initOfflineMonitor, destroyOfflineMonitor, isOnline, onNetworkChange, getNetworkStatus } from './OfflineMonitor/OfflineMonitor.js';
export { createContextVisualizer } from './ContextVisualizer/ContextVisualizer.js';
export { deepMerge } from './Utils/MergeUtils.js';
export { createSpotlightSearch } from './Spotlight/SpotlightSearch.js';
```

---

## Modules

### AssistantRuntime

**Path**: `Shared/AssistantRuntime/`

The shared prompt execution pipeline used by Chat, Channels, and Agents.

- **AssistantPipeline.js** — Pipeline orchestration: `loadAssistantPipelineRuntime()`, `createAssistantPipelineRequest()`, `runAssistantPipeline()`
- **AssistantContext.js** — Caches terminal prompt, toolset prompt, and skills context between messages. Cache resets on connector changes. Memory is NOT cached (changes between sessions).
- **Utils.js** — `pickFirst()` helper for optional values

**Pipeline behavior**:

1. Loads runtime context (memory, terminal tools, toolset tools, skills)
2. Assembles complete AI request with all context
3. Executes bounded renderer tool loop (10 iterations for chat, 1000 for agents)
4. Used by three surfaces: Chat (direct conversations), Channels (external messaging), Agents (background tasks)

### Debug

**Path**: `Shared/Debug/`

- **DebugLogger.js** — Debug-mode logging (activates via `--debug` flag or `JOANIUM_DEBUG=1`). Sanitizes secrets and writes to `Build/Logs/debug.log`.
- **FileLogger.js** — `appendTimestampedLog(path, message, details)` for file-append logging. `createTimestampedFileLogger(path)` for reusable logger.

### Markdown

**Path**: `Shared/Markdown/`

- **Frontmatter.js** — Parse/strip YAML frontmatter from markdown files
- **MarkdownLibrary.js** — List/load markdown from namespaced directories
- **MarkdownRenderer.js** + `.css` — Client-side markdown rendering with syntax highlighting
- **NamespacedResourceLibrary.js** — Dual-directory lookup: bundled (read-only) + writable. Used for personas, skills, and other namespaced content.
- **ThinkingParser.js** — Extracts `<think>` blocks from AI responses for separate display

### Storage

**Path**: `Shared/Storage/`

- **ResourcePaths.js** — Central path resolution:
  - `getWritableDataDirectory(rootDirectory)` — Returns `app.getPath('userData')` in packaged builds, `<project>/Data/` in dev
  - `getBundledResourceDirectory(rootDirectory, resourceName)` — Read-only bundled resources
  - `getResourcePath(rootDirectory, resourceName, ...segments)` — Resolves to correct location for dev/packaged
  - `getResourceFileUrl(rootDirectory, resourceName, ...segments)` — Returns `app://` URL for renderer
  - `readJsonResource(rootDirectory, resourceName, ...segments)` — Reads JSON from bundled resources
  - `writeJsonResource(rootDirectory, resourceName, fileName, data, options)` — Writes JSON to writable directory
  - `readTextResource(rootDirectory, resourceName, ...segments, options)` — Reads text from bundled resources
  - `getTrayIconPath(rootDirectory)` — Tray icon path

- **JsonDirectory.js** — `readJsonDirectory(dirPath)` reads all `.json` files from a directory
- **JsonFileStore.js** — CRUD operations: `readJsonFile`, `writeJsonFile`, `deleteJsonFile`, `listJsonDirectory`, `jsonFilePath`, `serializeJson`
- **SafePath.js** — `sanitizeFileStem(stem)` sanitizes file stems and path segments to prevent path traversal attacks
- **SingleFileState.js** — `createSingleFileState({ filePath, defaults })` — Reads/writes a single JSON file with defaults merging
- **DataEntries.js** — `KNOWN_DATA_ENTRIES` constant for data reset operations

### ToolLoop

**Path**: `Shared/ToolLoop/`

The bounded tool loop that parses AI tool calls and executes them.

- **TerminalToolNames.js** — Single source of truth for all 40+ terminal tool names. Used by both renderer (RendererToolLoop) and main process (ChatState).
- **RendererToolLoop.js** — Bounded tool loop implementation:
  - `parseAllToolRequests(text, supportedTools)` — Extracts `joanium-terminal` and `joanium-tool` blocks from AI responses
  - Falls back to plain JSON / ````json` blocks for reasoning models
  - Deduplicates identical tool calls
  - `executeTerminalTool(tool, params, context)` — Executes terminal tools via IPC
  - `executeToolsetTool(tool, params, context)` — Executes toolset tools via IPC
  - `runRendererToolLoop(options)` — Main loop: parse → execute → feed back → repeat up to `maxToolCalls`
- **Prompts.js** — `TOOL_LOOP_PROMPTS` (step messages) and `SKILLS_CONTEXT_PROMPT_TEMPLATE`

**Tool block parsing**:

- `joanium-terminal` — Local tools (shell, filesystem, git, browser)
- `joanium-tool` — Connector/API tools (GitHub, Jira, etc.)
- Fallback: Plain JSON objects or ````json` blocks for reasoning models

### Utils

**Path**: `Shared/Utils/`

- **AsyncUtils.js** — `createEnqueue()` for serial execution, `tryParseJson(str)` for safe JSON parsing
- **DateUtils.js** — `formatRelativeSessionTime(date)`, `getRelativeDayGroup(date)`, `sortByDate(items, key)`, `startOfLocalDay(date)`, `toIso(date)`, `todayDateString()`
- **DiffUtils.js** — `computeDiff(before, after)` for file change visualization
- **DomUtils.js** — `createElement(tag, attrs, children)`, `escapeHtml(str)`, `formatText(text)`, `makeEditableTextarea(element)`
- **PromptUtils.js** — `readBundledPromptFile(rootDirectory, filename)`, `formatPromptTemplate(template, variables)`
- **StringUtils.js** — `collapseWhitespace(str)`, `createSlugId(str)`, `createUniqueId()`, `escapeRegex(str)`, `extractJsonObject(str)`, `getNameInitials(name)`, `normalizeString(str)`, `truncate(str, maxLen)`
- **UrlUtils.js** — URL utilities
- **ValueUtils.js** — `clampInteger(value, default, min, max)`, `compactObject(obj)`, `deepClone(obj)`, `formatBytes(bytes)`, `optionalText(value)`, `toBoolean(value)`
- **ModelInfoUtils.js** — `formatPrice(cents)`, `formatTokenCount(count)`, `hasModelInfo(model)`, `resolveContextWindow(model)`, `resolveMaxOutput(model)`
- **ChannelConstants.js** — `CHANNEL_NAMES` constant array (telegram, whatsapp, discord, slack, mattermost, zulip, ntfy)
- **MergeUtils.js** — `deepMerge(target, source)` for deep object merging

### ProviderCatalog

**Path**: `Shared/ProviderCatalog/`

- **ProviderCatalog.js** — Reads provider metadata from `Config/Models/index.json`, builds the runtime catalog, and contains the tint/glow palette and icon map for the 35 provider definitions.
- **ProviderUtils.js** — `orderProvidersBySelection(user, providers)` sorts by selection state, and `providerIsConfigured(provider, details)` checks for valid credentials and model availability.
- **ModelSync.js** — Background model-list sync with a 1-hour TTL per provider, guarded for packaged builds and driven by `_syncedAt` metadata.
- **LiveModelFilter.js** — Live model filtering based on search query
- **ModelFetcher.js** — Model list fetching from provider APIs
- **ModelOptions.js** — Model option formatting for UI

### Events

**Path**: `Shared/Events/`

- **RendererEvents.js** — Custom DOM events: `PROVIDERS_CHANGED`, `CONNECTORS_CHANGED`, `APP_SETTINGS_CHANGED`, `MEMORY_SYNC`, `TRIGGER_MEMORY_SYNC`, `THEME_CHANGED`

### SubAgents

**Path**: `Shared/SubAgents/`

- **SubAgentTasks.js** — `normalizeSubAgentTasks(raw)` normalizes raw AI sub-agent task JSON into structured task objects. Max 8 tasks. Supports multiple input shapes (JSON string, array, single object).

### I18n

**Path**: `Shared/I18n/`

- **en.js** — English strings for markdown code block UI (Copy, Copied!, Download)

### Ipc

**Path**: `Shared/Ipc/`

- **RendererIpc.js** — Thin wrappers: `invokeIpc(channel, ...args)`, `onIpc(channel, callback)`, `removeAllIpcListeners(channel)`

### UserData

**Path**: `Shared/UserData/`

- **UserData.js** — User state management:
  - `createDefaultUserState()` — Default state with locale, profile, providers, connectors, app settings, theme
  - `readUserState(rootDirectory)` — Reads and sanitizes state from `Data/User.json`
  - `writeUserState(rootDirectory, state)` — Writes with serialized write queue (prevents concurrent writes)
  - Full sanitization of incoming state (removes unknown keys, validates types)

### UsageTracker

**Path**: `Shared/UsageTracker/`

- **UsageTracker.js** — Token estimation (~4 chars/token), per-day and per-model usage tracking stored in `Data/Usage/`

### Bubbly

**Path**: `Shared/Bubbly/`

UI component library for setup/onboarding:

- `ApiKeyInput` — Masked API key input field
- `Button` — Styled button
- `Checkbox` — Checkbox input
- `DropDown` — Dropdown select
- `InputBox` — Text input
- `Modal` — Modal dialog
- `TagSelector` — Tag selection
- `LogoLoader` — Logo loading animation
- `CustomScrollbar` — Custom scrollbar styling
- `ProviderScroller` — Provider card scroller

### Icons

**Path**: `Shared/Icons/`

- **Icons.js** — `createProviderIcon(providerId, size)` creates provider icon elements

### OfflineMonitor

**Path**: `Shared/OfflineMonitor/`

- **OfflineMonitor.js** — Network connectivity monitoring: `initOfflineMonitor()`, `destroyOfflineMonitor()`, `isOnline()`, `onNetworkChange(callback)`, `getNetworkStatus()`

### ContextVisualizer

**Path**: `Shared/ContextVisualizer/`

- **ContextVisualizer.js** — Creates context visualization elements for debugging prompt assembly

### Spotlight

**Path**: `Shared/Spotlight/`

- **SpotlightSearch.js** — Spotlight-style search functionality for quick navigation

### Electron

**Path**: `Shared/Electron/`

- **DialogUtils.js** — `pickOpenPath(event, options)` for native file/folder picker dialogs

### Sounds

**Path**: `Shared/Sounds/`

Sound effect assets for completion and notification sounds.

### UI Components

| Component | Path | Purpose |
|---|---|---|
| SecretField | `Shared/UI/SecretField.js` | Masked input for API keys |
| PanelControls | `Shared/PanelControls/` | Reusable panel CSS styles (CSS only, no JS) |
| PanelHeader | `Shared/PanelHeader/` | Reusable panel header |
| PanelList | `Shared/PanelList/` | Reusable panel list with searchable cards |
| SearchBar | `Shared/SearchBar/` | Search bar component |
| DropDownLite | `Shared/DropDownLite/` | Lightweight dropdown |
| InputBoxLite | `Shared/InputBoxLite/` | Lightweight input |
| LogoLoader | `Shared/LogoLoader/` | Logo loading animation |
| CustomScrollbar | `Shared/CustomScrollbar/` | Custom scrollbar styling |
| ProviderScroller | `Shared/ProviderScroller/` | Provider card scroller |
| TwoColGrid | `Shared/TwoColGrid/` | Two-column grid layout |
| TerminalCallCard | `Shared/TerminalCallCard/` | Terminal output display card |

---

## Using Shared Modules

```js
// Via Index.js re-exports (preferred for commonly used symbols)
import { Bubbly, DebugLogger, createEnqueue } from '../Shared/Index.js';

// Via direct inner file imports (also valid — many packages do this)
import { UserData } from '../Shared/UserData/UserData.js';
import { ResourcePaths } from '../Shared/Storage/ResourcePaths.js';
import { RendererToolLoop } from '../Shared/ToolLoop/RendererToolLoop.js';
```

Both import styles are used in the codebase. Use whichever matches the existing pattern in the package you're working on.
