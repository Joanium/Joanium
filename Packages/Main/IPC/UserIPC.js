// ─────────────────────────────────────────────
//  openworld — Packages/Main/IPC/UserIPC.js
//  Handlers for user profile, model list, API keys,
//  custom instructions, and memory.
// ─────────────────────────────────────────────

import { ipcMain } from 'electron';
import * as UserService from '../Services/UserService.js';
import { invalidate as invalidateSysPrompt } from '../Services/SystemPromptService.js';
import Paths from '../Paths.js';

export function register() {
  ipcMain.handle('get-user', () => UserService.readUser());

  ipcMain.handle('get-models', () => UserService.readModelsWithKeys());

  ipcMain.handle('get-api-key', (_e, providerId) =>
    UserService.readUser()?.api_keys?.[providerId] ?? null
  );

  ipcMain.handle('save-user-profile', (_e, profile) => {
    try {
      const updates = {};
      if (typeof profile?.name === 'string') updates.name = profile.name.trim();
      invalidateSysPrompt();
      return { ok: true, user: UserService.writeUser(updates) };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('get-custom-instructions', () =>
    UserService.readText(Paths.CUSTOM_INSTRUCTIONS_FILE)
  );

  ipcMain.handle('save-custom-instructions', (_e, content) => {
    try {
      UserService.writeText(
        Paths.CUSTOM_INSTRUCTIONS_FILE,
        String(content ?? '').replace(/\r\n/g, '\n'),
      );
      invalidateSysPrompt();
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('get-memory', () =>
    UserService.readText(Paths.MEMORY_FILE)
  );

  ipcMain.handle('save-memory', (_e, content) => {
    try {
      UserService.writeText(
        Paths.MEMORY_FILE,
        String(content ?? '').replace(/\r\n/g, '\n'),
      );
      invalidateSysPrompt();
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  });
}
