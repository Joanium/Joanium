# Boot Process

The application bootstrap is a multi-stage sequence that discovers packages, resolves the entry point, and creates the Electron window.

---

## Entry Point: `App.js`

```text
App.js
├── Configures DebugLogger with rootDirectory
├── Sets up uncaughtException / unhandledRejection handlers
├── Writes boot log to Build/Logs/ or process.resourcesPath/Logs/
└── Calls bootstrapApplication()
```

`bootstrapApplication()` is imported from `Packages/Index.js`.

Boot logs go to `Build/Logs/electron-boot.log` in dev or `process.resourcesPath/Logs/electron-boot.log` in packaged builds.

---

## Bootstrap Sequence: `Packages/Index.js`

The bootstrap is a 5-step process:

### Step 1: Package Discovery

```js
import { discoverPackages } from './Boot/Index.js';
```

`discoverPackages(packagesDirectory)` scans the `Packages/` directory for subdirectories containing a non-empty `Index.js` file. Returns a `Map<name, { id, entryPath }>`.

No package names are hardcoded. Adding a new package is automatic — just create a directory with an `Index.js`.

### Step 2: Load Core Modules

```js
const electron = loadPackageModule(registry, 'Electron');
const setup = loadPackageModule(registry, 'Setup');
```

The `Electron` and `Setup` packages are loaded first because they are needed before any other package.

### Step 3: Resolve Entry Package

```js
const entryPackageName = setup.resolveLaunchPackage({ rootDirectory });
```

`resolveLaunchPackage()` checks if onboarding is complete:

- If incomplete → returns `'Setup'` (shows the onboarding wizard)
- If complete → returns `'Shell'` (jumps to the main app)

### Step 4: Create Entry Package

```js
const entryPackage = await createPackage(entryPackageName);
```

`createPackage()` is a recursive function that:

1. Loads the package module from the registry
2. Calls its `createPackage()` export with `{ rootDirectory, packagesDirectory, registry }`
3. Recursively creates any `ipcCompanions` (packages whose IPC handlers are merged into the current window)
4. Merges all IPC handlers into a single `ipcHandlers` array
5. Detects circular companion dependencies and throws an error

For Shell, this means ALL other packages' IPC handlers get merged into one BrowserWindow.

### Step 5: Boot Electron

```js
electron.bootElectron({ rootDirectory, entryPackage, loadPackage: createPackage });
```

`bootElectron()` creates the BrowserWindow, registers IPC handlers, and starts the app.

---

## Package Auto-Discovery: `Packages/Boot/Index.js`

The boot system has 3 exports:

### `discoverPackages(packagesDirectory)`

Scans `Packages/` for directories with non-empty `Index.js`. Returns a `Map` of discovered packages. Filters out non-directories and empty files.

### `loadPackageModule(registry, packageName)`

Dynamic `import()` of a package's `Index.js` using `pathToFileURL` for cross-platform compatibility. The module is cached after first load.

### `createBootLogger(logFilePath)`

Returns a timestamped boot-logging function for diagnostic output.

---

## IPC Composition

When Shell creates its BrowserWindow, it declares all other packages as `ipcCompanions`. The bootstrap recursively creates each companion, collecting their IPC handlers:

```text
Shell
├── Shell.ipcHandlers (shell:bootstrap)
├── Chat.ipcHandlers (11 channels — merged)
├── Memory.ipcHandlers (16 channels — merged)
├── Toolset.ipcHandlers (6 channels — merged)
├── Providers.ipcHandlers (6 channels — merged)
├── ... (all other packages)
└── All handlers registered on ipcMain
```

This means a single BrowserWindow has access to every package's IPC channels. The renderer process calls these via `window.Joanium.ipc.invoke()`.

---

## Electron Main Process: `Packages/Electron/Index.js`

`bootElectron()` configures:

**Chromium flags** (before app ready):

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

---

## Setup/Onboarding: `Packages/Setup/`

The setup wizard guides first-time users through:

1. Terms and conditions acceptance
2. User name and age
3. AI model selection (API or local)
4. Completion confirmation

`resolveLaunchPackage()` checks if onboarding is complete and routes accordingly.

---

## Shell Window: `Packages/Shell/`

The Shell is the main app container:

- **rendererPath**: `Shell/UI/App.html`
- **preloadPath**: `Shell/UI/Preload.js`
- **Window**: Frameless with titlebar overlay (platform-specific)
- **SPA Router**: `ShellApp.js` handles navigation between views

The Shell mounts settings panels, sidebar, and routes to different views (chat, history, projects, memory, templates, agents, skills, personas, marketplace, events, usage).

---

## Debug Mode

Start with `npm start --debug` or `JOANIUM_DEBUG=1 npm start` to:

- Print verbose main-process diagnostics to terminal
- Write debug logs to `Build/Logs/debug.log`
- Log package discovery, active tool inventory, prompt sizes, provider/model selection
- Log each Toolset execution with duration and sanitized parameters
