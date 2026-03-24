// ─────────────────────────────────────────────
//  Romelson — Packages/Main/IPC/SystemIPC.js
//  Exposes the context-aware system prompt to the renderer.
// ─────────────────────────────────────────────

import { ipcMain } from 'electron';
import * as UserService         from '../Services/UserService.js';
import * as SystemPromptService from '../Services/SystemPromptService.js';
import Paths from '../Paths.js';

/**
 * @param {ConnectorEngine} connectorEngine
 */
export function register(connectorEngine) {
  ipcMain.handle('get-system-prompt', async () => {
    try {
      return await SystemPromptService.get({
        user:               UserService.readUser(),
        customInstructions: UserService.readText(Paths.CUSTOM_INSTRUCTIONS_FILE),
        memory:             UserService.readText(Paths.MEMORY_FILE),
        connectorEngine,
      });
    } catch (err) {
      console.error('[SystemIPC] build error:', err);
      return 'You are a helpful AI assistant.';
    }
  });
}
