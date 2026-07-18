# App Settings

Application settings with runtime side effects.

---

## Architecture

```text
Packages/AppSettings/
├── Index.js              — IPC handlers
├── Core/
│   ├── AppSettingsState.js       — Settings persistence
│   ├── PowerService.js           — Keep-awake mode
│   ├── AutoUpdateService.js      — electron-updater integration
│   └── DataPortabilityService.js — ZIP export/import
└── I18n/
    └── en.js             — Settings strings
```

---

## IPC Handlers (10 channels)

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

---

## Settings Shape

```js
{
  runOnStartup: false,      // Launch on system startup
  systemTray: false,        // Show in system tray
  keepAwake: false,         // Prevent system sleep
  completionSound: true,    // Play sound on AI completion
  autoMemoryUpdates: true,  // Auto-sync memory from chats
  autoUpdate: true,         // Auto-check for updates
  debugMode: false,         // Enable debug logging
}
```

---

## Runtime Side Effects

Settings changes trigger immediate runtime effects:

### Keep-Awake

```js
// PowerService.js
if (settings.keepAwake) {
  powerSaveBlocker.start('prevent-app-suspension');
} else {
  // Stop power save blocker
}
```

### Auto-Update

```js
// AutoUpdateService.js
if (settings.autoUpdate) {
  autoUpdater.checkForUpdatesAndNotify();
}
```

### Run on Startup

```js
app.setLoginItemSettings({
  openAtLogin: settings.runOnStartup,
  openAsHidden: process.platform !== 'linux',
});
```

### Debug Mode

```js
// Activates verbose logging
if (settings.debugMode) {
  enableDebugLogging();
}
```

---

## Data Portability

### Export

```js
await invokeIpc('data:export');
// Creates ZIP with:
// - Data/ folder (chats, memories, agents, etc.)
// - Config/ folder
// - User.json
```

### Import

```js
await invokeIpc('data:import');
// Opens file picker, restores data from ZIP
```

`DataPortabilityService.js` handles ZIP creation and extraction using jszip.

---

## App Reset

```js
await invokeIpc('app-settings:reset-app');
```

This:

1. Deletes all entries from `KNOWN_DATA_ENTRIES` (Data/ folder contents)
2. Resets settings to defaults
3. Relaunches the app

---

## Auto-Update Flow

1. `AutoUpdateService.js` checks for updates on app start (if enabled)
2. Downloads update in background
3. Shows notification when ready to install
4. User clicks "Install" → app restarts with update

Uses `electron-updater` with GitHub Releases as the publish target.

---

## Adding a New Setting

1. Add the setting to the default state in `AppSettingsState.js`
2. Add UI toggle in the settings panel
3. Add side effect handler if the setting affects runtime behavior
4. Update `DataStorage.md` if the setting persists to disk
