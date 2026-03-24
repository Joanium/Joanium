// Romelson — Features/Chat/Executors/MCPExecutor.js
// Dynamically routes tool calls to connected MCP servers.
// The set of handled tools is determined at runtime by querying
// the main process for the current list of MCP tools.

/** Cache of tool names from MCP servers, refreshed per session. */
let _mcpToolNames = new Set();
let _lastFetch    = 0;
const CACHE_TTL   = 30_000; // 30 s

async function refreshMCPTools() {
  const now = Date.now();
  if (now - _lastFetch < CACHE_TTL) return;
  try {
    const res = await window.electronAPI?.mcpGetTools?.();
    if (res?.ok) {
      _mcpToolNames = new Set((res.tools ?? []).map(t => t.name));
      _lastFetch    = now;
    }
  } catch { /* non-fatal */ }
}

export async function handles(toolName) {
  await refreshMCPTools();
  return _mcpToolNames.has(toolName);
}

// Synchronous check — used by Index.js normalization lookup
export function handlesSync(toolName) {
  return _mcpToolNames.has(toolName);
}

export async function execute(toolName, params, onStage = () => {}) {
  onStage(`🔌 Calling MCP tool: ${toolName}`);

  const result = await window.electronAPI?.mcpCallTool?.({ toolName, args: params });
  if (!result) return '⚠️ MCP is not available in this environment.';
  if (!result.ok) throw new Error(result.error ?? 'MCP tool call failed');

  return result.result ?? '(no output)';
}
