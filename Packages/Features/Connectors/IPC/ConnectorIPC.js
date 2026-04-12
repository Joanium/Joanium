import { ipcMain } from 'electron';
export const ipcMeta = { needs: ['connectorEngine', 'featureRegistry', 'systemPromptService'] };
export function register(connectorEngine, featureRegistry = null, systemPromptService = null) {
  const invalidateSysPrompt = () => systemPromptService?.invalidate?.();
  (ipcMain.handle('get-connectors', () => {
    try {
      return connectorEngine.getAll();
    } catch (err) {
      return (console.error('[ConnectorIPC] get-connectors error:', err), {});
    }
  }),
    ipcMain.handle('save-connector', (_event, name, credentials) => {
      try {
        const result = connectorEngine.saveConnector(name, credentials);
        return (invalidateSysPrompt(), { ok: !0, ...result });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('remove-connector', (_event, name) => {
      try {
        return (connectorEngine.removeConnector(name), invalidateSysPrompt(), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('validate-connector', async (_event, name) => {
      try {
        return (
          (await featureRegistry?.validateConnector?.(name, {
            connectorEngine: connectorEngine,
            invalidateSystemPrompt: invalidateSysPrompt,
          })) ||
          (connectorEngine.getCredentials(name)
            ? { ok: !1, error: 'No validation handler registered for this connector' }
            : { ok: !1, error: 'No credentials stored' })
        );
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('get-connector-safe-creds', (_event, name) => {
      try {
        const safe = connectorEngine.getSafeCredentials(name);
        return safe ? { ok: !0, ...safe } : { ok: !1, error: 'Not connected' };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('get-free-connector-config', (_event, name) => {
      try {
        return (
          connectorEngine.getFreeConnectorConfig(name) ?? { ok: !1, error: 'Connector not found' }
        );
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('toggle-free-connector', (_event, name, enabled) => {
      try {
        return (
          connectorEngine.toggleFreeConnector(name, enabled),
          invalidateSysPrompt(),
          { ok: !0 }
        );
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('save-free-connector-key', (_event, name, apiKey) => {
      try {
        return (
          connectorEngine.saveFreeConnectorKey(name, apiKey),
          invalidateSysPrompt(),
          { ok: !0 }
        );
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }));
}
