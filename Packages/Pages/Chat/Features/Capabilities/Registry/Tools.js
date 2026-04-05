import { state } from '../../../../../System/State.js';
import { getFeatureBoot } from '../../../../../Features/Core/FeatureBoot.js';
import { WEATHER_TOOLS } from '../Weather/Tools.js';
import { CRYPTO_TOOLS } from '../Crypto/Tools.js';
import { FINANCE_TOOLS } from '../Finance/Tools.js';
import { PHOTO_TOOLS } from '../Photo/Tools.js';
import { WIKI_TOOLS } from '../Wiki/Tools.js';
import { GEO_TOOLS } from '../Geo/Tools.js';
import { FUN_TOOLS } from '../Fun/Tools.js';
import { JOKE_TOOLS } from '../Joke/Tools.js';
import { QUOTE_TOOLS } from '../Quote/Tools.js';
import { COUNTRY_TOOLS } from '../Country/Tools.js';
import { ASTRONOMY_TOOLS } from '../Astronomy/Tools.js';
import { HACKERNEWS_TOOLS } from '../HackerNews/Tools.js';
import { URL_TOOLS } from '../Url/Tools.js';
import { TERMINAL_TOOLS } from '../Terminal/Tools.js';
import { UTILITY_TOOLS } from '../Utility/Tools.js';
import { SEARCH_TOOLS } from '../Search/Tools.js';
import { DICTIONARY_TOOLS } from '../Dictionary/Tools.js';
import { DATETIME_TOOLS } from '../DateTime/Tools.js';
import { PASSWORD_TOOLS } from '../Password/Tools.js';
import { SUBAGENT_TOOLS } from '../SubAgents/Tools.js';

export {
  WEATHER_TOOLS,
  CRYPTO_TOOLS,
  FINANCE_TOOLS,
  PHOTO_TOOLS,
  WIKI_TOOLS,
  GEO_TOOLS,
  FUN_TOOLS,
  JOKE_TOOLS,
  QUOTE_TOOLS,
  COUNTRY_TOOLS,
  ASTRONOMY_TOOLS,
  HACKERNEWS_TOOLS,
  URL_TOOLS,
  TERMINAL_TOOLS,
  UTILITY_TOOLS,
  SEARCH_TOOLS,
  DICTIONARY_TOOLS,
  DATETIME_TOOLS,
  PASSWORD_TOOLS,
  SUBAGENT_TOOLS,
};

export const STATIC_TOOLS = [
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
  ...UTILITY_TOOLS,
  ...SEARCH_TOOLS,
  ...DICTIONARY_TOOLS,
  ...DATETIME_TOOLS,
  ...PASSWORD_TOOLS,
  ...SUBAGENT_TOOLS,
];

export const TOOLS = STATIC_TOOLS;

const CATEGORY_TO_CONNECTOR = {
  gmail: 'google',
  drive: 'google',
  calendar: 'google',
  github: 'github',
  github_review: 'github',
  gitlab: 'gitlab',
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
  search: null,
  dictionary: null,
  translate: null,
  news: null,
  datetime: null,
  security: null,
  utility: null,
  terminal: null,
  mcp: null,
};

const WORKSPACE_SCOPED_TOOL_NAMES = new Set([
  'inspect_workspace',
  'search_workspace',
  'find_file_by_name',
  'git_status',
  'git_diff',
  'git_create_branch',
  'run_project_checks',
  'start_local_server',
]);

function normalizeSchemaType(type = 'string') {
  const normalized = String(type || 'string').toLowerCase();
  if (['string', 'number', 'integer', 'boolean', 'object', 'array'].includes(normalized)) {
    return normalized === 'integer' ? 'number' : normalized;
  }
  return 'string';
}

function schemaPropToParameter(prop = {}, required = false) {
  const fallbackType = Array.isArray(prop.anyOf)
    ? prop.anyOf.find((value) => value?.type)?.type
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
  const byName = new Map();
  for (const tool of tools) {
    if (!tool?.name) continue;
    if (!byName.has(tool.name)) byName.set(tool.name, tool);
  }
  return [...byName.values()];
}

function getConnectorName(tool = {}) {
  if (tool.connectorId) return tool.connectorId;
  return CATEGORY_TO_CONNECTOR[tool.category];
}

function filterToolListByConnectors(tools = [], connectorStatuses = {}) {
  return tools.filter((tool) => {
    const connectorName = getConnectorName(tool);
    if (connectorName == null) return true;
    return connectorStatuses?.[connectorName]?.enabled === true;
  });
}

function filterToolListByWorkspace(tools = []) {
  if (state.workspacePath) return tools;
  return tools.filter((tool) => !WORKSPACE_SCOPED_TOOL_NAMES.has(tool.name));
}

export function filterToolsByConnectors(connectorStatuses = {}) {
  return filterToolListByConnectors(STATIC_TOOLS, connectorStatuses);
}

export async function getAvailableTools() {
  let connectorStatuses = {};
  try {
    connectorStatuses = (await window.electronAPI?.invoke?.('get-connectors')) ?? {};
  } catch {}

  let mcpTools = [];
  try {
    const res = await window.electronAPI?.invoke?.('mcp-get-tools');
    if (res?.ok) mcpTools = (res.tools ?? []).map(normalizeMCPTool).filter(Boolean);
  } catch {}

  let featureTools = [];
  try {
    const boot = await getFeatureBoot();
    featureTools = boot?.chat?.tools ?? [];
  } catch {}

  return dedupeTools([
    ...filterToolListByWorkspace(filterToolListByConnectors(featureTools, connectorStatuses)),
    ...filterToolListByWorkspace(filterToolListByConnectors(STATIC_TOOLS, connectorStatuses)),
    ...mcpTools,
  ]);
}

export function buildToolsPrompt(tools = TOOLS) {
  return tools
    .map((tool) => {
      const params = Object.entries(tool.parameters ?? {})
        .map(
          ([key, value]) =>
            `    - ${key} (${value.type}${value.required ? ', required' : ', optional'}): ${value.description}`,
        )
        .join('\n');

      return [
        `* ${tool.name}`,
        `  Description: ${tool.description}`,
        params ? `  Parameters:\n${params}` : '  Parameters: none',
      ].join('\n');
    })
    .join('\n\n');
}
