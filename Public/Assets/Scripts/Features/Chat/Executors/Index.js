// openworld — Features/Chat/Executors/Index.js
// Main dispatcher — routes each tool name to the correct executor module.
// Normalizes tool names (trim + lowercase) before matching so minor
// model-output variations (extra spaces, case differences) don't cause
// "Unknown tool" errors.

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
];

/**
 * Normalize a tool name coming from the AI:
 *   - trim whitespace
 *   - lowercase
 *   - collapse multiple spaces / hyphens to underscores
 * This makes matching robust against minor model-output variations.
 */
function normalizeName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_');
}

/**
 * Execute a single tool call.
 * Tries exact match first, then normalized match, so well-formed names
 * hit the fast path and slightly malformed names still resolve correctly.
 *
 * @param {string}   toolName
 * @param {object}   params
 * @param {function} onStage  — callback(message) to update UI during execution
 * @returns {Promise<string>} — plain-text result to feed back to the AI
 */
export async function executeTool(toolName, params, onStage = () => {}) {
  // ── Fast path: exact match ────────────────────────────────────────────
  for (const executor of EXECUTORS) {
    if (executor.handles(toolName)) {
      return executor.execute(toolName, params, onStage);
    }
  }

  // ── Fallback: normalized match ───────────────────────────────────────
  const normalized = normalizeName(toolName);
  for (const executor of EXECUTORS) {
    if (executor.handles(normalized)) {
      console.warn(`[Executors] Normalized tool name "${toolName}" → "${normalized}"`);
      return executor.execute(normalized, params, onStage);
    }
  }

  throw new Error(`Unknown tool: ${toolName}`);
}
