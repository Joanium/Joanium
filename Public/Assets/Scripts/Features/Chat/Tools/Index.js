import { GMAIL_TOOLS } from './GmailTools.js';
import { GITHUB_TOOLS } from './GithubTools.js';
import { WEATHER_TOOLS } from './WeatherTools.js';
import { CRYPTO_TOOLS } from './CryptoTools.js';
import { FINANCE_TOOLS } from './FinanceTools.js';
import { PHOTO_TOOLS } from './PhotoTools.js';
import { WIKI_TOOLS } from './WikiTools.js';
import { GEO_TOOLS } from './GeoTools.js';
import { FUN_TOOLS } from './FunTools.js';
import { JOKE_TOOLS } from './JokeTools.js';
import { QUOTE_TOOLS } from './QuoteTools.js';
import { COUNTRY_TOOLS } from './CountryTools.js';
import { ASTRONOMY_TOOLS } from './AstronomyTools.js';
import { HACKERNEWS_TOOLS } from './HackerNewsTools.js';
import { URL_TOOLS } from './UrlTools.js';
import { TERMINAL_TOOLS } from './TerminalTools.js';
import { REPO_TOOLS } from './RepoTools.js';
import { REVIEW_TOOLS } from './ReviewTools.js';
import { UTILITY_TOOLS } from './UtilityTools.js';

export {
  GMAIL_TOOLS, GITHUB_TOOLS, WEATHER_TOOLS, CRYPTO_TOOLS, FINANCE_TOOLS, PHOTO_TOOLS,
  WIKI_TOOLS, GEO_TOOLS, FUN_TOOLS, JOKE_TOOLS, QUOTE_TOOLS, COUNTRY_TOOLS,
  ASTRONOMY_TOOLS, HACKERNEWS_TOOLS, URL_TOOLS, TERMINAL_TOOLS, REPO_TOOLS, REVIEW_TOOLS,
  UTILITY_TOOLS,
};

export const STATIC_TOOLS = [
  ...GMAIL_TOOLS,
  ...GITHUB_TOOLS,
  ...WEATHER_TOOLS,
  ...CRYPTO_TOOLS,
  ...FINANCE_TOOLS,
  ...PHOTO_TOOLS,
  ...WIKI_TOOLS,
  ...GEO_TOOLS,
  ...FUN_TOOLS,
  ...JOKE_TOOLS,
  ...QUOTE_TOOLS,
  ...COUNTRY_TOOLS,
  ...ASTRONOMY_TOOLS,
  ...HACKERNEWS_TOOLS,
  ...URL_TOOLS,
  ...TERMINAL_TOOLS,
  ...REPO_TOOLS,
  ...REVIEW_TOOLS,
  ...UTILITY_TOOLS,
];

// Legacy export retained for existing imports; dynamic MCP tools are layered in via getAvailableTools().
export const TOOLS = STATIC_TOOLS;

const CATEGORY_TO_CONNECTOR = {
  gmail: 'gmail',
  github: 'github',
  github_repo: 'github',
  github_review: 'github',
  open_meteo: 'open_meteo',
  coingecko: 'coingecko',
  exchange_rate: 'exchange_rate',
  treasury: 'treasury',
  fred: 'fred',
  openweathermap: 'openweathermap',
  unsplash: 'unsplash',
  wikipedia: 'wikipedia',
  ipgeo: 'ipgeo',
  funfacts: 'funfacts',
  jokeapi: 'jokeapi',
  quotes: 'quotes',
  restcountries: 'restcountries',
  nasa: 'nasa',
  hackernews: 'hackernews',
  cleanuri: 'cleanuri',
};

function normalizeSchemaType(type = 'string') {
  const normalized = String(type || 'string').toLowerCase();
  if (['string', 'number', 'integer', 'boolean', 'object', 'array'].includes(normalized)) {
    return normalized === 'integer' ? 'number' : normalized;
  }
  return 'string';
}

function schemaPropToParameter(prop = {}, required = false) {
  const fallbackType = Array.isArray(prop.anyOf)
    ? prop.anyOf.find(v => v?.type)?.type
    : prop.type;

  return {
    type: normalizeSchemaType(fallbackType),
    required,
    description: prop.description || prop.title || '',
  };
}

function normalizeMCPTool(tool) {
  const schema = tool.inputSchema || tool.input_schema || {};
  const properties = schema.properties || {};
  const required = new Set(schema.required || []);

  return {
    name: tool.name,
    description: tool.description || `Tool from MCP server ${tool._mcpServerName || 'unknown'}.`,
    category: 'mcp',
    source: 'mcp',
    parameters: Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        schemaPropToParameter(value, required.has(key)),
      ]),
    ),
  };
}

function dedupeTools(tools = []) {
  const seen = new Set();
  const result = [];

  for (const tool of tools) {
    if (!tool?.name || seen.has(tool.name)) continue;
    seen.add(tool.name);
    result.push(tool);
  }

  return result;
}

function filterToolListByConnectors(tools = [], connectorStatuses = {}) {
  return tools.filter(tool => {
    const connectorName = CATEGORY_TO_CONNECTOR[tool.category];
    if (!connectorName) return true;
    const status = connectorStatuses?.[connectorName];
    return status?.enabled === true;
  });
}

export function filterToolsByConnectors(connectorStatuses = {}) {
  return filterToolListByConnectors(STATIC_TOOLS, connectorStatuses);
}

export async function getAvailableTools() {
  let connectorStatuses = {};
  try {
    connectorStatuses = await window.electronAPI?.getConnectors?.() ?? {};
  } catch { /* non-fatal */ }

  let mcpTools = [];
  try {
    const res = await window.electronAPI?.mcpGetTools?.();
    if (res?.ok) {
      mcpTools = (res.tools ?? []).map(normalizeMCPTool).filter(Boolean);
    }
  } catch { /* non-fatal */ }

  return dedupeTools([
    ...filterToolListByConnectors(STATIC_TOOLS, connectorStatuses),
    ...mcpTools,
  ]);
}

export function buildToolsPrompt(tools = TOOLS) {
  return tools.map(tool => {
    const params = Object.entries(tool.parameters ?? {}).map(([key, p]) =>
      `    - ${key} (${p.type}${p.required ? ', required' : ', optional'}): ${p.description}`,
    ).join('\n');

    return [
      `• ${tool.name}`,
      `  Description: ${tool.description}`,
      params ? `  Parameters:\n${params}` : '  Parameters: none',
    ].join('\n');
  }).join('\n\n');
}
