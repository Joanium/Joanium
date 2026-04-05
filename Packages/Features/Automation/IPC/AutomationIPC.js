import { ipcMain } from 'electron';
/**
 * @param {AutomationEngine} automationEngine
 */
export const ipcMeta = { needs: ['automationEngine'] };
export function register(automationEngine) {
  ipcMain.handle('launch-automations', (event) => {
    event.sender.send('navigate', 'automations');
    return { ok: true };
  });

  ipcMain.handle('get-automations', () => {
    try {
      return { ok: true, automations: automationEngine.getAll() };
    } catch (err) {
      return { ok: false, error: err.message, automations: [] };
    }
  });

  ipcMain.handle('save-automation', (_e, automation) => {
    try {
      const saved = automationEngine.saveAutomation(automation);
      automationEngine.reload();
      return { ok: true, automation: saved };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('delete-automation', (_e, id) => {
    try {
      automationEngine.deleteAutomation(id);
      automationEngine.reload();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('toggle-automation', (_e, id, enabled) => {
    try {
      automationEngine.toggleAutomation(id, enabled);
      automationEngine.reload();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('run-automation-now', async (_e, automationId) => {
    try {
      await automationEngine.runNow(automationId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}
