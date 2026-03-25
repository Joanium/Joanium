import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';

const PROTOCOL_VERSION = '2024-11-05';
const CLIENT_INFO = { name: 'Evelina', version: '0.1.0' };

/* ══════════════════════════════════════════
   BASE MCP SESSION
══════════════════════════════════════════ */
class MCPSession extends EventEmitter {
  constructor() {
    super();
    this._nextId = 1;
    this._pending = new Map(); // id → { resolve, reject }
  }

  _nextReqId() { return this._nextId++; }

  _dispatch(message) {
    if (message.id != null && this._pending.has(message.id)) {
      const { resolve, reject } = this._pending.get(message.id);
      this._pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message ?? JSON.stringify(message.error)));
      else resolve(message.result);
    } else if (message.method) {
      // Server-sent notification
      this.emit('notification', message);
    }
  }

  async _request(method, params = {}) {
    const id = this._nextReqId();
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this._send({ jsonrpc: '2.0', id, method, params });
    });
  }

  /* ── Public MCP methods ── */

  async initialize() {
    return this._request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {}, resources: {} },
      clientInfo: CLIENT_INFO,
    });
  }

  async listTools() {
    const res = await this._request('tools/list', {});
    return res?.tools ?? [];
  }

  async callTool(name, args = {}) {
    return this._request('tools/call', { name, arguments: args });
  }

  async listResources() {
    const res = await this._request('resources/list', {});
    return res?.resources ?? [];
  }

  async readResource(uri) {
    return this._request('resources/read', { uri });
  }

  // Subclasses implement _send and must call _dispatch on incoming messages
  _send(_msg) { throw new Error('_send() not implemented'); }
  async close() { /* override */ }
}

/* ══════════════════════════════════════════
   STDIO TRANSPORT
   Spawns a local process and communicates
   via JSON-RPC lines on stdin/stdout.
══════════════════════════════════════════ */
export class StdioMCPSession extends MCPSession {
  constructor({ command, args = [], env = {} }) {
    super();
    this._proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      shell: process.platform === 'win32',
    });

    const rl = createInterface({ input: this._proc.stdout });
    rl.on('line', line => {
      if (!line.trim()) return;
      try {
        this._dispatch(JSON.parse(line));
      } catch { /* ignore non-JSON */ }
    });

    this._proc.stderr?.on('data', d =>
      this.emit('stderr', d.toString()),
    );

    this._proc.on('exit', code =>
      this.emit('close', code),
    );
  }

  _send(msg) {
    this._proc.stdin?.write(JSON.stringify(msg) + '\n');
  }

  async close() {
    this._proc.stdin?.end();
    return new Promise(resolve =>
      this._proc.on('exit', resolve),
    );
  }
}

/* ══════════════════════════════════════════
   HTTP TRANSPORT
   Uses streamable HTTP (POST requests).
   Compatible with the MCP HTTP transport spec.
══════════════════════════════════════════ */
export class HttpMCPSession extends MCPSession {
  constructor({ url }) {
    super();
    this._url = url.endsWith('/') ? url.slice(0, -1) : url;
  }

  _send(_msg) {
    // HTTP transport sends each request independently — see _request override
  }

  async _request(method, params = {}) {
    const id = this._nextReqId();
    const res = await fetch(`${this._url}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    });
    if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${await res.text().catch(() => '')}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
    return data.result;
  }
}

/* ══════════════════════════════════════════
   MCP SERVER REGISTRY
   Manages a pool of named MCP sessions.
══════════════════════════════════════════ */
export class MCPRegistry {
  constructor() {
    /** @type {Map<string, { session: MCPSession, tools: object[], meta: object }>} */
    this._servers = new Map();
  }

  /** Connect a server and discover its tools. */
  async connect(serverConfig) {
    const { id, name, transport, url, command, args, env } = serverConfig;

    let session;
    if (transport === 'http') {
      session = new HttpMCPSession({ url });
    } else if (transport === 'stdio') {
      session = new StdioMCPSession({ command, args: args ?? [], env: env ?? {} });
    } else {
      throw new Error(`Unknown MCP transport: "${transport}"`);
    }

    // Initialize handshake
    try {
      await session.initialize();
    } catch (err) {
      // Some servers don't respond to initialize — tolerate
      console.warn(`[MCP] initialize() failed for "${name}":`, err.message);
    }

    const tools = await session.listTools().catch(() => []);

    const entry = { session, tools, meta: { id, name, transport } };
    this._servers.set(id, entry);

    console.log(`[MCP] Connected "${name}" — ${tools.length} tool(s)`);
    return { tools, name };
  }

  /** Disconnect a server cleanly. */
  async disconnect(serverId) {
    const entry = this._servers.get(serverId);
    if (!entry) return;
    await entry.session.close().catch(() => { });
    this._servers.delete(serverId);
    console.log(`[MCP] Disconnected "${entry.meta.name}"`);
  }

  /** List all tools across all connected servers. */
  getAllTools() {
    const result = [];
    for (const [id, { tools, meta }] of this._servers) {
      for (const tool of tools) {
        result.push({ ...tool, _mcpServerId: id, _mcpServerName: meta.name });
      }
    }
    return result;
  }

  /** Call a tool on the appropriate server. */
  async callTool(toolName, args = {}) {
    for (const [, { session, tools }] of this._servers) {
      if (tools.some(t => t.name === toolName)) {
        const result = await session.callTool(toolName, args);
        // MCP tool results: { content: [{ type, text }] }
        if (Array.isArray(result?.content)) {
          return result.content
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('\n');
        }
        return JSON.stringify(result);
      }
    }
    throw new Error(`Tool "${toolName}" not found in any connected MCP server.`);
  }

  getServer(id) { return this._servers.get(id); }
  getAll() { return [...this._servers.values()].map(e => ({ ...e.meta, toolCount: e.tools.length })); }
  isConnected(id) { return this._servers.has(id); }

  async disconnectAll() {
    for (const id of this._servers.keys()) {
      await this.disconnect(id).catch(() => { });
    }
  }
}
