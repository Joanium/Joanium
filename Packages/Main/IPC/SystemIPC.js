import { ipcMain, app } from 'electron';
import * as UserService from '../Services/UserService.js';
import * as SystemPromptService from '../Services/SystemPromptService.js';
import Paths from '../Core/Paths.js';
export const ipcMeta = { needs: ['connectorEngine', 'featureRegistry'] };
export function register(connectorEngine, featureRegistry = null) {
  (ipcMain.handle('get-app-version', () => app.getVersion()),
    ipcMain.handle('get-system-prompt', async () => {
      try {
        return await SystemPromptService.get({
          user: UserService.readUser(),
          customInstructions: UserService.readText(Paths.CUSTOM_INSTRUCTIONS_FILE),
          connectorEngine: connectorEngine,
          featureRegistry: featureRegistry,
        });
      } catch (err) {
        return (console.error('[SystemIPC] build error:', err), 'You are a helpful AI assistant.');
      }
    }));
}
