import { getFeatureBoot } from '../../../../../Features/Core/FeatureBoot.js';
import * as WeatherExecutor from '../Weather/Executor.js';
import * as CryptoExecutor from '../Crypto/Executor.js';
import * as FinanceExecutor from '../Finance/Executor.js';
import * as PhotoExecutor from '../Photo/Executor.js';
import * as WikiExecutor from '../Wiki/Executor.js';
import * as GeoExecutor from '../Geo/Executor.js';
import * as FunExecutor from '../Fun/Executor.js';
import * as JokeExecutor from '../Joke/Executor.js';
import * as QuoteExecutor from '../Quote/Executor.js';
import * as CountryExecutor from '../Country/Executor.js';
import * as AstronomyExecutor from '../Astronomy/Executor.js';
import * as HackerNewsExecutor from '../HackerNews/Executor.js';
import * as UrlExecutor from '../Url/Executor.js';
import * as TerminalExecutor from '../Terminal/Executor.js';
import * as UtilityExecutor from '../Utility/Executor.js';
import * as MCPExecutor from '../MCP/Executor.js';
import * as SearchExecutor from '../Search/Executor.js';
import * as DictionaryExecutor from '../Dictionary/Executor.js';
import * as DateTimeExecutor from '../DateTime/Executor.js';
import * as PasswordExecutor from '../Password/Executor.js';

const EXECUTORS = [
  WeatherExecutor,
  CryptoExecutor,
  FinanceExecutor,
  PhotoExecutor,
  WikiExecutor,
  GeoExecutor,
  FunExecutor,
  JokeExecutor,
  QuoteExecutor,
  CountryExecutor,
  AstronomyExecutor,
  HackerNewsExecutor,
  UrlExecutor,
  TerminalExecutor,
  UtilityExecutor,
  SearchExecutor,
  DictionaryExecutor,
  DateTimeExecutor,
  PasswordExecutor,
  MCPExecutor,
];

function normalizeName(name) {
  return String(name ?? '').trim().toLowerCase().replace(/[\s\-]+/g, '_');
}

async function executorHandles(executor, toolName) {
  if (typeof executor.handles !== 'function') return false;
  const result = executor.handles(toolName);
  if (result && typeof result.then === 'function') return Boolean(await result);
  return Boolean(result);
}

async function tryFeatureExecutor(toolName, params) {
  if (!window.featureAPI?.invoke) return null;
  const boot = await getFeatureBoot();
  const tool = (boot?.chat?.tools ?? []).find(item => item.name === toolName || item.name === normalizeName(toolName));
  if (!tool?.featureId) return null;
  return window.featureAPI.invoke(tool.featureId, 'executeChatTool', { toolName: tool.name, params });
}

export async function executeTool(toolName, params, onStage = () => {}) {
  try {
    const featureResult = await tryFeatureExecutor(toolName, params);
    if (featureResult != null) return featureResult;
  } catch {}

  for (const executor of EXECUTORS) {
    if (await executorHandles(executor, toolName)) {
      return executor.execute(toolName, params, onStage);
    }
  }

  const normalized = normalizeName(toolName);
  try {
    const normalizedFeatureResult = await tryFeatureExecutor(normalized, params);
    if (normalizedFeatureResult != null) return normalizedFeatureResult;
  } catch {}

  for (const executor of EXECUTORS) {
    if (await executorHandles(executor, normalized)) {
      console.warn(`[Executors] Normalized tool name "${toolName}" -> "${normalized}"`);
      return executor.execute(normalized, params, onStage);
    }
  }

  throw new Error(`Unknown tool: ${toolName}`);
}
