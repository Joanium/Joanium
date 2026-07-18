# Data Storage

Data folder structure, persistence patterns, and path resolution.

---

## Data Folder Structure

```text
Data/
├── Agents/              Agent definitions and run logs
├── Avatar.jpg           User avatar image
├── Browsing/            Browser history (organized by date)
├── ChannelMessages/     Channel message history
├── Channels.json        Channel configurations
├── Chats/               Chat session files
├── Dreams/              Dream journal (memory consolidation)
├── Memories/            Long-term memory markdown files
├── Projects/            Project workspace records
├── Screenshots/         Browser screenshots
├── Security.json        App lock configuration
├── System.json          System info snapshot
├── Templates/           Prompt templates
├── Usage/               Token usage analytics
└── User.json            User profile, providers, connectors, settings
```

---

## User.json

Stores user profile, providers, connectors, and settings:

```json
{
  "locale": "en",
  "consentAccepted": true,
  "onboardingCompleted": true,
  "profile": {
    "name": "User Name",
    "avatarPath": "...",
    "dateOfBirth": { "day": "11", "month": "05", "year": "2002" }
  },
  "customInstructions": "...",
  "providers": {
    "selected": ["openai", "anthropic", "..."],
    "details": {
      "openai": { "apiKey": "sk-...", "endpoint": "https://api.openai.com/v1" },
      "ollama": { "endpoint": "http://127.0.0.1:11434/..." }
    }
  },
  "connectors": {
    "details": {
      "github": { "token": "ghp_..." },
      "google": { "clientId": "...", "clientSecret": "...", "refreshToken": "..." }
    }
  },
  "activePersona": { "namespace": "Joanium", "filename": "Joana.md" },
  "appSettings": {
    "runOnStartup": false,
    "keepAwake": false,
    "completionSound": true,
    "autoMemoryUpdates": true,
    "autoUpdate": true,
    "showTechFeed": true,
    "showChangelog": true,
    "defaultView": "chat",
    "defaultModel": { "providerId": "openai", "modelId": "gpt-4o" },
    "defaultSearchEngine": "yahoo"
  },
  "theme": {
    "mode": "dark",
    "motion": "full",
    "font": "system"
  },
  "windowState": { "bounds": { "width": 1530, "height": 817 }, "isMaximized": true }
}
```

---

## Security.json

App lock configuration:

```json
{
  "enabled": false,
  "passwordHash": "...",
  "passwordSalt": "...",
  "secretQuestion": "What is your pet's name?",
  "secretAnswerHash": "...",
  "secretAnswerSalt": "...",
  "autoLockTimeout": "5min",
  "failedAttempts": 0,
  "lockoutUntil": null
}
```

---

## System.json

System info snapshot:

```json
{
  "os": "Windows",
  "platform": "win32",
  "arch": "x64",
  "nodeVersion": "22.0.0",
  "electronVersion": "43.1.1",
  "totalMemory": 16384,
  "cpuModel": "..."
}
```

---

## Channels.json

Channel configurations:

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "credentials": { "botToken": "..." },
      "systemPrompt": "Optional prompt"
    }
  }
}
```

---

## Chats/

Chat session files. Each session is a JSON file containing:

- Session metadata (id, title, timestamp)
- Message history (user/assistant messages)
- Attachments metadata
- Project context

---

## Memories/

Long-term memory markdown files. Each file represents a memory topic or category.

---

## Agents/

Agent definitions and run logs:

- Agent config (name, prompt, schedule, model, avatar)
- Run history (status, output, timestamps, tool calls, tokens)

---

## Projects/

Project workspace records:

- Project name and description
- Folder path (`folderPath` / `rootPath`)
- Cover image path
- Custom context

---

## Templates/

Prompt template storage. Each template is a JSON file.

---

## Usage/

Token usage analytics. Stored per-day and per-model.

---

## Browsing/

Browser history organized by date:

```text
Data/Browsing/
└── 2026/
    └── 07/
        └── 01.json
```

History entries include URL, title, timestamp, and visit count.

---

## Path Resolution

### Development

```text
Data/ → <project-root>/Data/
```

### Packaged Build

```text
Data/ → <app.getPath('userData')>/
```

The `Data/` folder ships only seed/static files. User-generated data is excluded from the build.

### Code Pattern

```js
import { getWritableDataDirectory } from '../Shared/Storage/ResourcePaths.js';

const dataDir = getWritableDataDirectory(rootDirectory);
// Returns correct path for dev or packaged build
```

---

## Resource Paths

`Packages/Shared/Storage/ResourcePaths.js` provides:

- `getWritableDataDirectory(rootDirectory)` — Writable data directory (`app.getPath('userData')` in packaged, `<project>/Data/` in dev)
- `getBundledResourceDirectory(rootDirectory, resourceName)` — Read-only bundled resources
- `getResourcePath(rootDirectory, resourceName, ...segments)` — Resolves to correct location
- `getResourceFileUrl(rootDirectory, resourceName, ...segments)` — Returns `app://` URL for renderer
- `readJsonResource(rootDirectory, resourceName, ...segments)` — Reads JSON from bundled resources
- `writeJsonResource(rootDirectory, resourceName, fileName, data, options)` — Writes JSON to writable directory
- `readTextResource(rootDirectory, resourceName, ...segments, options)` — Reads text from bundled resources
- `getTrayIconPath(rootDirectory)` — Tray icon path

### Path Resolution Rules

| Resource | Dev | Packaged |
|---|---|---|
| `Packages/` | `<project>/Packages/` | Inside asar |
| `Config/` | `<project>/Config/` | Inside asar |
| `Assets/` | `<project>/Assets/` | Inside asar |
| `Data/` | `<project>/Data/` | `app.getPath('userData')` |
| `Skills/` | `<project>/Skills/` | `process.resourcesPath/Skills/` |
| `Personas/` | `<project>/Personas/` | `process.resourcesPath/Personas/` |

---

## State Persistence

Most packages use a similar pattern:

```js
// Read state
const state = await readJsonResource(rootDirectory, 'SomePackage', 'SomeState.json');

// Write state
await writeJsonResource(rootDirectory, 'SomePackage', 'SomeState.json', state);
```

`Shared/Storage/JsonDirectory.js` reads all `.json` files from a directory.

`Shared/Storage/SingleFileState.js` provides `createSingleFileState({ filePath, defaults })` for single-file state management with defaults merging.

---

## Safe Path Handling

`Shared/Storage/SafePath.js` provides `sanitizeFileStem(stem)` to sanitize file stems and path segments to prevent path traversal attacks.

---

## UserData

`Packages/Shared/UserData/UserData.js` manages user state:

- `createDefaultUserState()` — Default state with locale, profile, providers, connectors, app settings, theme
- `readUserState(rootDirectory)` — Reads and sanitizes state from `Data/User.json`
- `writeUserState(rootDirectory, state)` — Writes with serialized write queue (prevents concurrent writes)
- Full sanitization of incoming state (removes unknown keys, validates types)
