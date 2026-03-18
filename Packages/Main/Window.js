// ─────────────────────────────────────────────
//  openworld — Packages/Main/Window.js
//  Creates and exposes the single BrowserWindow.
//  All other modules call get() / loadPage() instead
//  of holding a direct reference to the window.
// ─────────────────────────────────────────────

import { BrowserWindow, shell } from 'electron';
import Paths from './Paths.js';

/** @type {BrowserWindow | null} */
let _win = null;

/**
 * Create the main BrowserWindow and load the given HTML page.
 * @param {string} page  Absolute path to the HTML file.
 * @returns {BrowserWindow}
 */
export function create(page) {
  _win = new BrowserWindow({
    width:    1100,
    height:   720,
    minWidth: 1100,
    minHeight: 720,
    frame:           false,
    titleBarStyle:   'hidden',
    backgroundColor: '#1a1a1a',
    show: false,
    webPreferences: {
      preload:          Paths.PRELOAD,
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });

  _win.loadFile(page);
  _win.once('ready-to-show', () => _win.show());

  // Open all target="_blank" links in the OS default browser
  _win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return _win;
}

/** Return the current window instance (may be null before create()). */
export function get() { return _win; }

/** Navigate the existing window to a different HTML page. */
export function loadPage(page) { _win?.loadFile(page); }
