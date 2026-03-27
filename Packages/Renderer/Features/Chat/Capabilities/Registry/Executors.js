import * as GmailExecutor from '../Gmail/Executor.js';
import * as GithubExecutor from '../Github/Executor.js';
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
import * as RepoExecutor from '../Repo/Executor.js';
import * as ReviewExecutor from '../Review/Executor.js';
import * as UtilityExecutor from '../Utility/Executor.js';
import * as MCPExecutor from '../MCP/Executor.js';
import * as SearchExecutor from '../Search/Executor.js';
import * as DictionaryExecutor from '../Dictionary/Executor.js';
import * as TranslateExecutor from '../Translate/Executor.js';
import * as NewsExecutor from '../News/Executor.js';
import * as DateTimeExecutor from '../DateTime/Executor.js';
import * as PasswordExecutor from '../Password/Executor.js';

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
  SearchExecutor,
  DictionaryExecutor,
  TranslateExecutor,
  NewsExecutor,
  DateTimeExecutor,
  PasswordExecutor,
  // MCP always last (dynamic)
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