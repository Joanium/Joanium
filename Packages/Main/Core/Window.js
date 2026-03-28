import { BrowserWindow, shell } from 'electron';
import Paths from './Paths.js';
import {
  attachWindowStatePersistence,
  loadWindowState,
} from '../Services/WindowStateService.js';

/** @type {BrowserWindow | null} */
let _win = null;

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
    backgroundColor: 'white',
    show: false,
    webPreferences: {
      preload: Paths.PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: true, // throttle timers/intervals when window is hidden → saves memory & CPU
    },
  });

  attachWindowStatePersistence(_win);
  _win.loadFile(page);
  _win.once('ready-to-show', () => {
    if (windowState.isFullScreen) {
      _win.setFullScreen(true);
    } else if (windowState.isMaximized) {
      _win.maximize();
    }
    _win.show();
  });

  // Open all target="_blank" links in the OS default browser
  _win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return _win;
}

/** Return the current window instance (may be null before create()). */
export function get() { return _win; }

/**
 * Navigate the existing window.
 * Setup + shell pages still load real HTML files.
 * All other app pages route inside the SPA renderer.
 */
export function loadPage(page) {
  if (page === Paths.SETUP_PAGE || page === Paths.INDEX_PAGE) {
    _win?.loadFile(page);
    return;
  }

  const pageKey = resolvePageKey(page);
  if (pageKey) _win?.webContents.send('navigate', pageKey);
}

function resolvePageKey(filePath) {
  if (filePath?.includes('Automations')) return 'automations';
  if (filePath?.includes('Agents')) return 'agents';
  if (filePath?.includes('Events')) return 'events';
  if (filePath?.includes('Skills')) return 'skills';
  if (filePath?.includes('Personas')) return 'personas';
  if (filePath?.includes('Usage')) return 'usage';
  if (filePath?.includes('Chat')) return 'chat';
  return null;
}
