import { ipcMain } from 'electron';
import * as UserService from '../Services/UserService.js';
import { loadPage } from '../Core/Window.js';
import Paths from '../Core/Paths.js';
import { wrapHandler } from './IPCWrapper.js';

export const ipcMeta = { needs: [] };
export function register() {
  ipcMain.handle('save-user', wrapHandler((userData) => {
    return { user: UserService.writeUser(userData) };
  }));

  ipcMain.handle('save-api-keys', wrapHandler((keysMap) => {
    return { user: UserService.saveApiKeys(keysMap) };
  }));

  ipcMain.handle('save-provider-configs', wrapHandler((configMap) => {
    return { user: UserService.saveProviderConfigurations(configMap) };
  }));

  // These handlers need the event object for sender.send(), so they use the raw pattern
  ipcMain.handle('launch-main', () => {
    loadPage(Paths.INDEX_PAGE);
    return { ok: true };
  });

  ipcMain.handle('launch-skills', (event) => {
    event.sender.send('navigate', 'skills');
    return { ok: true };
  });

  ipcMain.handle('launch-personas', (event) => {
    event.sender.send('navigate', 'personas');
    return { ok: true };
  });
}
