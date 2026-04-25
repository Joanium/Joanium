import { ipcMain } from 'electron';
import { wrapHandler } from '../../../Main/IPC/IPCWrapper.js';
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
    ipcMain.handle(
      'save-connector',
      wrapHandler((name, credentials) => {
        const result = connectorEngine.saveConnector(name, credentials);
        return (invalidateSysPrompt(), result);
      }),
    ),
    ipcMain.handle(
      'remove-connector',
      wrapHandler((name) => {
        connectorEngine.removeConnector(name);
        invalidateSysPrompt();
      }),
    ),
    ipcMain.handle(
      'validate-connector',
      wrapHandler(async (name) => {
        return (
          (await featureRegistry?.validateConnector?.(name, {
            connectorEngine: connectorEngine,
            invalidateSystemPrompt: invalidateSysPrompt,
          })) ||
          (connectorEngine.getCredentials(name)
            ? { ok: !1, error: 'No validation handler registered for this connector' }
            : { ok: !1, error: 'No credentials stored' })
        );
      }),
    ),
    ipcMain.handle(
      'get-connector-safe-creds',
      wrapHandler((name) => {
        const safe = connectorEngine.getSafeCredentials(name);
        return safe ? { ok: !0, ...safe } : { ok: !1, error: 'Not connected' };
      }),
    ),
    ipcMain.handle('get-free-connector-config', (_event, name) => {
      try {
        return (
          connectorEngine.getFreeConnectorConfig(name) ?? { ok: !1, error: 'Connector not found' }
        );
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle(
      'toggle-free-connector',
      wrapHandler((name, enabled) => {
        connectorEngine.toggleFreeConnector(name, enabled);
        invalidateSysPrompt();
      }),
    ),
    ipcMain.handle(
      'save-free-connector-key',
      wrapHandler((name, apiKey) => {
        connectorEngine.saveFreeConnectorKey(name, apiKey);
        invalidateSysPrompt();
      }),
    ));
}
