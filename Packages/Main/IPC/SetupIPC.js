import { ipcMain } from 'electron';
import * as UserService from '../Services/UserService.js';
import { loadPage } from '../Window.js';
import Paths from '../Paths.js';

export function register() {
  // Persist full user object written by the setup wizard
  ipcMain.handle('save-user', (_e, userData) => {
    try { return { ok: true, user: UserService.writeUser(userData) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  // Persist API keys collected during setup
  ipcMain.handle('save-api-keys', (_e, keysMap) => {
    try { return { ok: true, user: UserService.saveApiKeys(keysMap) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  // ── Page navigation ────────────────────────────────────────────────

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
