// Romelson — Features/Chat/Executors/Index.js
// Main dispatcher that routes each tool name to the correct executor module.

import * as GmailExecutor      from './GmailExecutor.js';
import * as GithubExecutor     from './GithubExecutor.js';
import * as WeatherExecutor    from './WeatherExecutor.js';
import * as CryptoExecutor     from './CryptoExecutor.js';
import * as FinanceExecutor    from './FinanceExecutor.js';
import * as PhotoExecutor      from './PhotoExecutor.js';
import * as WikiExecutor       from './WikiExecutor.js';
import * as GeoExecutor        from './GeoExecutor.js';
import * as FunExecutor        from './FunExecutor.js';
import * as JokeExecutor       from './JokeExecutor.js';
import * as QuoteExecutor      from './QuoteExecutor.js';
import * as CountryExecutor    from './CountryExecutor.js';
import * as AstronomyExecutor  from './AstronomyExecutor.js';
import * as HackerNewsExecutor from './HackerNewsExecutor.js';
import * as UrlExecutor        from './UrlExecutor.js';
import * as TerminalExecutor   from './TerminalExecutor.js';
import * as RepoExecutor       from './RepoExecutor.js';
import * as ReviewExecutor     from './ReviewExecutor.js';
import * as UtilityExecutor    from './UtilityExecutor.js';
import * as MCPExecutor        from './MCPExecutor.js';

const EXECUTORS = [
  GmailExecutor,
  GithubExecutor,
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
  RepoExecutor,
  ReviewExecutor,
  UtilityExecutor,
  MCPExecutor,
];

function normalizeName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_');
}

async function executorHandles(executor, toolName) {
  if (typeof executor.handles !== 'function') return false;
  const result = executor.handles(toolName);
  if (result && typeof result.then === 'function') return Boolean(await result);
  return Boolean(result);
}

export async function executeTool(toolName, params, onStage = () => {}) {
  for (const executor of EXECUTORS) {
    if (await executorHandles(executor, toolName)) {
      return executor.execute(toolName, params, onStage);
    }
  }

  const normalized = normalizeName(toolName);
  for (const executor of EXECUTORS) {
    if (await executorHandles(executor, normalized)) {
      console.warn(`[Executors] Normalized tool name "${toolName}" -> "${normalized}"`);
      return executor.execute(normalized, params, onStage);
    }
  }

  throw new Error(`Unknown tool: ${toolName}`);
}
