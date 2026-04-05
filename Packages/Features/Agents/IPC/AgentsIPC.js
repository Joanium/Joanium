import { ipcMain } from 'electron';
export const ipcMeta = { needs: ['agentsEngine', 'automationEngine'] };
export function register(agentsEngine, automationEngine = null) {
  ipcMain.handle('launch-agents', (event) => {
    event.sender.send('navigate', 'agents');
    return { ok: true };
  });

  ipcMain.handle('launch-events', (event) => {
    event.sender.send('navigate', 'events');
    return { ok: true };
  });

  ipcMain.handle('get-agents', () => {
    try {
      agentsEngine.reload();
      return { ok: true, agents: agentsEngine.getAll() };
    } catch (err) {
      return { ok: false, error: err.message, agents: [] };
    }
  });

  ipcMain.handle('get-running-jobs', () => {
    try {
      return {
        ok: true,
        running: [
          ...(automationEngine?.getRunning?.() ?? []),
          ...(agentsEngine?.getRunning?.() ?? []),
        ],
      };
    } catch (err) {
      return { ok: false, error: err.message, running: [] };
    }
  });

  /**
   * Wipe all job history + lastRun from Agents.json,
   * and clear lastRun from Automations.json.
   * This is what the Events page "Clear" button calls.
   */
  ipcMain.handle('clear-events-history', async () => {
    try {
      // 1 — Clear agent job history
      agentsEngine.clearAllHistory();

      // 2 — Clear automation history
      if (automationEngine) {
        automationEngine.clearAllHistory();
      }

      return { ok: true };
    } catch (err) {
      console.error('[AgentsIPC] clear-events-history error:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('save-agent', (_e, agent) => {
    try {
      const saved = agentsEngine.saveAgent(agent);
      return { ok: true, agent: saved };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('delete-agent', (_e, id) => {
    try {
      agentsEngine.deleteAgent(id);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('toggle-agent', (_e, id, enabled) => {
    try {
      agentsEngine.toggleAgent(id, enabled);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('run-agent-now', async (_e, agentId) => {
    try {
      await agentsEngine.runNow(agentId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('complete-agent-run', (_e, payload) => {
    try {
      agentsEngine.resolveRun(payload?.requestId, payload);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}
