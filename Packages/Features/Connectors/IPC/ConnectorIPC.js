import { ipcMain } from 'electron';
import * as GithubAPI from '../../../Capabilities/Github/Core/api/GithubAPI.js';
import { getFreshCreds } from '../../../Capabilities/Google/GoogleWorkspace.js';
import { invalidate as invalidateSysPrompt } from '../../../Main/Services/SystemPromptService.js';

export const ipcMeta = { needs: ['connectorEngine', 'featureRegistry'] };
export function register(connectorEngine, featureRegistry = null) {
  ipcMain.handle('get-connectors', () => {
    try { return connectorEngine.getAll(); }
    catch (err) { console.error('[ConnectorIPC] get-connectors error:', err); return {}; }
  });

  ipcMain.handle('save-connector', (_event, name, credentials) => {
    try {
      const result = connectorEngine.saveConnector(name, credentials);
      invalidateSysPrompt();
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('remove-connector', (_event, name) => {
    try {
      connectorEngine.removeConnector(name);
      invalidateSysPrompt();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('validate-connector', async (_event, name) => {
    try {
      const featureResult = await featureRegistry?.validateConnector?.(name, { connectorEngine, invalidateSystemPrompt: invalidateSysPrompt });
      if (featureResult) return featureResult;

      const creds = connectorEngine.getCredentials(name);
      if (!creds) return { ok: false, error: 'No credentials stored' };

      if (name === 'google') {
        const fresh = await getFreshCreds(creds);
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${fresh.accessToken}` },
        });
        if (!response.ok) throw new Error(`Token validation failed (${response.status})`);
        const profile = await response.json();
        connectorEngine.updateCredentials('google', { email: profile.email });
        return { ok: true, email: profile.email };
      }

      if (name === 'github') {
        const user = await GithubAPI.getUser(creds);
        connectorEngine.updateCredentials('github', { username: user.login });
        return { ok: true, username: user.login, avatar: user.avatar_url };
      }

      return { ok: false, error: 'Unknown connector' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('get-connector-safe-creds', (_event, name) => {
    try {
      const safe = connectorEngine.getSafeCredentials(name);
      return safe ? { ok: true, ...safe } : { ok: false, error: 'Not connected' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('get-free-connector-config', (_event, name) => {
    try {
      const config = connectorEngine.getFreeConnectorConfig(name);
      return config ?? { ok: false, error: 'Connector not found' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('toggle-free-connector', (_event, name, enabled) => {
    try {
      connectorEngine.toggleFreeConnector(name, enabled);
      invalidateSysPrompt();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('save-free-connector-key', (_event, name, apiKey) => {
    try {
      connectorEngine.saveFreeConnectorKey(name, apiKey);
      invalidateSysPrompt();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}
