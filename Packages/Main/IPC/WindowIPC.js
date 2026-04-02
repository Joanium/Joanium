import { ipcMain } from 'electron';
import { get as getWin } from '../Core/Window.js';

export const ipcMeta = { needs: [] };
export function register() {
  ipcMain.on('window-minimize', () => getWin()?.minimize());

  ipcMain.on('window-maximize', () => {
    const win = getWin();
    win?.isMaximized() ? win.unmaximize() : win.maximize();
  });

  ipcMain.on('window-close', () => getWin()?.close());
}
