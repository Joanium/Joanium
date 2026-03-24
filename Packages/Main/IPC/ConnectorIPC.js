// ─────────────────────────────────────────────
//  Romelson — Packages/Main/IPC/ConnectorIPC.js
//  Handlers for saving, removing, and validating connector credentials.
//  Also handles free API connector toggle and key management.
// ─────────────────────────────────────────────

import { ipcMain } from 'electron';
import * as GmailAPI  from '../../Automation/Gmail.js';
import * as GithubAPI from '../../Automation/Github.js';
import { invalidate as invalidateSysPrompt } from '../Services/SystemPromptService.js';

/**
 * @param {ConnectorEngine} connectorEngine
 */
export function register(connectorEngine) {

  /* ── Get all connectors (status only, no credentials) ── */
  ipcMain.handle('get-connectors', () => {
    try   { return connectorEngine.getAll(); }
    catch (err) { console.error('[ConnectorIPC] get-connectors error:', err); return {}; }
  });

  /* ── Service connector: save credentials ── */
  ipcMain.handle('save-connector', (_e, name, credentials) => {
    try {
      const result = connectorEngine.saveConnector(name, credentials);
      invalidateSysPrompt();
      return { ok: true, ...result };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  /* ── Service connector: remove / disconnect ── */
  ipcMain.handle('remove-connector', (_e, name) => {
    try {
      connectorEngine.removeConnector(name);
      invalidateSysPrompt();
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  /* ── Service connector: validate credentials ── */
  ipcMain.handle('validate-connector', async (_e, name) => {
    try {
      const creds = connectorEngine.getCredentials(name);
      if (!creds) return { ok: false, error: 'No credentials stored' };

      if (name === 'gmail') {
        const email = await GmailAPI.validateCredentials(creds);
        connectorEngine.updateCredentials('gmail', { email });
        return { ok: true, email };
      }

      if (name === 'github') {
        const user = await GithubAPI.getUser(creds);
        connectorEngine.updateCredentials('github', { username: user.login });
        return { ok: true, username: user.login, avatar: user.avatar_url };
      }

      return { ok: false, error: 'Unknown connector' };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  /* ── Free API connector: get config (enabled status + optional key) ── */
  ipcMain.handle('get-free-connector-config', (_e, name) => {
    try {
      const config = connectorEngine.getFreeConnectorConfig(name);
      return config ?? { ok: false, error: 'Connector not found' };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  /* ── Free API connector: toggle on/off ── */
  ipcMain.handle('toggle-free-connector', (_e, name, enabled) => {
    try {
      connectorEngine.toggleFreeConnector(name, enabled);
      invalidateSysPrompt();
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  /* ── Free API connector: save optional API key ── */
  ipcMain.handle('save-free-connector-key', (_e, name, apiKey) => {
    try {
      connectorEngine.saveFreeConnectorKey(name, apiKey);
      invalidateSysPrompt();
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  });
}
