import { BrowserWindow, shell, app } from 'electron';
import Paths from './Paths.js';
import { attachWindowStatePersistence, loadWindowState } from '../Services/WindowStateService.js';

let _win = null;

const PLATFORM = process.platform; // 'darwin' | 'win32' | 'linux'

// Default overlay colours match the light theme (--titlebar-bg + --text-muted)
// Updated at runtime via setTitleBarOverlay() when the user switches themes
const DEFAULT_WIN_OVERLAY = { color: '#e8e6e1', symbolColor: '#a09d97', height: 36 };

/**
 * Returns the platform-appropriate frame / titlebar options:
 *   macOS  → hiddenInset  (native traffic lights, our drag region)
 *   Windows → hidden + titleBarOverlay  (native Win11 caption controls)
 *   Linux   → native OS frame (frame: true)
 */
function getTitleBarOptions() {
  if (PLATFORM === 'darwin') {
    return {
      frame: false,
      titleBarStyle: 'hiddenInset',
    };
  }
  if (PLATFORM === 'win32') {
    return {
      frame: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: DEFAULT_WIN_OVERLAY,
    };
  }
  // Linux: fall back to a fully native OS frame
  return {
    frame: true,
    titleBarStyle: 'default',
  };
}

function applyPageWindowState(win, page, windowState = loadWindowState()) {
  if (win)
    return page === Paths.SETUP_PAGE
      ? (win.isFullScreen() && win.setFullScreen(!1), void win.maximize())
      : void (windowState.isFullScreen
          ? win.setFullScreen(!0)
          : (win.isFullScreen() && win.setFullScreen(!1),
            windowState.isMaximized
              ? win.maximize()
              : (win.isMaximized() && win.unmaximize(),
                windowState.bounds && win.setBounds(windowState.bounds))));
}

export function optimizeApp() {
  app.commandLine.appendSwitch('enable-features', 'BackForwardCache');
}

export function create(page) {
  const windowState = loadWindowState();
  const titleBarOptions = getTitleBarOptions();

  _win = new BrowserWindow({
    width: windowState.bounds.width,
    height: windowState.bounds.height,
    x: windowState.bounds.x,
    y: windowState.bounds.y,
    minWidth: 1100,
    minHeight: 720,
    ...titleBarOptions,
    backgroundColor: '#ffffff',
    show: !0,
    webPreferences: {
      preload: Paths.PRELOAD,
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1,
      backgroundThrottling: !1,
    },
  });

  _win.loadURL(`file://${page}`);
  applyPageWindowState(_win, page, windowState);

  // On Windows, immediately colour the overlay to match the page being loaded
  // so there is zero flash of the wrong colours.
  if (PLATFORM === 'win32') {
    const isSetup = page === Paths.SETUP_PAGE;
    const overlay = isSetup
      ? { color: '#f5f4f1', symbolColor: '#f5f4f1', height: 36 }
      : DEFAULT_WIN_OVERLAY;
    try {
      _win.setTitleBarOverlay(overlay);
    } catch {}
  }

  setImmediate(() => {
    attachWindowStatePersistence(_win);
  });

  _win.webContents.once('did-finish-load', () => {
    _win?.webContents.send('preload-pages', ['agents', 'events', 'skills']);
    // On Windows, hide the native caption overlay on the setup page.
    // The setup page is always light-themed, so the dark default overlay looks
    // jarring. We make it invisible by matching the page background colour.
    if (PLATFORM === 'win32' && page === Paths.SETUP_PAGE) {
      try {
        _win.setTitleBarOverlay({ color: '#f5f4f1', symbolColor: '#f5f4f1', height: 36 });
      } catch {}
    }
  });

  _win.webContents.setWindowOpenHandler(
    ({ url: url }) => (shell.openExternal(url), { action: 'deny' }),
  );

  _win.webContents.on('before-input-event', (event, input) => {
    if (app.isPackaged) {
      const isReload = (input.control || input.meta) && 'r' === input.key.toLowerCase(),
        isDevTools =
          (input.control || input.meta) && input.shift && 'i' === input.key.toLowerCase(),
        isF5 = 'F5' === input.key,
        isF12 = 'F12' === input.key;
      (isReload || isDevTools || isF5 || isF12) && event.preventDefault();
    }
  });

  return _win;
}

export function get() {
  return _win;
}

/** Called from WindowIPC when the renderer switches themes (Windows only). */
export function setTitleBarOverlay(options) {
  if (PLATFORM === 'win32' && _win && !_win.isDestroyed()) {
    try {
      _win.setTitleBarOverlay(options);
    } catch (err) {
      console.warn('[Window] setTitleBarOverlay failed:', err.message);
    }
  }
}

/** Exposed so the renderer can stamp data-platform on <html> for CSS. */
export function getPlatform() {
  return PLATFORM;
}

export function loadPage(page) {
  if (!_win) return;

  // Pages that are full HTML documents (loaded via URL, not SPA navigation)
  const isFullPageLoad =
    page === Paths.SETUP_PAGE || page === Paths.INDEX_PAGE || page === Paths.LOCK_PAGE;

  if (isFullPageLoad) {
    const windowState = loadWindowState();

    if (PLATFORM === 'win32') {
      // Setup and Lock pages use a light-ish background; make the overlay
      // invisible until the page applies its own theme.
      const useLightOverlay = page === Paths.SETUP_PAGE || page === Paths.LOCK_PAGE;
      try {
        _win.setTitleBarOverlay(
          useLightOverlay
            ? { color: '#1a1a1a', symbolColor: '#606060', height: 36 }
            : DEFAULT_WIN_OVERLAY,
        );
      } catch {}
    }

    _win.loadURL(`file://${page}`);
    applyPageWindowState(_win, page, windowState);
    return;
  }

  const pageKey = (function (filePath) {
    if (!filePath) return null;
    for (const key in PAGE_MAP) if (filePath.includes(key)) return PAGE_MAP[key];
    return null;
  })(page);
  pageKey && _win.webContents.send('navigate', pageKey);
}

const PAGE_MAP = {
  Agents: 'agents',
  Events: 'events',
  Skills: 'skills',
  Personas: 'personas',
  Usage: 'usage',
  Chat: 'chat',
};
