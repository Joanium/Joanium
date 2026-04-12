import { ipcMain } from 'electron';
import { MCPRegistry } from '../Core/MCPClient.js';
import Paths from '../../../Main/Core/Paths.js';
import { loadJson, persistJson } from '../../../Main/Core/FileSystem.js';
const registry = new MCPRegistry(),
  BUILTIN_SERVER_IDS = new Set(['builtin_browser']),
  BUILTIN_SERVERS = [
    {
      id: 'builtin_browser',
      name: 'Built-in Browser',
      transport: 'builtin',
      builtinType: 'browser',
      enabled: !0,
      builtin: !0,
      locked: !0,
      description:
        'Ready out of the box. Gives chat a built-in browser MCP for live website control.',
    },
  ];
function loadServerConfigs() {
  const data = loadJson(Paths.MCP_FILE, { servers: [] });
  return (function (configs = []) {
    const byId = new Map(configs.map((cfg) => [cfg.id, cfg]));
    return [
      ...BUILTIN_SERVERS.map((server) => ({
        ...server,
        ...(byId.get(server.id) ?? {}),
        builtin: !0,
        locked: !0,
      })),
      ...configs.filter((cfg) => !BUILTIN_SERVER_IDS.has(cfg.id)),
    ];
  })(Array.isArray(data?.servers) ? data.servers : []);
}
function saveServerConfigs(configs) {
  const persisted = configs.filter((cfg) => !BUILTIN_SERVER_IDS.has(cfg.id));
  persistJson(Paths.MCP_FILE, { servers: persisted });
}
export async function autoConnect() {
  const configs = loadServerConfigs();
  for (const cfg of configs)
    if (cfg.enabled)
      try {
        await registry.connect(cfg);
      } catch (err) {
        console.warn(`[MCPIPC] Auto-connect failed for "${cfg.name}":`, err.message);
      }
}
export const ipcMeta = { needs: [] };
export function register() {
  (ipcMain.handle('mcp-list-servers', () => {
    const configs = loadServerConfigs(),
      statuses = registry.getAll();
    return configs.map((cfg) => ({
      ...cfg,
      connected: registry.isConnected(cfg.id),
      toolCount: statuses.find((s) => s.id === cfg.id)?.toolCount ?? 0,
    }));
  }),
    ipcMain.handle('mcp-save-server', (_e, serverConfig) => {
      if (BUILTIN_SERVER_IDS.has(serverConfig.id))
        return { ok: !1, error: 'Built-in MCP servers cannot be edited from this form.' };
      const configs = loadServerConfigs(),
        idx = configs.findIndex((c) => c.id === serverConfig.id);
      return (
        idx >= 0
          ? (configs[idx] = { ...configs[idx], ...serverConfig })
          : configs.push(serverConfig),
        saveServerConfigs(configs),
        { ok: !0 }
      );
    }),
    ipcMain.handle('mcp-remove-server', async (_e, serverId) =>
      BUILTIN_SERVER_IDS.has(serverId)
        ? { ok: !1, error: 'The built-in browser MCP cannot be removed.' }
        : (await registry.disconnect(serverId),
          saveServerConfigs(loadServerConfigs().filter((c) => c.id !== serverId)),
          { ok: !0 }),
    ),
    ipcMain.handle('mcp-connect-server', async (_e, serverId) => {
      const cfg = loadServerConfigs().find((c) => c.id === serverId);
      if (!cfg) return { ok: !1, error: 'Server not found' };
      try {
        const { tools: tools, name: name } = await registry.connect(cfg);
        return { ok: !0, tools: tools, name: name };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('mcp-disconnect-server', async (_e, serverId) => {
      try {
        return (await registry.disconnect(serverId), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('mcp-get-tools', () => {
      try {
        return { ok: !0, tools: registry.getAllTools() };
      } catch (err) {
        return { ok: !1, tools: [], error: err.message };
      }
    }),
    ipcMain.handle('mcp-call-tool', async (_e, { toolName: toolName, args: args }) => {
      try {
        return { ok: !0, result: await registry.callTool(toolName, args ?? {}) };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }));
}
