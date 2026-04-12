import { ipcMain } from 'electron';
export const ipcMeta = { needs: ['automationEngine'] };
export function register(automationEngine) {
  (ipcMain.handle(
    'launch-automations',
    (event) => (event.sender.send('navigate', 'automations'), { ok: !0 }),
  ),
    ipcMain.handle('get-automations', () => {
      try {
        return { ok: !0, automations: automationEngine.getAll() };
      } catch (err) {
        return { ok: !1, error: err.message, automations: [] };
      }
    }),
    ipcMain.handle('save-automation', (_e, automation) => {
      try {
        const saved = automationEngine.saveAutomation(automation);
        return (automationEngine.reload(), { ok: !0, automation: saved });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('delete-automation', (_e, id) => {
      try {
        return (automationEngine.deleteAutomation(id), automationEngine.reload(), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('toggle-automation', (_e, id, enabled) => {
      try {
        return (
          automationEngine.toggleAutomation(id, enabled),
          automationEngine.reload(),
          { ok: !0 }
        );
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('run-automation-now', async (_e, automationId) => {
      try {
        return (await automationEngine.runNow(automationId), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }));
}
