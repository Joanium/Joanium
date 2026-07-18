# MCP (Model Context Protocol)

Manages connections to MCP servers for extended tool capabilities.

---

## Architecture

```text
Packages/MCP/
├── Index.js              — IPC handlers, auto-connect
├── Core/
│   ├── MCPState.js       — Server configuration persistence
│   └── MCPRegistry.js    — Connection management, JSON-RPC protocol
├── UI/
│   └── MCPPanel.js       — Server configuration UI
└── I18n/
    └── en.js             — MCP strings
```

---

## What is MCP?

Model Context Protocol (MCP) is a standard for connecting AI assistants to external tools and data sources. MCP servers expose tools that the AI can call, similar to Joanium's built-in tool system but for third-party integrations.

---

## IPC Handlers (8 channels)

| Channel | Purpose |
|---|---|
| `mcp:list-servers` | List all MCP servers with connection status |
| `mcp:save-server` | Save/update an MCP server configuration |
| `mcp:remove-server` | Remove an MCP server |
| `mcp:set-enabled` | Enable/disable a server (auto-connects/disconnects) |
| `mcp:connect-server` | Manually connect to a server |
| `mcp:disconnect-server` | Manually disconnect from a server |
| `mcp:list-tools` | List tools from all connected servers |
| `mcp:call-tool` | Execute an MCP tool |

---

## Server Configuration

MCP servers are stored in `Data/MCP.json`:

```json
{
  "servers": [
    {
      "id": "my-server",
      "name": "My MCP Server",
      "command": "npx",
      "args": ["-y", "@my-org/mcp-server"],
      "env": { "API_KEY": "..." },
      "enabled": true
    }
  ]
}
```

### Transport Types

- **stdio**: Spawns a child process and communicates via stdin/stdout (default)
- **SSE**: Connects to an HTTP Server-Sent Events endpoint

---

## MCPRegistry

`MCPRegistry.js` manages connections using JSON-RPC 2.0:

### Protocol

- Protocol version: `2024-11-05`
- Client info: `{ name: 'Joanium', version: '0.2.0' }`

### Connection Lifecycle

1. `connect(server)` — Spawns process or connects to SSE endpoint
2. `initialize()` — Sends `initialize` request with client info
3. `listTools()` — Fetches available tools from the server
4. `callTool(serverId, toolName, args)` — Executes a tool
5. `disconnect(id)` — Terminates the connection

### MCPSession

Each connection is managed by an `MCPSession` class that:

- Tracks pending JSON-RPC requests
- Dispatches responses to correct pending promises
- Handles server notifications
- Cleans up on disconnect

---

## Auto-Connect

On app startup, `MCP` package auto-connects all enabled servers:

```js
const connectEnabledServers = async () => {
  const servers = await stateManager.listServers();
  for (const server of servers) {
    if (!server.enabled) continue;
    try {
      await registry.connect(server);
    } catch {
      console.warn('[MCP] Auto-connect failed for a server.');
    }
  }
};
```

---

## Tool Integration

MCP tools are exposed to the AI through the Toolset system:

1. `mcp:list-tools` returns all tools from connected servers
2. Tools are merged with built-in and connector tools
3. AI can call MCP tools via the standard `joanium-tool` format
4. `mcp:call-tool` routes the call to the correct server

---

## Adding an MCP Server

1. Open Settings → MCP
2. Click "Add Server"
3. Enter server name, command, and arguments
4. Save — server auto-connects if enabled

---

## Error Handling

- Connection failures are logged but don't block the app
- Failed auto-connects produce console warnings
- Tool call errors propagate to the AI as error results
