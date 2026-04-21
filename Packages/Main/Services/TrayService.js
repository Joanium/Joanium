import { Tray, Menu, app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..', '..');

/** Resolve the best tray icon for the current platform. */
function getTrayIconPath() {
  if (process.platform === 'win32') return path.join(ROOT, 'Assets', 'Logo', 'Logo.ico');
  if (process.platform === 'darwin') return path.join(ROOT, 'Assets', 'Logo', 'Logo.png');
  return path.join(ROOT, 'Assets', 'Logo', 'Logo.png');
}

let _tray = null;

/**
 * TrayService — wraps Electron's Tray API.
 *
 * enable(win)  — creates the system-tray icon and wires up the context menu.
 * disable()    — destroys the tray icon.
 * isActive()   — returns true if the tray is currently shown.
 */

export function enable(win) {
  if (_tray) return; // already active

  _tray = new Tray(getTrayIconPath());
  _tray.setToolTip('Joanium');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Joanium',
      click: () => {
        const target = win && !win.isDestroyed() ? win : BrowserWindow.getAllWindows()[0];
        if (target) {
          if (target.isMinimized()) target.restore();
          target.show();
          target.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        disable();
        app.quit();
      },
    },
  ]);

  _tray.setContextMenu(contextMenu);

  // Double-click on the tray icon shows the window (Windows / Linux).
  _tray.on('double-click', () => {
    const target = win && !win.isDestroyed() ? win : BrowserWindow.getAllWindows()[0];
    if (target) {
      if (target.isMinimized()) target.restore();
      target.show();
      target.focus();
    }
  });
}

export function disable() {
  if (_tray) {
    _tray.destroy();
    _tray = null;
  }
}

export function isActive() {
  return _tray !== null && !_tray.isDestroyed();
}
