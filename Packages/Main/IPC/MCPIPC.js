import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { MCPRegistry } from '../../Features/MCP/Core/MCPClient.js';
import Paths from '../Core/Paths.js';

/* ── Singleton registry ── */
const registry = new MCPRegistry();
const BUILTIN_SERVER_IDS = new Set(['builtin_browser']);
const BUILTIN_SERVERS = [
  {
    id: 'builtin_browser',
    name: 'Built-in Browser',
    transport: 'builtin',
    builtinType: 'browser',
    enabled: true,
    builtin: true,
    locked: true,
    description: 'Ready out of the box. Gives chat a built-in browser MCP for live website control.',
  },
];

function mergeBuiltinServers(configs = []) {
  const byId = new Map(configs.map(cfg => [cfg.id, cfg]));
  const merged = BUILTIN_SERVERS.map(server => ({
    ...server,
    ...(byId.get(server.id) ?? {}),
    builtin: true,
    locked: true,
  }));

  const customServers = configs.filter(cfg => !BUILTIN_SERVER_IDS.has(cfg.id));
  return [...merged, ...customServers];
}

/* ── Persist server configs to Data/MCPServers.json ── */
function loadServerConfigs() {
  try {
    if (fs.existsSync(Paths.MCP_FILE)) {
      const data = JSON.parse(fs.readFileSync(Paths.MCP_FILE, 'utf-8'));
      return mergeBuiltinServers(Array.isArray(data.servers) ? data.servers : []);
    }
  } catch { /* fall through */ }
  return mergeBuiltinServers([]);
}

function saveServerConfigs(configs) {
  const dir = path.dirname(Paths.MCP_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const persisted = configs.filter(cfg => !BUILTIN_SERVER_IDS.has(cfg.id));
  fs.writeFileSync(Paths.MCP_FILE, JSON.stringify({ servers: persisted }, null, 2), 'utf-8');
}

/* ── Auto-connect persisted servers on startup ── */
export async function autoConnect() {
  const configs = loadServerConfigs();
  for (const cfg of configs) {
    if (!cfg.enabled) continue;
    try {
      await registry.connect(cfg);
    } catch (err) {
      console.warn(`[MCPIPC] Auto-connect failed for "${cfg.name}":`, err.message);
    }
  }
}

/* ── IPC Registration ── */
export function register() {

  /* List all configured servers + connection status */
  ipcMain.handle('mcp-list-servers', () => {
    const configs = loadServerConfigs();
    const statuses = registry.getAll();
    return configs.map(cfg => ({
      ...cfg,
      connected: registry.isConnected(cfg.id),
      toolCount: statuses.find(s => s.id === cfg.id)?.toolCount ?? 0,
    }));
  });

  /* Add or update a server config (does not connect) */
  ipcMain.handle('mcp-save-server', (_e, serverConfig) => {
    if (BUILTIN_SERVER_IDS.has(serverConfig.id)) {
      return { ok: false, error: 'Built-in MCP servers cannot be edited from this form.' };
    }

    const configs = loadServerConfigs();
    const idx = configs.findIndex(c => c.id === serverConfig.id);
    if (idx >= 0) configs[idx] = { ...configs[idx], ...serverConfig };
    else configs.push(serverConfig);
    saveServerConfigs(configs);
    return { ok: true };
  });

  /* Remove a server config + disconnect */
  ipcMain.handle('mcp-remove-server', async (_e, serverId) => {
    if (BUILTIN_SERVER_IDS.has(serverId)) {
      return { ok: false, error: 'The built-in browser MCP cannot be removed.' };
    }

    await registry.disconnect(serverId);
    const configs = loadServerConfigs().filter(c => c.id !== serverId);
    saveServerConfigs(configs);
    return { ok: true };
  });

  /* Connect a server by id */
  ipcMain.handle('mcp-connect-server', async (_e, serverId) => {
    const cfg = loadServerConfigs().find(c => c.id === serverId);
    if (!cfg) return { ok: false, error: 'Server not found' };
    try {
      const { tools, name } = await registry.connect(cfg);
      return { ok: true, tools, name };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* Disconnect a server */
  ipcMain.handle('mcp-disconnect-server', async (_e, serverId) => {
    try {
      await registry.disconnect(serverId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* Get all tools from all connected servers */
  ipcMain.handle('mcp-get-tools', () => {
    try {
      return { ok: true, tools: registry.getAllTools() };
    } catch (err) {
      return { ok: false, tools: [], error: err.message };
    }
  });

  /* Call an MCP tool */
  ipcMain.handle('mcp-call-tool', async (_e, { toolName, args }) => {
    try {
      const result = await registry.callTool(toolName, args ?? {});
      return { ok: true, result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}
