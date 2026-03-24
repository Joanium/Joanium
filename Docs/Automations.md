# Automations

Romelson's automation engine lets you schedule sequences of actions — no code required.

---

## How It Works

Automations are stored in `Data/Automations.json`. The `AutomationEngine` (a singleton in the main process) loads them on startup and runs a tick every 60 seconds to check scheduled triggers.

On startup, all `on_startup` automations run immediately. Scheduled automations are checked every minute — the engine compares the trigger definition against the current time and `lastRun` timestamp.

After each successful execution, `lastRun` is updated and persisted. This prevents an automation from running twice in the same scheduled window (e.g., a daily automation won't re-run if you restart the app later the same day).

---

## Triggers

### On Startup
Runs every time Romelson is launched. Useful for morning briefings, workspace setup, or opening your daily tools.

### Every N Minutes
`interval` trigger. Set any interval from 1 to 1440 minutes. The engine uses elapsed time since `lastRun` — if the app was closed, it runs immediately on next launch if the interval has passed.

### Every Hour
Runs at minute 0 of each hour while the app is open. Does not catch up on missed hours.

### Daily at Time
Runs once per day at a specific `HH:MM` time. The engine compares `hour` and `minute` — if the app is open at that time, the automation fires. If the app was closed, it will NOT run retroactively.

### Weekly on Day
Runs once per week on a specific day and time. Same caveat as daily — the app must be running at the scheduled time.

---

## All Available Actions

### System Actions

#### `open_site`
Opens a URL in the default browser.
- **url** (required) — full URL, e.g. `https://github.com`

#### `open_multiple_sites`
Opens multiple URLs, one per line, with a 400ms delay between each.
- **urls** (required) — one URL per line

#### `open_folder`
Opens a folder in Finder/Explorer.
- **path** (required) — absolute folder path
- **openTerminal** (optional checkbox) — also open a terminal at that path
- **terminalCommand** (optional) — command to run in that terminal

#### `run_command`
Runs a shell command.
- **command** (required) — e.g. `npm run build`
- **silent** (optional) — run in background without a terminal window
- **notifyOnFinish** (optional) — send a system notification when done

#### `run_script`
Runs a script file.
- **scriptPath** (required) — absolute path to the script
- **args** (optional) — command-line arguments
- **silent** / **notifyOnFinish** — same as `run_command`

#### `open_app`
Opens an application.
- **appPath** (required) — e.g. `/Applications/VS Code.app` or `C:\...\code.exe`

#### `send_notification`
Shows a system notification.
- **notifTitle** (required) — notification title
- **notifBody** (optional) — notification body text
- **clickUrl** (optional, via checkbox) — URL to open when notification is clicked

#### `copy_to_clipboard`
Copies text to the clipboard.
- **text** (required) — text to copy

#### `write_file`
Writes (or appends) text to a file. Creates parent directories if they don't exist.
- **filePath** (required) — absolute file path
- **content** (optional) — file content
- **append** (optional checkbox) — append instead of overwrite

#### `move_file`
Moves or renames a file.
- **sourcePath** (required)
- **destPath** (required)

#### `copy_file`
Copies a file to a new location.
- **sourcePath** (required)
- **destPath** (required)

#### `delete_file`
Permanently deletes a file. **No undo.**
- **filePath** (required)

#### `create_folder`
Creates a directory (and any missing parents).
- **path** (required)

#### `lock_screen`
Locks the computer screen.
- macOS: `pmset displaysleepnow`
- Windows: `LockWorkStation`
- Linux: `xdg-screensaver lock` (with fallbacks)

#### `http_request`
Makes an HTTP request to any URL (great for webhooks).
- **url** (required)
- **httpMethod** (required) — GET, POST, PUT, PATCH, DELETE, HEAD
- **httpHeaders** (optional, via checkbox) — `Key: Value` pairs, one per line
- **httpBody** (optional, via checkbox) — request body (JSON, form data, etc.)
- **notify** (optional) — send notification with response status

---

### Gmail Actions
*Requires Gmail connected in Settings → Connectors.*

#### `gmail_send_email`
Sends an email from your connected Gmail account.
- **to** (required) — recipient email
- **subject** (required) — email subject
- **gmailBody** (required) — email body
- **cc** / **bcc** (optional, via checkbox)

#### `gmail_get_brief`
Fetches unread emails and shows a system notification with subjects.
- **maxResults** (optional, default 10)

#### `gmail_get_unread_count`
Shows a notification with just the unread count. No body preview.

#### `gmail_search_notify`
Searches your inbox and shows matching results in a notification.
- **query** (required) — Gmail search query (e.g. `from:boss`, `subject:invoice`)
- **maxResults** (optional, default 5)

---

### GitHub Actions
*Requires GitHub connected in Settings → Connectors.*

#### `github_open_repo`
Opens a GitHub repository in the browser.
- **owner** (required)
- **repo** (required)

#### `github_check_prs`
Shows a notification with open (or closed/all) PRs.
- **owner** + **repo** (required)
- **state** (optional, default `open`) — open, closed, all

#### `github_check_issues`
Shows a notification with open issues.
- **owner** + **repo** (required)
- **state** (optional, default `open`)

#### `github_check_commits`
Shows a notification with recent commits.
- **owner** + **repo** (required)
- **maxResults** (optional, default 5)

#### `github_check_releases`
Shows a notification with the latest release tag and date.
- **owner** + **repo** (required)

#### `github_check_notifs`
Shows a notification with your unread GitHub notification count.

#### `github_create_issue`
Creates a new issue in a repository.
- **owner** + **repo** (required)
- **issueTitle** (required)
- **issueBody** (optional)
- **labels** (optional) — comma-separated, e.g. `bug, enhancement`

---

## Example Automations

### Morning Workspace Setup
**Trigger:** On startup  
**Actions:**
1. `open_site` → `https://github.com`
2. `open_site` → `https://mail.google.com`
3. `gmail_get_brief` (maxResults: 10)
4. `github_check_notifs`

### Daily Standup Reminder
**Trigger:** Daily at 09:45  
**Actions:**
1. `send_notification` — title: "Standup in 15 minutes", body: "Prepare what you did yesterday, today's plan, and blockers"

### Auto-backup on Startup
**Trigger:** On startup  
**Actions:**
1. `run_command` — `rsync -a ~/Projects/ ~/Backups/Projects/ --delete`
2. `send_notification` — title: "Backup complete"

### Weekly PR Review
**Trigger:** Weekly, Monday at 09:00  
**Actions:**
1. `github_check_prs` — owner: `your-org`, repo: `your-repo`
2. `github_check_issues` — owner: `your-org`, repo: `your-repo`

### Webhook Ping
**Trigger:** Every 30 minutes  
**Actions:**
1. `http_request` — POST to your health check or data pipeline endpoint

---

## Debugging Automations

- **Check the app console** — the AutomationEngine logs every action it runs (or fails on) to `console.log` / `console.error`. Open DevTools (`Ctrl+Shift+I`) while the main window is open.
- **Last run timestamp** — visible on each automation card. If it's outdated, the trigger might not be matching.
- **Gmail / GitHub not connected** — actions that require connectors will throw a clear error: "Gmail not connected — connect in Settings → Connectors".
- **Toggle off/on** — disable an automation and re-enable it to reset its state.
- **IPC** — if you suspect the UI isn't saving correctly, check `Data/Automations.json` directly.
