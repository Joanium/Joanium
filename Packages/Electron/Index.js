import path from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, net, powerSaveBlocker, protocol } from 'electron';
import { createBootLogger } from '../Boot/Index.js';
import {
  applyWindowState,
  attachWindowStatePersistence,
  readWindowState,
} from './Core/WindowState.js';

// Prevent Chromium from throttling timers, IPC, and JS execution when the
// window is in the background. Without these the app becomes unresponsive
// after being backgrounded for an extended period.
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('force-color-profile', 'srgb');

// Register app:// as a privileged scheme so the renderer treats it as secure.
// Must be called before the app 'ready' event fires.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// Disable Windows' native window occlusion tracker. Chromium uses this OS
// signal to throttle occluded windows through a separate code path that
// disable-backgrounding-occluded-windows alone does not cover.
// OccludedWindowWebContentsExperiment is a second occlusion-based suspension
// path in the WebContents layer — must be disabled separately.
app.commandLine.appendSwitch(
  'disable-features',
  'CalculateNativeWinOcclusion,OccludedWindowWebContentsExperiment',
);

// Speed up GPU channel establishment so the first frame renders immediately
// when the user switches back to the app after a long absence.
app.commandLine.appendSwitch(
  'enable-features',
  'EarlyEstablishGpuChannel,EstablishGpuChannelAsync',
);

let mainWindow = null;
let currentPackage = null;
let packageLoader = null;
let registeredChannels = new Set();
let navigationSequence = Promise.resolve();

// ── Production hardening ───────────────────────────────────────────────────
// Applied to every WebContents instance in packaged builds.
// Covers reload, hard-reload, DevTools, view-source, and inspect shortcuts
// across the main window and any secondary web contents that may be created.

function applyProductionHardening(webContents) {
  // Block all keyboard shortcuts that could reload, inspect, or expose
  // internal content. Intercepted before Chromium acts on them.
  webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase();
    const ctrl = input.control || input.meta; // Ctrl on Windows/Linux, Cmd on macOS

    // Reload
    const reload = ctrl && !input.shift && !input.alt && key === 'r';
    // Hard reload (Ctrl+Shift+R, Ctrl+F5, Shift+F5)
    const hardReload =
      (ctrl && input.shift && key === 'r') ||
      (ctrl && key === 'f5') ||
      (!ctrl && input.shift && key === 'f5');
    // Any F5 variant
    const f5 = key === 'f5';
    // DevTools (Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, F12)
    const devTools =
      (ctrl && input.shift && (key === 'i' || key === 'j' || key === 'c')) || key === 'f12';
    // View source (Ctrl+U)
    const viewSource = ctrl && !input.shift && !input.alt && key === 'u';

    if (reload || hardReload || f5 || devTools || viewSource) {
      event.preventDefault();
    }
  });

  // Suppress the default Chromium context menu — it contains "Inspect" and
  // "View Page Source" entries. The renderer's own custom menus are unaffected
  // since those are dispatched via IPC, not this event.
  webContents.on('context-menu', (event) => {
    event.preventDefault();
  });
}

// In packaged builds, process.cwd() may point to a non-writable install directory.
// Use process.resourcesPath/Logs instead — it's always writable next to the asar.
const writeBootLog = createBootLogger(
  process.resourcesPath
    ? path.join(process.resourcesPath, 'Logs', 'electron-boot.log')
    : path.join(process.cwd(), 'Build', 'Logs', 'electron-boot.log'),
);

function registerIpcHandlers(handlerDefinitions = []) {
  writeBootLog('registerIpcHandlers:start', String(handlerDefinitions.length));
  const nextChannels = new Set(handlerDefinitions.map((definition) => definition.channel));

  for (const channel of registeredChannels) {
    if (!nextChannels.has(channel)) {
      ipcMain.removeHandler(channel);
    }
  }

  for (const definition of handlerDefinitions) {
    ipcMain.removeHandler(definition.channel);
    ipcMain.handle(definition.channel, definition.handler);
    writeBootLog('registerIpcHandlers:channel', definition.channel);
  }

  registeredChannels = nextChannels;
}

async function createMainWindow(entryPackage) {
  writeBootLog('createMainWindow:start', entryPackage.rendererPath);
  const rootDirectory = process.cwd();
  const windowState = await readWindowState(rootDirectory);
  const browserWindow = new BrowserWindow({
    ...windowState.bounds,
    minWidth: 1160,
    minHeight: 780,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#f2eafa',
    webPreferences: {
      preload: entryPackage.preloadPath,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false,
      // Disable DevTools in packaged builds. setDevToolsEnabled() was removed
      // in Electron 36+ — webPreferences.devTools is the correct replacement.
      devTools: !app.isPackaged,
    },
    ...entryPackage.window,
  });
  applyWindowState(browserWindow, windowState);
  attachWindowStatePersistence(browserWindow, rootDirectory);

  const ensureVisible = () => {
    if (browserWindow.isDestroyed()) {
      return;
    }

    if (browserWindow.isMinimized()) {
      browserWindow.restore();
    }

    browserWindow.show();
    browserWindow.focus();
    browserWindow.moveTop();
    browserWindow.flashFrame(true);
    browserWindow.setAlwaysOnTop(true);
    setTimeout(() => {
      if (!browserWindow.isDestroyed()) {
        browserWindow.setAlwaysOnTop(false);
        browserWindow.flashFrame(false);
      }
    }, 1500);
  };

  browserWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    // level: 0=verbose, 1=info, 2=warning, 3=error
    if (level >= 2) {
      writeBootLog(
        'renderer:console',
        JSON.stringify({ level, message, line: line ?? 0, source: sourceId ?? '' }),
      );
    }
  });

  browserWindow.once('ready-to-show', ensureVisible);
  browserWindow.webContents.once('did-finish-load', ensureVisible);
  browserWindow.on('show', () => {
    writeBootLog('browserWindow:show');
  });
  browserWindow.webContents.on('did-start-loading', () => {
    writeBootLog('webContents:did-start-loading');
  });
  browserWindow.webContents.on('did-finish-load', () => {
    writeBootLog('webContents:did-finish-load');
  });
  browserWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedUrl) => {
      writeBootLog(
        'webContents:did-fail-load',
        JSON.stringify({ errorCode, errorDescription, validatedUrl }),
      );
      console.error('Renderer failed to load:', {
        errorCode,
        errorDescription,
        validatedUrl,
      });
      ensureVisible();
    },
  );
  browserWindow.webContents.on('render-process-gone', (_event, details) => {
    writeBootLog('webContents:render-process-gone', JSON.stringify(details));
    console.error('Renderer process exited:', details);
    ensureVisible();
  });

  // ── Geolocation permission ────────────────────────────────────────────────
  const isAllowedPermission = (permission, details = {}) =>
    permission === 'geolocation' ||
    (permission === 'media' &&
      (details.mediaType === 'audio' || details.mediaTypes?.includes('audio')));

  browserWindow.webContents.session.setPermissionCheckHandler(
    (_webContents, permission, _requestingOrigin, details) =>
      isAllowedPermission(permission, details),
  );
  browserWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback, details) =>
      callback(isAllowedPermission(permission, details)),
  );

  await browserWindow.loadFile(entryPackage.rendererPath);
  writeBootLog('createMainWindow:loadFile-resolved');

  // Belt-and-suspenders: set background throttling off directly on the
  // WebContents instance. The webPreferences flag is sometimes overridden by
  // Chromium's visibility state machinery after the first hide/show cycle.
  browserWindow.webContents.setBackgroundThrottling(false);

  // Kick the compositor back to life the instant the window regains focus.
  // Without this Chromium can take 2-5 s to repaint after being occluded
  // because it waits for the next scheduled vsync rather than painting now.
  browserWindow.on('focus', () => {
    writeBootLog('browserWindow:focus');
    if (!browserWindow.isDestroyed()) {
      browserWindow.webContents.invalidate();
    }
  });
  browserWindow.on('show', () => {
    if (!browserWindow.isDestroyed()) {
      browserWindow.webContents.invalidate();
    }
  });

  // ── Production hardening ───────────────────────────────────────────────────
  // Only active in packaged builds. During development these stay open so you
  // can use DevTools and reload normally.
  if (app.isPackaged) {
    applyProductionHardening(browserWindow.webContents);
  }

  ensureVisible();
  return browserWindow;
}

function queueNavigation(navigate) {
  const nextTask = navigationSequence.then(navigate, navigate);
  navigationSequence = nextTask.catch(() => {});
  return nextTask;
}

async function navigateToPackage(packageId) {
  if (!packageLoader) {
    throw new Error('Package loader is not available.');
  }

  if (currentPackage?.id === packageId) {
    return { packageId };
  }

  writeBootLog('navigateToPackage:start', packageId);
  const previousPackage = currentPackage;
  const previousWindow = mainWindow;
  const nextPackage = await packageLoader(packageId);

  // Register next handlers immediately so the new renderer can call them on boot.
  // Old handlers are kept alive until the old window is destroyed.
  for (const definition of nextPackage.ipcHandlers ?? []) {
    ipcMain.removeHandler(definition.channel);
    ipcMain.handle(definition.channel, definition.handler);
  }

  try {
    const nextWindow = await createMainWindow(nextPackage);
    mainWindow = nextWindow;
    currentPackage = nextPackage;

    if (previousWindow && !previousWindow.isDestroyed()) {
      previousWindow.destroy();
    }

    // Now that the old window is gone, remove any stale handlers it owned.
    registerIpcHandlers(nextPackage.ipcHandlers);

    writeBootLog('navigateToPackage:complete', packageId);
    return { packageId };
  } catch (error) {
    if (previousPackage) {
      registerIpcHandlers(previousPackage.ipcHandlers);
      currentPackage = previousPackage;
    }

    mainWindow = previousWindow;
    writeBootLog('navigateToPackage:error', error?.stack ?? String(error));
    throw error;
  }
}

export async function bootElectron({ entryPackage, loadPackage }) {
  writeBootLog('bootElectron:start');
  writeBootLog('bootElectron:process-type', process.type ?? 'browser');
  writeBootLog('bootElectron:app-isReady-initial', String(app.isReady()));
  currentPackage = entryPackage;
  packageLoader = loadPackage;
  registerIpcHandlers(entryPackage.ipcHandlers);
  ipcMain.removeHandler('app:navigate');
  ipcMain.handle('app:navigate', async (_event, packageId) => {
    if (typeof packageId !== 'string' || !packageId.trim()) {
      throw new Error('A valid package id is required for navigation.');
    }

    return queueNavigation(() => navigateToPackage(packageId.trim()));
  });

  app.on('activate', async () => {
    writeBootLog('app:activate');
    if (BrowserWindow.getAllWindows().length === 0) {
      const packageToOpen = currentPackage ?? entryPackage;
      mainWindow = await createMainWindow(packageToOpen);
      writeBootLog('app:activate-window-recreated');
    }
  });

  app.on('window-all-closed', () => {
    writeBootLog('app:window-all-closed');
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('web-contents-created', (_event, webContents) => {
    writeBootLog('app:web-contents-created');
    if (app.isPackaged) {
      applyProductionHardening(webContents);
    }
  });

  app.on('browser-window-created', () => {
    writeBootLog('app:browser-window-created');
  });

  const launchMainWindow = async () => {
    writeBootLog('launchMainWindow:start');

    // ── app:// protocol handler ─────────────────────────────────────────────
    // Serves files from resource directories (Assets/, etc.) via a stable URL
    // scheme that works in both dev and packed builds, avoiding the file://
    // cross-origin restrictions Chromium enforces in packaged Electron apps.
    protocol.handle('app', (request) => {
      const url = new URL(request.url);
      const host = url.hostname.charAt(0).toUpperCase() + url.hostname.slice(1);
      const relativePath = url.pathname.replace(/^\//, '');
      const rootDir = app.isPackaged ? process.resourcesPath : process.cwd();
      const filePath = path.join(rootDir, host, relativePath);
      return net.fetch('file:///' + filePath.replace(/\\/g, '/'));
    });

    // ── Strip the default application menu in production ───────────────────
    // Electron ships with a built-in menu that includes accelerators for
    // Reload (Ctrl+R / F5), Hard-Reload (Ctrl+Shift+R), DevTools (F12), and
    // View Source (Ctrl+U). These accelerators are resolved at the native
    // menu level — BEFORE before-input-event fires — so they completely
    // bypass the WebContents keyboard handler. Setting the application menu
    // to null removes every accelerator at once and is the only reliable way
    // to block them in a packaged build.
    if (app.isPackaged) {
      Menu.setApplicationMenu(null);
    }

    mainWindow = await createMainWindow(entryPackage);
    powerSaveBlocker.start('prevent-app-suspension');
    writeBootLog('launchMainWindow:complete');
  };

  if (app.isReady()) {
    writeBootLog('bootElectron:app-ready-immediate');
    await launchMainWindow();
  } else {
    writeBootLog('bootElectron:waiting-for-ready-event');
    app.once('ready', () => {
      writeBootLog('app:ready-event');
      launchMainWindow().catch((error) => {
        writeBootLog('launchMainWindow:error', error?.stack ?? String(error));
        throw error;
      });
    });
  }
}
