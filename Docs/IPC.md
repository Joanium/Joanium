# IPC Communication

Inter-process communication between Electron's main process and renderer process.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                      │
│                                                          │
│  ShellApp.js (SPA Router)                                │
│  ├── ChatApp.js                                          │
│  ├── SettingsPanel.js                                     │
│  └── ... (other views)                                   │
│                                                          │
│  window.Joanium.ipc.invoke(channel, ...args)  ←→  main   │
│  window.Joanium.ipc.on(channel, callback)                │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│                    Main Process                          │
│                                                          │
│  ipcMain.handle(channel, handler)                        │
│  ├── Chat IPC handlers                                   │
│  ├── Memory IPC handlers                                 │
│  ├── Toolset IPC handlers                                │
│  ├── ... (all package handlers merged via companions)    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## IPC Pattern

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

### Renderer Event Listeners

```js
window.Joanium.ipc.on('event:channel', (_event, data) => {
  // handle event
});

// Clean up
window.Joanium.ipc.removeAllListeners('event:channel');
```

---

## IPC Composition

The Shell package declares all other packages as `ipcCompanions`. During bootstrap, `createPackage()` recursively creates each companion and merges their IPC handlers:

```text
Shell.createPackage()
├── Load Shell module
├── Resolve ipcCompanions (all other packages except Boot, Electron, LiveBrowser, Setup, Shared, Shell)
├── For each companion (sorted alphabetically):
│   ├── Load companion module
│   ├── Call companion.createPackage()
│   ├── Merge companion.ipcHandlers into Shell's handlers
│   └── Recursively process companion's own ipcCompanions
├── Detect circular dependencies (throws if found)
└── Register all merged handlers on ipcMain
```

This means a single BrowserWindow has access to every package's IPC channels.

---

## IPC Channel Naming Convention

Channels follow the pattern: `package-name:action-name`

Examples:

- `chat:stream-message`
- `memory:save`
- `toolset:execute-tool`
- `providers:list-catalog`
- `app-settings:get`
- `browser-preview:load-url`

---

## Streaming Pattern

For long-running operations (AI completions), the streaming pattern uses abort controllers:

```js
// Main process
ipcMain.handle('chat:stream-message', async (event, payload) => {
  const streamId = payload.streamId;
  const abortController = new AbortController();
  
  // Register abort controller
  activeStreams.set(streamId, abortController);
  
  // Stream chunks via event.sender.send()
  for await (const chunk of stream) {
    event.sender.send('chat:stream-chunk', { streamId, chunk });
  }
  
  event.sender.send('chat:stream-done', { streamId });
  activeStreams.delete(streamId);
});

// Renderer
window.Joanium.ipc.on('chat:stream-chunk', (_event, data) => {
  // Handle chunk
});

window.Joanium.ipc.on('chat:stream-done', (_event, data) => {
  // Stream complete
});
```

---

## Custom Renderer Events

`Packages/Shared/Events/RendererEvents.js` defines custom DOM events for renderer-side communication:

| Event | Purpose |
|---|---|
| `PROVIDERS_CHANGED` | Provider configuration changed |
| `CONNECTORS_CHANGED` | Connector configuration changed |
| `APP_SETTINGS_CHANGED` | App settings changed |
| `MEMORY_SYNC` | Memory sync triggered |
| `TRIGGER_MEMORY_SYNC` | Request memory sync |
| `THEME_CHANGED` | Theme changed |

These fire as custom DOM events and are consumed by UI components that need to react to state changes.

---

## Renderer IPC Wrapper

`Packages/Shared/Ipc/RendererIpc.js` provides thin wrappers:

```js
// Instead of:
window.Joanium.ipc.invoke(channel, ...args)

// Use:
import { invokeIpc } from '../Ipc/RendererIpc.js';
const result = await invokeIpc(channel, ...args);
```

---

## IPC Handler Registration

When navigating between packages, IPC handlers are registered/unregistered dynamically:

1. **Boot**: All handlers registered during `createPackage()`
2. **Navigation**: Old handlers unregistered, new handlers registered
3. **Shell**: All handlers remain registered for the lifetime of the app

The `registerIpcHandlers()` function in `Electron/Index.js`:

1. Compares new handler channels with currently registered channels
2. Removes handlers that are no longer needed
3. Registers new handlers (removes first to avoid duplicates)

---

## Error Handling

IPC errors propagate to the renderer as rejected promises. The renderer can catch them:

```js
try {
  const result = await window.Joanium.ipc.invoke('package:action');
} catch (error) {
  // Handle IPC error
}
```

---

## Key IPC Channels by Package

### Chat (11 channels)

`chat:bootstrap`, `chat:stream-message`, `chat:cancel-stream`, `chat:cancel-all-streams`, `chat:stream-message-agent`, `chat:complete-message`, `chat:enhance-prompt`, `chat:select-attachments`, `chat:process-dropped-files`, `chat:get-terminal-prompt`, `chat:fetch-url`

### Memory (16 channels)

`memory:list`, `memory:read`, `memory:save`, `memory:search`, `memory:get-context`, `memory:get-catalog`, `memory:get-export-prompt`, `memory:get-triage-prompt`, `memory:get-import-prompt`, `memory:apply-updates`, `memory:delete`, `memory:cleanup-ai-reply`, `memory:cleanup-renderer-ready`, `memory:run-cleanup`, `memory:list-dreams`, `memory:read-dream`

### Toolset (6 channels)

`toolset:list-tools`, `toolset:execute-tool`, `connectors:list`, `connectors:save`, `connectors:remove`, `connectors:google-oauth`

### Providers (6 channels)

`providers:list-catalog`, `providers:list-configured`, `providers:save`, `providers:remove`, `providers:list-model-favourites`, `providers:toggle-model-favourite`

### AppSettings (10 channels)

`app-settings:get`, `app-settings:save`, `auto-update:get-state`, `auto-update:check`, `auto-update:install`, `app-settings:reset-app`, `app-settings:restart-app`, `app-settings:quit-app`, `data:export`, `data:import`

### LiveBrowser (18 channels)

`browser-preview:get-state`, `browser-preview:load-url`, `browser-preview:load-html`, `browser-preview:set-visible`, `browser-preview:set-bounds`, `browser-preview:hide`, `browser-preview:hide-native-view`, `browser-preview:show-native-view`, `browser-preview:go-back`, `browser-preview:go-forward`, `browser-preview:reload`, `browser-preview:pause`, `browser-preview:resume`, `browser-preview:close`, `browser-preview:get-history`, `browser-preview:clear-history`, `browser-preview:delete-history-entry`, `browser-preview:execute-tool`

### Agents (13 channels)

`agents:renderer-ready`, `agents:tool-reply`, `agents:progress`, `agents:list-avatars`, `agents:save-agent`, `agents:list-agents`, `agents:load-agent`, `agents:delete-agent`, `agents:run-agent`, `agents:list-runs`, `agents:clear-runs`, `agents:load-run-detail`, `agents:list-run-ids`

### Channels (12 channels)

`channels:icon-paths`, `channels:list`, `channels:get`, `channels:save`, `channels:remove`, `channels:toggle`, `channels:validate`, `channels:reply`, `channels:save-message`, `channels:list-messages`, `channels:delete-message`, `channels:clear-messages`

### History (11 channels)

`history:save-session`, `history:list-sessions`, `history:load-session`, `history:delete-session`, `history:delete-all-sessions`, `history:rename-session`, `history:pin-session`, `history:list-memory-pending`, `history:mark-memory-synced`, `history:fork-session`, `history:search-sessions`

### MCP (8 channels)

`mcp:list-servers`, `mcp:save-server`, `mcp:remove-server`, `mcp:set-enabled`, `mcp:connect-server`, `mcp:disconnect-server`, `mcp:list-tools`, `mcp:call-tool`

### Security (10 channels)

`security:get-status`, `security:enable`, `security:disable`, `security:verify-password`, `security:verify-answer`, `security:get-auto-lock-timeout`, `security:set-auto-lock-timeout`, `security:change-password`, `security:get-backup-state`, `security:restore-from-backup`

### User (7 channels)

`user:get-profile`, `user:save-profile`, `user:get-custom-instructions`, `user:save-custom-instructions`, `user:pick-avatar`, `user:save-avatar`, `user:remove-avatar`

### Projects (7 channels)

`projects:save-project`, `projects:list-projects`, `projects:load-project`, `projects:delete-project`, `projects:select-cover`, `projects:read-project-docs`, `projects:select-directory`

### Setup (4 channels)

`setup:bootstrap`, `setup:save-draft`, `setup:complete`, `setup:import-backup`

### About (4 channels)

`about:get-info`, `about:open-external`, `whats-new:get`, `whats-new:mark-seen`

### Other packages

- **Templates** (4): `templates:save-template`, `templates:list-templates`, `templates:load-template`, `templates:delete-template`
- **Skills** (3): `skills:list-skills`, `skills:load-skill`, `skills:delete-skill`
- **Personas** (5): `personas:list-personas`, `personas:load-persona`, `personas:delete-persona`, `personas:get-active-persona`, `personas:set-active-persona`
- **SlashCommands** (2): `slash-commands:list`, `slash-commands:get-mode-instruction`
- **Themes** (2): `themes:get`, `themes:save`
- **Usage** (1): `usage:get-data`
- **Marketplace** (1): `marketplace:install-item`
- **Shell** (1): `shell:bootstrap`
- **Events** (0): stub
- **Leaderboard** (0): stub
