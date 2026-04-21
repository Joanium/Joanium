import { ipcMain } from 'electron';
import { get as getWin, setTitleBarOverlay, getPlatform } from '../Core/Window.js';

export const ipcMeta = { needs: [] };

export function register() {
  // Keep these around — they are still used by keyboard shortcuts and any
  // code paths that want to programmatically control the window.
  ipcMain.on('window-minimize', () => getWin()?.minimize());
  ipcMain.on('window-maximize', () => {
    const win = getWin();
    win?.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on('window-close', () => getWin()?.close());

  // Renderer sends this whenever the user picks a new theme so the native
  // Windows caption-button overlay stays colour-matched. No-op on macOS/Linux.
  ipcMain.on('window-set-titlebar-overlay', (_e, options) => {
    setTitleBarOverlay(options);
  });

  // Lets the renderer stamp data-platform on <html> so CSS can branch.
  ipcMain.handle('get-platform', () => getPlatform());
}
