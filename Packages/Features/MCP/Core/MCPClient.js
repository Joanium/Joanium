import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { getBuiltinBrowserServer } from '../Builtin/BrowserMCPServer.js';
const CLIENT_INFO = { name: 'Joanium', version: '0.1.0' };
class MCPSession extends EventEmitter {
  constructor() {
    (super(), (this._nextId = 1), (this._pending = new Map()));
  }
  _nextReqId() {
    return this._nextId++;
  }
  _dispatch(message) {
    if (null != message.id && this._pending.has(message.id)) {
      const { resolve: resolve, reject: reject } = this._pending.get(message.id);
      (this._pending.delete(message.id),
        message.error
          ? reject(new Error(message.error.message ?? JSON.stringify(message.error)))
          : resolve(message.result));
    } else message.method && this.emit('notification', message);
  }
  async _request(method, params = {}) {
    const id = this._nextReqId();
    return new Promise((resolve, reject) => {
      (this._pending.set(id, { resolve: resolve, reject: reject }),
        this._send({ jsonrpc: '2.0', id: id, method: method, params: params }));
    });
  }
  async initialize() {
    return this._request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {}, resources: {} },
      clientInfo: CLIENT_INFO,
    });
  }
  async listTools() {
    const res = await this._request('tools/list', {});
    return res?.tools ?? [];
  }
  async callTool(name, args = {}) {
    return this._request('tools/call', { name: name, arguments: args });
  }
  async listResources() {
    const res = await this._request('resources/list', {});
    return res?.resources ?? [];
  }
  async readResource(uri) {
    return this._request('resources/read', { uri: uri });
  }
  _send(_msg) {
    throw new Error('_send() not implemented');
  }
  async close() {}
}
export class StdioMCPSession extends MCPSession {
  constructor({ command: command, args: args = [], env: env = {} }) {
    (super(),
      (this._closed = !1),
      (this._exitCode = null),
      (this._closedPromise = new Promise((resolve) => {
        this._resolveClosed = resolve;
      })),
      (this._proc = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...env },
        shell: 'win32' === process.platform,
      })),
      createInterface({ input: this._proc.stdout }).on('line', (line) => {
        if (line.trim())
          try {
            this._dispatch(JSON.parse(line));
          } catch {}
      }),
      this._proc.stderr?.on('data', (d) => this.emit('stderr', d.toString())),
      this._proc.on('exit', (code) => {
        ((this._closed = !0),
          (this._exitCode = code),
          this._resolveClosed?.(code),
          this.emit('close', code));
      }));
  }
  _send(msg) {
    this._proc.stdin?.write(JSON.stringify(msg) + '\n');
  }
  async close() {
    return (
      this._closed || null !== this._proc.exitCode || this._proc.stdin?.end(),
      this._closedPromise
    );
  }
}
export class HttpMCPSession extends MCPSession {
  constructor({ url: url }) {
    (super(), (this._url = url.endsWith('/') ? url.slice(0, -1) : url));
  }
  _send(_msg) {}
  async _request(method, params = {}) {
    const id = this._nextReqId(),
      res = await fetch(`${this._url}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: id, method: method, params: params }),
      });
    if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${await res.text().catch(() => '')}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
    return data.result;
  }
}
export class BuiltinMCPSession extends MCPSession {
  constructor({ builtinType: builtinType }) {
    if ((super(), 'browser' !== builtinType))
      throw new Error(`Unknown built-in MCP server: "${builtinType}"`);
    this._server = getBuiltinBrowserServer();
  }
  _send(_msg) {}
  async initialize() {
    return {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {}, resources: {} },
      clientInfo: CLIENT_INFO,
    };
  }
  async listTools() {
    return this._server.listTools();
  }
  async callTool(name, args = {}) {
    return { content: [{ type: 'text', text: await this._server.callTool(name, args) }] };
  }
  async close() {
    await this._server.close();
  }
}
export class MCPRegistry {
  constructor() {
    this._servers = new Map();
  }
  async connect(serverConfig) {
    const {
      id: id,
      name: name,
      transport: transport,
      url: url,
      command: command,
      args: args,
      env: env,
      builtinType: builtinType,
    } = serverConfig;
    let session;
    if ((this._servers.has(id) && (await this.disconnect(id)), 'http' === transport))
      session = new HttpMCPSession({ url: url });
    else if ('stdio' === transport)
      session = new StdioMCPSession({ command: command, args: args ?? [], env: env ?? {} });
    else {
      if ('builtin' !== transport) throw new Error(`Unknown MCP transport: "${transport}"`);
      session = new BuiltinMCPSession({ builtinType: builtinType });
    }
    try {
      await session.initialize();
    } catch (err) {
      console.warn(`[MCP] initialize() failed for "${name}":`, err.message);
    }
    const tools = await session.listTools().catch(() => []),
      entry = {
        session: session,
        tools: tools,
        meta: { id: id, name: name, transport: transport },
      };
    return (this._servers.set(id, entry), { tools: tools, name: name });
  }
  async disconnect(serverId) {
    const entry = this._servers.get(serverId);
    entry && (await entry.session.close().catch(() => {}), this._servers.delete(serverId));
  }
  getAllTools() {
    const result = [];
    for (const [id, { tools: tools, meta: meta }] of this._servers)
      for (const tool of tools)
        result.push({ ...tool, _mcpServerId: id, _mcpServerName: meta.name });
    return result;
  }
  async callTool(toolName, args = {}) {
    for (const [, { session: session, tools: tools }] of this._servers)
      if (tools.some((t) => t.name === toolName)) {
        const result = await session.callTool(toolName, args);
        return Array.isArray(result?.content)
          ? result.content
              .filter((b) => 'text' === b.type)
              .map((b) => b.text)
              .join('\n')
          : JSON.stringify(result);
      }
    throw new Error(`Tool "${toolName}" not found in any connected MCP server.`);
  }
  getServer(id) {
    return this._servers.get(id);
  }
  getAll() {
    return [...this._servers.values()].map((e) => ({ ...e.meta, toolCount: e.tools.length }));
  }
  isConnected(id) {
    return this._servers.has(id);
  }
  async disconnectAll() {
    for (const id of this._servers.keys()) await this.disconnect(id).catch(() => {});
  }
}
