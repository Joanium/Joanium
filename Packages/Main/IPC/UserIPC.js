import { ipcMain } from 'electron';
import * as UserService from '../Services/UserService.js';
import { invalidate as invalidateSysPrompt } from '../Services/SystemPromptService.js';
import Paths from '../Core/Paths.js';
import { wrapHandler, wrapRead } from './IPCWrapper.js';

export const ipcMeta = { needs: [] };
export function register() {
  ipcMain.handle('get-user', wrapRead(() => UserService.readUser()));

  ipcMain.handle('get-models', wrapRead(() => UserService.readModelsWithKeys()));

  ipcMain.handle('get-api-key', wrapRead((providerId) =>
    UserService.readUser()?.api_keys?.[providerId] ?? null
  ));

  ipcMain.handle('save-user-profile', wrapHandler((profile) => {
    const updates = {};
    if (typeof profile?.name === 'string') updates.name = profile.name.trim();
    invalidateSysPrompt();
    return { user: UserService.writeUser(updates) };
  }));

  ipcMain.handle('get-custom-instructions', wrapRead(() =>
    UserService.readText(Paths.CUSTOM_INSTRUCTIONS_FILE)
  ));

  ipcMain.handle('save-custom-instructions', wrapHandler((content) => {
    UserService.writeText(
      Paths.CUSTOM_INSTRUCTIONS_FILE,
      String(content ?? '').replace(/\r\n/g, '\n'),
    );
    invalidateSysPrompt();
  }));

  ipcMain.handle('get-memory', wrapRead(() =>
    UserService.readText(Paths.MEMORY_FILE)
  ));

  ipcMain.handle('save-memory', wrapHandler((content) => {
    UserService.writeText(
      Paths.MEMORY_FILE,
      String(content ?? '').replace(/\r\n/g, '\n'),
    );
    invalidateSysPrompt();
  }));
}
