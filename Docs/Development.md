# Development Guide

Everything you need to add features, fix bugs, and extend Romelson.

---

## Setup

```bash
# Prerequisites: Node.js 18+, npm
git clone https://github.com/withinJoel/Romelson
cd Romelson
npm install
npm start
```

DevTools are available via `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac) in the renderer window. The main process logs to your terminal.

---

## Code Conventions

### File Organization
Every file has one clear responsibility. The naming convention tells you what it does:

- `*IPC.js` — registers IPC handlers for a domain, nothing else
- `*Service.js` — business logic, no Electron imports
- `*Engine.js` — stateful singleton (AutomationEngine, ConnectorEngine)
- `*Executor.js` — executes one category of AI tools
- `*Tools.js` — tool definitions (schema only, no execution logic)

### Imports
Main process: use ESM (`import`/`export`). The `"type": "module"` in `package.json` applies to the entire project.

Renderer: also ESM. All scripts under `Public/Assets/Scripts/` use `import`/`export`. Pages load entry scripts with `<script type="module">`.

### Error Handling in IPC Handlers
Every IPC handler follows this pattern:

```javascript
ipcMain.handle('channel-name', async (_e, ...args) => {
  try {
    const result = doWork(...args)
    return { ok: true, result }
  } catch (err) {
    console.error('[ModuleName] channel-name error:', err)
    return { ok: false, error: err.message }
  }
})
```

The renderer always gets `{ ok, ... }` back — never an unhandled promise rejection across the IPC bridge.

### Paths
**Never construct paths by hand.** Always import from `Packages/Main/Paths.js`:

```javascript
import Paths from '../Paths.js'
// Use: Paths.DATA_DIR, Paths.CHATS_DIR, Paths.USER_FILE, etc.
```

---

## Adding a New Tool

Tools are the AI's live-data superpowers. Adding a tool involves four steps.

### 1. Define the Tool (Tools folder)
Create or edit a file in `Public/Assets/Scripts/Features/Chat/Tools/`:

```javascript
// Public/Assets/Scripts/Features/Chat/Tools/WeatherTools.js
export const WEATHER_TOOLS = [
  {
    name: 'get_weather',               // snake_case, unique across all tools
    description: 'Get current weather for a city.', // used by the AI planner
    category: 'open_meteo',            // maps to a connector name
    parameters: {
      location: {
        type: 'string',
        required: true,
        description: 'City name (e.g. "Mumbai")'
      },
      units: {
        type: 'string',
        required: false,
        description: '"celsius" or "fahrenheit"'
      }
    }
  }
]
```

### 2. Register in the Index
Add your tool array to `Tools/Index.js`:

```javascript
import { WEATHER_TOOLS } from './WeatherTools.js'
export const TOOLS = [
  ...GMAIL_TOOLS,
  ...GITHUB_TOOLS,
  ...WEATHER_TOOLS,  // ← add here
  // ...
]
```

Also add the connector mapping if needed:
```javascript
const CATEGORY_TO_CONNECTOR = {
  open_meteo: 'open_meteo',
  // ...
}
```

### 3. Write the Executor
Create a file in `Public/Assets/Scripts/Features/Chat/Executors/`:

```javascript
// WeatherExecutor.js
const HANDLED = new Set(['get_weather'])

export function handles(toolName) { return HANDLED.has(toolName) }

export async function execute(toolName, params, onStage = () => {}) {
  if (toolName !== 'get_weather') throw new Error(`Unknown tool: ${toolName}`)
  
  const { location, units = 'celsius' } = params
  if (!location) throw new Error('Missing required param: location')
  
  onStage(`🌍 Locating ${location}…`)
  
  // call the API, process the result
  const data = await fetch(`https://...`)
  
  return `Current weather in ${location}: 28°C, partly cloudy.`
}
```

### 4. Register the Executor
Add it to `Executors/Index.js`:

```javascript
import * as WeatherExecutor from './WeatherExecutor.js'

const EXECUTORS = [
  GmailExecutor,
  GithubExecutor,
  WeatherExecutor,  // ← add here
  // ...
]

export async function executeTool(toolName, params, onStage) {
  const executor = EXECUTORS.find(e => e.handles(toolName))
  if (!executor) throw new Error(`No executor for tool: ${toolName}`)
  return executor.execute(toolName, params, onStage)
}
```

> If `Executors/Index.js` currently returns a 401 error (GitHub API auth issue on your repo), you'll need to create it locally with this pattern.

---

## Adding a New Automation Action

### 1. Add to `ACTION_META` in `Constants.js`
```javascript
// Public/Assets/Scripts/Pages/Automations/Constants.js
my_new_action: { 
  label: '🆕 My New Action', 
  fields: ['url', 'param1'],  // which FIELD_META keys to show
  group: 'System' 
},
```

### 2. Add field metadata to `FIELD_META` (if new fields needed)
```javascript
param1: { placeholder: 'Enter value here', textarea: false },
```

### 3. Handle collection in `ActionRenderer.js`
In `collectActionFromRow()`, add a case for your action type:
```javascript
case 'my_new_action':
  action.url = get('url')
  action.param1 = get('param1')
  if (!action.url) return null
  break
```

### 4. Handle execution in `AutomationEngine.js`
In `runAction()`, add a case:
```javascript
case 'my_new_action': {
  if (!action.url) throw new Error('my_new_action: url required')
  await doTheThing(action.url, action.param1)
  console.log(`[AutomationEngine] my_new_action → ${action.url}`)
  return
}
```

---

## Adding a New IPC Channel

### 1. Add the handler to the relevant IPC file
```javascript
// Packages/Main/IPC/SomeIPC.js
ipcMain.handle('my-new-channel', async (_e, arg1, arg2) => {
  try {
    const result = await doWork(arg1, arg2)
    return { ok: true, result }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})
```

### 2. Expose it in the preload script
```javascript
// Packages/Electron/Preload.js
myNewMethod: (arg1, arg2) => ipcRenderer.invoke('my-new-channel', arg1, arg2),
```

### 3. Call it from the renderer
```javascript
const result = await window.electronAPI.myNewMethod(arg1, arg2)
```

---

## Adding a New Page

1. Create `Public/MyPage.html` — copy the titlebar, sidebar, theme-panel, avatar-panel structure from an existing page
2. Create `Public/Assets/Scripts/Pages/MyPage.js` — import `initSidebar`, `initAboutModal`, `initLibraryModal`, `initSettingsModal`, `WindowControls`
3. Create `Public/Assets/Styles/MyPagePage.css` — import the shared CSS files (see `SkillsPage.css` as a template)
4. Add a `MYPAGE_PAGE` path to `Packages/Main/Paths.js`
5. Add a launch IPC handler in `SetupIPC.js` or a new IPC file
6. Add `launchMyPage` to `Preload.js`
7. Wire the sidebar button in `Sidebar.js` (the `onMyPage` callback)

---

## The CSS Architecture

CSS is modular — one file per feature area. The page-level CSS files (e.g. `IndexPage.css`, `SkillsPage.css`) are just import lists. To add styles for a new feature:

1. Create `Public/Assets/Styles/MyFeature.css`
2. Import it at the bottom of the relevant page CSS file: `@import './MyFeature.css';`

CSS variables (colours, spacing, fonts) are defined in `Root.css` and `Themes.css`. Always use variables — never hardcode colours.

---

## Data Formats

### User.json
```json
{
  "name": "Joel",
  "setup_complete": true,
  "created_at": "2024-01-15T10:30:00Z",
  "api_keys": {
    "anthropic": "sk-ant-...",
    "openai": null
  },
  "preferences": {
    "theme": "dark",
    "default_provider": "anthropic",
    "default_model": null
  }
}
```

### Chat file (`Data/Chats/{id}.json`)
```json
{
  "id": "2024-01-15_10-30-00",
  "title": "How does TCP/IP work",
  "updatedAt": "2024-01-15T10:45:00Z",
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "messages": [
    {
      "role": "user",
      "content": "How does TCP/IP work?",
      "attachments": []
    },
    {
      "role": "assistant",
      "content": "TCP/IP is...",
      "attachments": []
    }
  ]
}
```

### Automation (`Data/Automations.json`)
```json
{
  "automations": [
    {
      "id": "auto_1234_xyz",
      "name": "Morning Setup",
      "description": "Opens tools on startup",
      "enabled": true,
      "trigger": { "type": "on_startup" },
      "actions": [
        { "type": "open_site", "url": "https://github.com" }
      ],
      "lastRun": "2024-01-15T09:00:00Z"
    }
  ]
}
```

---

## Common Gotchas

**`window.electronAPI` is undefined in the console**  
You're probably looking at the wrong DevTools. Make sure you opened DevTools from the renderer window, not the main process.

**Changes to `Paths.js` don't reflect**  
Electron caches ES module resolution. Restart the app (`npm start`).

**IPC handler not firing**  
Check that the IPC file is imported and `.register()` is called in `App.js`. Also check the channel name exactly matches (case-sensitive).

**Skills/Personas not appearing**  
Files must end in `.md` and have valid frontmatter (both opening and closing `---`). Check `parseFrontmatter()` logic — the body starts after the second `---\n`.

**Automation not running on schedule**  
The app must be open at the scheduled time. The engine checks every 60 seconds. Check that `lastRun` isn't blocking — it updates after every successful run.

**System prompt not updating after settings change**  
`invalidateSysPrompt()` must be called in the relevant IPC handler after any settings change. Check that the handler imports and calls it.
