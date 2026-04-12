let _mcpToolNames = new Set(),
  _lastFetch = 0,
  _refreshPromise = null;
export async function handles(toolName) {
  return (
    await (async function () {
      if (!(Date.now() - _lastFetch < 3e4))
        return (
          _refreshPromise ||
          ((_refreshPromise = (async () => {
            try {
              const res = await window.electronAPI?.invoke?.('mcp-get-tools');
              res?.ok &&
                ((_mcpToolNames = new Set((res.tools ?? []).map((t) => t.name))),
                (_lastFetch = Date.now()));
            } catch {}
          })().finally(() => {
            _refreshPromise = null;
          })),
          _refreshPromise)
        );
    })(),
    _mcpToolNames.has(toolName)
  );
}
export function handlesSync(toolName) {
  return _mcpToolNames.has(toolName);
}
export async function execute(toolName, params, hooksOrOnStage = () => {}) {
  const onStage = (function (hooksOrOnStage) {
    return 'function' == typeof hooksOrOnStage
      ? hooksOrOnStage
      : hooksOrOnStage &&
          'object' == typeof hooksOrOnStage &&
          'function' == typeof hooksOrOnStage.onStage
        ? hooksOrOnStage.onStage
        : () => {};
  })(hooksOrOnStage);
  onStage(`Calling MCP tool: ${toolName}`);
  const result = await window.electronAPI?.invoke?.('mcp-call-tool', {
    toolName: toolName,
    args: params,
  });
  if (!result) return 'MCP is not available in this environment.';
  if (!result.ok) throw new Error(result.error ?? 'MCP tool call failed');
  return result.result ?? '(no output)';
}
