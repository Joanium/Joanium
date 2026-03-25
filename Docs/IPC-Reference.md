# IPC Reference

Every IPC channel exposed by Evelina. All channels use `ipcRenderer.invoke()` (request/response) unless noted as `ipcRenderer.send()` (fire-and-forget).

The preload script (`Packages/Electron/Preload.js`) exposes all channels as `window.electronAPI.*` methods. The renderer never calls ipcRenderer directly.

---

## User & Profile

### `get-user`
Returns the full user object from `Data/User.json`.

```typescript
const user = await window.electronAPI.getUser()
// Returns: { name, setup_complete, created_at, api_keys, preferences }
```

### `save-user`
Writes a user object (used by setup wizard).

```typescript
await window.electronAPI.saveUser({
  name: 'Joel',
  setup_complete: true,
  created_at: new Date().toISOString(),
  preferences: { theme: 'dark', default_provider: 'anthropic', default_model: null }
})
```

### `save-user-profile`
Updates only the user's display name.

```typescript
const result = await window.electronAPI.saveUserProfile({ name: 'Joel Jolly' })
// Returns: { ok: boolean, user?: object, error?: string }
```

### `save-api-keys`
Saves one or more provider API keys. Pass `null` to delete a key.

```typescript
await window.electronAPI.saveAPIKeys({ anthropic: 'sk-ant-...', openai: null })
// Returns: { ok: boolean, user?: object, error?: string }
```

### `get-api-key`
Returns the stored API key for a specific provider.

```typescript
const key = await window.electronAPI.getAPIKey('anthropic')
// Returns: string | null
```

### `get-models`
Returns all providers from `Data/Models.json`, each augmented with the stored API key.

```typescript
const models = await window.electronAPI.getModels()
// Returns: Array<{ provider, label, endpoint, auth_header, models: {...}, api: string|null }>
```

### `get-custom-instructions` / `save-custom-instructions`
Read and write `Data/CustomInstructions.md`.

```typescript
const instructions = await window.electronAPI.getCustomInstructions()
await window.electronAPI.saveCustomInstructions('You should be concise.')
// save returns: { ok: boolean }
```

### `get-memory` / `save-memory`
Read and write `Data/Memory.md`.

```typescript
const memory = await window.electronAPI.getMemory()
await window.electronAPI.saveMemory('I am Joel Jolly, I work in AI engineering.')
// save returns: { ok: boolean }
```

---

## System Prompt

### `get-system-prompt`
Builds and returns the full system prompt (cached, refreshed on settings change).

```typescript
const systemPrompt = await window.electronAPI.getSystemPrompt()
// Returns: string (the full prompt)
```

The prompt includes: persona, user context, time/OS/country, GitHub repos, Gmail email, memory, custom instructions, skills.

---

## Chat

### `save-chat`
Persists a chat conversation to `Data/Chats/{id}.json`.

```typescript
await window.electronAPI.saveChat({
  id: '2024-01-15_10-30-00',
  title: 'How does TCP/IP work',
  updatedAt: new Date().toISOString(),
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  messages: [
    { role: 'user', content: '...', attachments: [] },
    { role: 'assistant', content: '...', attachments: [] }
  ]
})
```

### `get-chats`
Returns all saved chats, sorted newest-first.

```typescript
const chats = await window.electronAPI.getChats()
// Returns: Array<{ id, title, updatedAt, provider, model, messages }>
```

### `load-chat`
Returns a single chat by ID.

```typescript
const chat = await window.electronAPI.loadChat('2024-01-15_10-30-00')
// Returns: chat object | null
```

### `delete-chat`
Deletes a chat file.

```typescript
await window.electronAPI.deleteChat('2024-01-15_10-30-00')
// Returns: { ok: boolean }
```

---

## Automations

### `get-automations`
Returns all automations from `Data/Automations.json`.

```typescript
const result = await window.electronAPI.getAutomations()
// Returns: { ok: boolean, automations: Array<AutomationObject> }
```

### `save-automation`
Creates or updates an automation.

```typescript
const result = await window.electronAPI.saveAutomation({
  id: 'auto_1234_xyz',
  name: 'Morning Setup',
  description: 'Opens tools on startup',
  enabled: true,
  trigger: { type: 'on_startup' },
  actions: [{ type: 'open_site', url: 'https://github.com' }],
  lastRun: null
})
// Returns: { ok: boolean, automation?: object, error?: string }
```

### `delete-automation`
Deletes an automation by ID.

```typescript
await window.electronAPI.deleteAutomation('auto_1234_xyz')
// Returns: { ok: boolean }
```

### `toggle-automation`
Enables or disables an automation without editing it.

```typescript
await window.electronAPI.toggleAutomation('auto_1234_xyz', false)
// Returns: { ok: boolean }
```

### `launch-automations`
Navigates the window to `Automations.html`.

```typescript
await window.electronAPI.launchAutomations()
```

---

## Connectors

### `get-connectors`
Returns status of all connectors (no credentials exposed).

```typescript
const connectors = await window.electronAPI.getConnectors()
// Returns: {
//   gmail: { enabled, connectedAt, isFree, noKey },
//   github: { enabled, connectedAt, isFree, noKey },
//   open_meteo: { enabled, ... },
//   ...
// }
```

### `save-connector`
Saves credentials for a service connector (Gmail, GitHub).

```typescript
await window.electronAPI.saveConnector('github', { token: 'ghp_...' })
// Returns: { ok: boolean, enabled: true, connectedAt: string }
```

### `remove-connector`
Disconnects a service connector and clears its credentials.

```typescript
await window.electronAPI.removeConnector('github')
// Returns: { ok: boolean }
```

### `validate-connector`
Tests stored credentials against the live API.

```typescript
const result = await window.electronAPI.validateConnector('github')
// Returns: { ok: boolean, username?: string, avatar?: string, error?: string }
// For gmail: { ok: boolean, email?: string, error?: string }
```

### `get-free-connector-config`
Returns the full config for a free API connector, including stored API key.

```typescript
const config = await window.electronAPI.getFreeConnectorConfig('fred')
// Returns: { enabled, isFree, noKey, credentials: { apiKey: '...' } }
```

### `toggle-free-connector`
Enables or disables a free connector.

```typescript
await window.electronAPI.toggleFreeConnector('coingecko', false)
// Returns: { ok: boolean }
```

### `save-free-connector-key`
Saves an optional API key for a free connector (FRED, Unsplash, OpenWeatherMap).

```typescript
await window.electronAPI.saveFreeConnectorKey('fred', 'your-api-key')
// Returns: { ok: boolean }
```

---

## Gmail

### `gmail-oauth-start`
Initiates the OAuth flow. Opens a browser window, starts a local callback server on port 42813.

```typescript
const result = await window.electronAPI.gmailOAuthStart(clientId, clientSecret)
// Returns: { ok: boolean, email?: string, error?: string }
```

### `gmail-get-brief`
Fetches unread emails and returns count + formatted text.

```typescript
const brief = await window.electronAPI.gmailGetBrief(15)
// Returns: { ok: boolean, count: number, text: string, error?: string }
```

### `gmail-get-unread`
Returns full unread email objects.

```typescript
const result = await window.electronAPI.gmailGetUnread(20)
// Returns: { ok: boolean, emails: Array<{ id, subject, from, snippet }> }
```

### `gmail-send`
Sends an email via the connected Gmail account.

```typescript
const result = await window.electronAPI.gmailSend('to@example.com', 'Subject', 'Body text')
// Returns: { ok: boolean, error?: string }
```

### `gmail-search`
Searches Gmail with a query string.

```typescript
const result = await window.electronAPI.gmailSearch('from:boss subject:urgent', 10)
// Returns: { ok: boolean, emails: Array<{ id, subject, from, snippet }> }
```

---

## GitHub

### `github-get-repos`
Returns the user's repositories (sorted by last updated, up to 30).

```typescript
const result = await window.electronAPI.githubGetRepos()
// Returns: { ok: boolean, repos: Array<repo> }
```

### `github-get-file`
Returns the content of a file from a repository.

```typescript
const result = await window.electronAPI.githubGetFile('withinJoel', 'Evelina', 'README.md')
// Returns: { ok: boolean, path, name, content, sha, size, url }
```

### `github-get-tree`
Returns the file tree of a repository.

```typescript
const result = await window.electronAPI.githubGetTree('withinJoel', 'Evelina', 'main')
// Returns: { ok: boolean, tree: Array<{ path, type, sha }> }
```

### `github-get-issues`
Returns issues for a repository.

```typescript
const result = await window.electronAPI.githubGetIssues('withinJoel', 'Evelina', 'open')
// Returns: { ok: boolean, issues: Array<issue> }
```

### `github-get-prs`
Returns pull requests for a repository.

```typescript
const result = await window.electronAPI.githubGetPRs('withinJoel', 'Evelina', 'open')
// Returns: { ok: boolean, prs: Array<pr> }
```

### `github-get-notifications`
Returns unread GitHub notifications.

```typescript
const result = await window.electronAPI.githubGetNotifications()
// Returns: { ok: boolean, notifications: Array<notification> }
```

### `github-get-commits`
Returns recent commits for a repository.

```typescript
const result = await window.electronAPI.githubGetCommits('withinJoel', 'Evelina')
// Returns: { ok: boolean, commits: Array<commit> }
```

---

## Local Dev & Terminal

These channels back the chat agent's local workspace tools.

### `inspect-workspace`
Summarises the current codebase: languages, frameworks, scripts, test signals, CI, and infra hints.

```typescript
const result = await window.electronAPI.inspectWorkspace({ rootPath: 'D:\\Projects\\OpenWorld' })
// Returns: { ok: boolean, summary: { path, languages, frameworks, packageScripts, testing, infra, ... } }
```

### `search-workspace`
Searches text across the workspace and returns matching files with line snippets.

```typescript
const result = await window.electronAPI.searchWorkspace({
  rootPath: 'D:\\Projects\\OpenWorld',
  query: 'apply_file_patch',
  maxResults: 20
})
// Returns: { ok: boolean, root, matches: Array<{ path, lineNumber, line }> }
```

### `read-local-file` / `read-file-chunk`
Reads a full text file preview or a specific line range.

```typescript
await window.electronAPI.readLocalFile({ filePath: 'D:\\Projects\\OpenWorld\\App.js', maxLines: 150 })
await window.electronAPI.readFileChunk({ filePath: 'D:\\Projects\\OpenWorld\\App.js', startLine: 1, lineCount: 80 })
```

### `extract-document-text`
Extracts readable text from a local path or an uploaded binary document buffer. Supports PDF, DOCX, XLSX/XLS/ODS, PPTX, RTF, and plain text formats.

```typescript
await window.electronAPI.extractDocumentText({
  filePath: 'D:\\Projects\\OpenWorld\\Docs\\Roadmap.pdf'
})

await window.electronAPI.extractDocumentText({
  fileName: 'proposal.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  buffer: arrayBuffer
})
// Returns: { ok: boolean, kind?: string, summary?: string, text?: string, lines?: number, warnings?: string[], error?: string }
```

### `read-multiple-local-files`
Reads several text files in one round trip for compare-and-edit workflows.

```typescript
const result = await window.electronAPI.readMultipleLocalFiles({
  paths: 'D:\\Projects\\OpenWorld\\App.js,D:\\Projects\\OpenWorld\\package.json',
  maxLinesPerFile: 120
})
// Returns: { ok: boolean, files: Array<{ ok, path, content?, totalLines?, sizeBytes?, error? }> }
```

### `list-directory` / `list-directory-tree`
Lists one folder flat or as a shallow recursive tree.

```typescript
await window.electronAPI.listDirectory({ dirPath: 'D:\\Projects\\OpenWorld\\Packages' })
await window.electronAPI.listDirectoryTree({ dirPath: 'D:\\Projects\\OpenWorld\\Packages', maxDepth: 3, maxEntries: 200 })
```

### `write-ai-file` / `apply-file-patch`
Writes a full file or performs exact-text replacement in place.

```typescript
await window.electronAPI.writeAIFile({ filePath: 'D:\\Projects\\OpenWorld\\tmp.txt', content: 'hello' })
await window.electronAPI.applyFilePatch({
  filePath: 'D:\\Projects\\OpenWorld\\App.js',
  search: 'old text',
  replace: 'new text'
})
```

### `replace-lines-in-file` / `insert-into-file`
Supports surgical edits by line range or by insertion target.

```typescript
await window.electronAPI.replaceLinesInFile({
  filePath: 'D:\\Projects\\OpenWorld\\App.js',
  startLine: 10,
  endLine: 14,
  replacement: 'const value = 42;'
})

await window.electronAPI.insertIntoFile({
  filePath: 'D:\\Projects\\OpenWorld\\App.js',
  content: '\\nimport fs from \"fs\";\\n',
  anchor: "import { app, BrowserWindow } from 'electron';",
  position: 'after'
})
```

### `copy-item` / `move-item` / `create-directory` / `delete-item`
Copies, renames, creates, or deletes files and folders.

```typescript
await window.electronAPI.copyItem({ sourcePath: 'D:\\Projects\\OpenWorld\\.env.example', destinationPath: 'D:\\Projects\\OpenWorld\\.env' })
await window.electronAPI.moveItem({ sourcePath: 'D:\\Projects\\OpenWorld\\old.js', destinationPath: 'D:\\Projects\\OpenWorld\\new.js' })
await window.electronAPI.createDirectory({ dirPath: 'D:\\Projects\\OpenWorld\\tmp\\reports' })
await window.electronAPI.deleteItem({ itemPath: 'D:\\Projects\\OpenWorld\\tmp\\old-report.txt' })
```

### `run-shell-command` / `assess-command-risk` / `run-project-checks`
Runs short-lived commands, assesses destructive risk, and executes detected lint/test/build scripts.

```typescript
await window.electronAPI.assessCommandRisk({ command: 'git push --force' })
await window.electronAPI.runShellCommand({ command: 'npm run lint', cwd: 'D:\\Projects\\OpenWorld', timeout: 30000 })
await window.electronAPI.runProjectChecks({ working_directory: 'D:\\Projects\\OpenWorld' })
```

### `git-status` / `git-diff` / `git-create-branch`
Exposes lightweight Git operations for local review and workflow setup.

```typescript
await window.electronAPI.gitStatus({ workingDir: 'D:\\Projects\\OpenWorld' })
await window.electronAPI.gitDiff({ workingDir: 'D:\\Projects\\OpenWorld', staged: false })
await window.electronAPI.gitCreateBranch({ workingDir: 'D:\\Projects\\OpenWorld', branchName: 'codex/new-tools' })
```

### `pty-spawn` / `pty-write` / `pty-kill`
Starts a long-running process whose output is streamed into the embedded chat terminal.

```typescript
const { pid } = await window.electronAPI.spawnPty({ command: 'npm run dev', cwd: 'D:\\Projects\\OpenWorld' })
await window.electronAPI.writePty(pid, 'rs\n')
await window.electronAPI.killPty(pid)
```

---

## Skills & Personas

### `get-skills`
Returns all installed skills from the `Skills/` folder.

```typescript
const result = await window.electronAPI.getSkills()
// Returns: { ok: boolean, skills: Array<{ filename, name, trigger, description, body, raw }> }
```

### `get-personas`
Returns all installed personas from the `Personas/` folder.

```typescript
const result = await window.electronAPI.getPersonas()
// Returns: { ok: boolean, personas: Array<{ filename, name, personality, description, instructions }> }
```

### `get-active-persona`
Returns the currently active persona (or null if using default).

```typescript
const result = await window.electronAPI.getActivePersona()
// Returns: { ok: boolean, persona: PersonaObject | null }
```

### `set-active-persona`
Sets a persona as active. Pass the full persona object from `get-personas`.

```typescript
await window.electronAPI.setActivePersona(personaObject)
// Returns: { ok: boolean }
```

### `reset-active-persona`
Returns to the default assistant (removes `ActivePersona.json`).

```typescript
await window.electronAPI.resetActivePersona()
// Returns: { ok: boolean }
```

---

## Usage

### `track-usage`
Records one API call's token usage.

```typescript
await window.electronAPI.trackUsage({
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  modelName: 'Claude Sonnet 4.6',
  inputTokens: 1234,
  outputTokens: 567,
  chatId: '2024-01-15_10-30-00'
})
```

### `get-usage`
Returns all usage records.

```typescript
const result = await window.electronAPI.getUsage()
// Returns: { ok: boolean, records: Array<UsageRecord> }
```

### `clear-usage`
Deletes all usage records.

```typescript
await window.electronAPI.clearUsage()
// Returns: { ok: boolean }
```

### `launch-usage`
Navigates to the Usage page.

```typescript
await window.electronAPI.launchUsage()
```

---

## Navigation

All launch/navigate channels load a new HTML page in the same BrowserWindow:

```typescript
await window.electronAPI.launchMain()        // → Public/Chat.html
await window.electronAPI.launchAutomations() // → Public/Automations.html
await window.electronAPI.launchSkills()      // → Public/Skills.html
await window.electronAPI.launchPersonas()    // → Public/Personas.html
await window.electronAPI.launchUsage()       // → Public/Usage.html
```

---

## Window Controls

These use `ipcRenderer.send()` (one-way), not `invoke()`.

```typescript
window.electronAPI.minimize()  // ipcMain.on('window-minimize')
window.electronAPI.maximize()  // ipcMain.on('window-maximize') — toggles maximize/restore
window.electronAPI.close()     // ipcMain.on('window-close')
```
