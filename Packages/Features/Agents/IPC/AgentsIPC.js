import { ipcMain } from 'electron';
export const ipcMeta = { needs: ['agentsEngine', 'automationEngine'] };
export function register(agentsEngine, automationEngine = null) {
  (ipcMain.handle(
    'launch-agents',
    (event) => (event.sender.send('navigate', 'agents'), { ok: !0 }),
  ),
    ipcMain.handle(
      'launch-events',
      (event) => (event.sender.send('navigate', 'events'), { ok: !0 }),
    ),
    ipcMain.handle('get-agents', () => {
      try {
        return (agentsEngine.reload(), { ok: !0, agents: agentsEngine.getAll() });
      } catch (err) {
        return { ok: !1, error: err.message, agents: [] };
      }
    }),
    ipcMain.handle('get-running-jobs', () => {
      try {
        return {
          ok: !0,
          running: [
            ...(automationEngine?.getRunning?.() ?? []),
            ...(agentsEngine?.getRunning?.() ?? []),
          ],
        };
      } catch (err) {
        return { ok: !1, error: err.message, running: [] };
      }
    }),
    ipcMain.handle('clear-events-history', async () => {
      try {
        return (
          agentsEngine.clearAllHistory(),
          automationEngine && automationEngine.clearAllHistory(),
          { ok: !0 }
        );
      } catch (err) {
        return (
          console.error('[AgentsIPC] clear-events-history error:', err),
          { ok: !1, error: err.message }
        );
      }
    }),
    ipcMain.handle('save-agent', (_e, agent) => {
      try {
        return { ok: !0, agent: agentsEngine.saveAgent(agent) };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('delete-agent', (_e, id) => {
      try {
        return (agentsEngine.deleteAgent(id), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('toggle-agent', (_e, id, enabled) => {
      try {
        return (agentsEngine.toggleAgent(id, enabled), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('run-agent-now', async (_e, agentId) => {
      try {
        return (await agentsEngine.runNow(agentId), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('complete-agent-run', (_e, payload) => {
      try {
        return (agentsEngine.resolveRun(payload?.requestId, payload), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }));
}
