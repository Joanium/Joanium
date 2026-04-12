import { ipcMain } from 'electron';
import * as UserService from '../Services/UserService.js';
import { loadPage } from '../Core/Window.js';
import Paths from '../Core/Paths.js';
import { wrapHandler } from './IPCWrapper.js';
export const ipcMeta = { needs: [] };
export function register() {
  (ipcMain.handle(
    'save-user',
    wrapHandler((userData) => ({ user: UserService.writeUser(userData) })),
  ),
    ipcMain.handle(
      'save-api-keys',
      wrapHandler((keysMap) => ({ user: UserService.saveApiKeys(keysMap) })),
    ),
    ipcMain.handle(
      'save-provider-configs',
      wrapHandler((configMap) => ({ user: UserService.saveProviderConfigurations(configMap) })),
    ),
    ipcMain.handle('launch-main', () => (loadPage(Paths.INDEX_PAGE), { ok: !0 })),
    ipcMain.handle(
      'launch-skills',
      (event) => (event.sender.send('navigate', 'skills'), { ok: !0 }),
    ),
    ipcMain.handle(
      'launch-personas',
      (event) => (event.sender.send('navigate', 'personas'), { ok: !0 }),
    ));
}
