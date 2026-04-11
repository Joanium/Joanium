import { BrowserWindow, shell, app } from 'electron';
import Paths from './Paths.js';
import { attachWindowStatePersistence, loadWindowState } from '../Services/WindowStateService.js';

/** @type {BrowserWindow | null} */
let _win = null;

function applyPageWindowState(win, page, windowState = loadWindowState()) {
  if (!win) return;

  if (page === Paths.SETUP_PAGE) {
    if (win.isFullScreen()) win.setFullScreen(false);
    win.maximize();
    return;
  }

  if (windowState.isFullScreen) {
    win.setFullScreen(true);
    return;
  }

  if (win.isFullScreen()) win.setFullScreen(false);

  if (windowState.isMaximized) {
    win.maximize();
    return;
  }

  if (win.isMaximized()) win.unmaximize();
  if (windowState.bounds) {
    win.setBounds(windowState.bounds);
  }
}

/**
 * Improve performance at app level (call this once in your main entry file ideally)
 */
export function optimizeApp() {
  // Enable better caching & performance
  app.commandLine.appendSwitch('enable-features', 'BackForwardCache');
}

/**
 * Create the main BrowserWindow and load the given HTML page.
 * @param {string} page  Absolute path to the HTML file.
 * @returns {BrowserWindow}
 */
export function create(page) {
  const windowState = loadWindowState();

  _win = new BrowserWindow({
    width: windowState.bounds.width,
    height: windowState.bounds.height,
    x: windowState.bounds.x,
    y: windowState.bounds.y,
    minWidth: 1100,
    minHeight: 720,

    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#ffffff',

    // 🚀 Show immediately for faster perceived load
    show: true,

    webPreferences: {
      preload: Paths.PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,

      // 🚀 Better UX performance
      backgroundThrottling: false,
    },
  });

  // 🚀 Faster than loadFile
  _win.loadURL(`file://${page}`);

  // Apply saved window state immediately
  applyPageWindowState(_win, page, windowState);

  // 🚀 Defer non-critical work
  setImmediate(() => {
    attachWindowStatePersistence(_win);
  });

  // 🚀 Preload important SPA routes after first paint
  _win.webContents.once('did-finish-load', () => {
    _win?.webContents.send('preload-pages', ['automations', 'agents', 'events', 'skills']);
  });

  // Open all external links in default browser
  _win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Restrict developer shortcuts in the final app (packaged mode)
  _win.webContents.on('before-input-event', (event, input) => {
    if (app.isPackaged) {
      const isReload = (input.control || input.meta) && input.key.toLowerCase() === 'r';
      const isDevTools =
        (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i';
      const isF5 = input.key === 'F5';
      const isF12 = input.key === 'F12';

      if (isReload || isDevTools || isF5 || isF12) {
        event.preventDefault();
      }
    }
  });

  return _win;
}

/** Return the current window instance (may be null before create()). */
export function get() {
  return _win;
}

/**
 * Navigate the existing window.
 * Setup + shell pages still load real HTML files.
 * All other app pages route inside the SPA renderer.
 */
export function loadPage(page) {
  if (!_win) return;

  if (page === Paths.SETUP_PAGE || page === Paths.INDEX_PAGE) {
    const windowState = loadWindowState();
    _win.loadURL(`file://${page}`);
    applyPageWindowState(_win, page, windowState);
    return;
  }

  const pageKey = resolvePageKey(page);
  if (pageKey) {
    _win.webContents.send('navigate', pageKey);
  }
}

/**
 * 🚀 Optimized page resolver (faster + cleaner)
 */
const PAGE_MAP = {
  Automations: 'automations',
  Agents: 'agents',
  Events: 'events',
  Skills: 'skills',
  Personas: 'personas',
  Usage: 'usage',
  Chat: 'chat',
};

function resolvePageKey(filePath) {
  if (!filePath) return null;

  for (const key in PAGE_MAP) {
    if (filePath.includes(key)) {
      return PAGE_MAP[key];
    }
  }

  return null;
}
