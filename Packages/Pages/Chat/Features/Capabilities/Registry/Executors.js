import { getFeatureBoot } from '../../../../../Features/Core/FeatureBoot.js';
import { MANIFEST_EXECUTORS } from './CapabilityManifest.js';
import * as TerminalExecutor from '../Terminal/Executor.js';
import * as UtilityExecutor from '../Utility/Executor.js';
import * as SearchExecutor from '../Search/Executor.js';
import * as MemoryExecutor from '../Memory/Executor.js';
import * as SubAgentsExecutor from '../SubAgents/Executor.js';
import * as MCPExecutor from '../MCP/Executor.js';
const EXECUTORS = [
  TerminalExecutor,
  UtilityExecutor,
  SearchExecutor,
  MemoryExecutor,
  SubAgentsExecutor,
  ...MANIFEST_EXECUTORS,
  MCPExecutor,
];
function normalizeName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_');
}
async function executorHandles(executor, toolName) {
  if ('function' != typeof executor.handles) return !1;
  const result = executor.handles(toolName);
  return result && 'function' == typeof result.then ? Boolean(await result) : Boolean(result);
}
async function tryFeatureExecutor(toolName, params) {
  if (!window.featureAPI?.invoke) return null;
  const boot = await getFeatureBoot(),
    tool = (boot?.chat?.tools ?? []).find(
      (item) => item.name === toolName || item.name === normalizeName(toolName),
    );
  return tool?.featureId
    ? window.featureAPI.invoke(tool.featureId, 'executeChatTool', {
        toolName: tool.name,
        params: params,
      })
    : null;
}
export async function executeTool(toolName, params, onStageOrHooks = () => {}, maybeHooks = null) {
  const hooks = (function (onStageOrHooks, maybeHooks = null) {
    const hooks =
      onStageOrHooks && 'object' == typeof onStageOrHooks
        ? { ...onStageOrHooks }
        : { ...(maybeHooks ?? {}) };
    return (
      'function' == typeof onStageOrHooks
        ? (hooks.onStage = onStageOrHooks)
        : 'function' == typeof maybeHooks && (hooks.onStage = maybeHooks),
      'function' != typeof hooks.onStage && (hooks.onStage = () => {}),
      hooks
    );
  })(onStageOrHooks, maybeHooks);
  try {
    const featureResult = await tryFeatureExecutor(toolName, params);
    if (null != featureResult) return featureResult;
  } catch {}
  for (const executor of EXECUTORS)
    if (await executorHandles(executor, toolName)) return executor.execute(toolName, params, hooks);
  const normalized = normalizeName(toolName);
  try {
    const normalizedFeatureResult = await tryFeatureExecutor(normalized, params);
    if (null != normalizedFeatureResult) return normalizedFeatureResult;
  } catch {}
  for (const executor of EXECUTORS)
    if (await executorHandles(executor, normalized))
      return (
        console.warn(`[Executors] Normalized tool name "${toolName}" -> "${normalized}"`),
        executor.execute(normalized, params, hooks)
      );
  throw new Error(`Unknown tool: ${toolName}`);
}
