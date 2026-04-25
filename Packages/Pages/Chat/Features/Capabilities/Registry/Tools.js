import { state } from '../../../../../System/State.js';
import { getFeatureBoot } from '../../../../../Features/Core/FeatureBoot.js';
import {
  CAPABILITY_MANIFESTS,
  ALL_TRIGGERED_TOOLS,
  TOOL_NAMES_BY_GROUP,
  CATEGORY_CONNECTOR_MAP,
} from './CapabilityManifest.js';
import { matchTriggeredGroups, TRIGGERED_GROUPS } from './TriggerRegistry.js';
import { TERMINAL_TOOLS } from '../Terminal/Tools.js';
import { SEARCH_TOOLS } from '../Search/Tools.js';
import { UTILITY_TOOLS } from '../Utility/Tools.js';
import { MEMORY_TOOLS } from '../Memory/Tools.js';
import { SUBAGENT_TOOLS } from '../SubAgents/Tools.js';
export { TERMINAL_TOOLS, SEARCH_TOOLS, UTILITY_TOOLS, MEMORY_TOOLS, SUBAGENT_TOOLS };
export { WEATHER_TOOLS } from '../Weather/Tools.js';
export { CRYPTO_TOOLS } from '../Crypto/Tools.js';
export { FINANCE_TOOLS } from '../Finance/Tools.js';
export { PHOTO_TOOLS } from '../Photo/Tools.js';
export { WIKI_TOOLS } from '../Wiki/Tools.js';
export { GEO_TOOLS } from '../Geo/Tools.js';
export { FUN_TOOLS } from '../Fun/Tools.js';
export { JOKE_TOOLS } from '../Joke/Tools.js';
export { QUOTE_TOOLS } from '../Quote/Tools.js';
export { COUNTRY_TOOLS } from '../Country/Tools.js';
export { ASTRONOMY_TOOLS } from '../Astronomy/Tools.js';
export { HACKERNEWS_TOOLS } from '../HackerNews/Tools.js';
export { URL_TOOLS } from '../Url/Tools.js';
export { DICTIONARY_TOOLS } from '../Dictionary/Tools.js';
export { DATETIME_TOOLS } from '../DateTime/Tools.js';
export { PASSWORD_TOOLS } from '../Password/Tools.js';
export { NPM_TOOLS } from '../Npm/Tools.js';
export { STACKOVERFLOW_TOOLS } from '../StackOverflow/Tools.js';
const REQUEST_TOOL_CATEGORIES_TOOL = {
  name: 'request_tool_categories',
  description:
    'Load specialized tools by category when your current toolset is insufficient. Available categories:\n' +
    CAPABILITY_MANIFESTS.map((m) => `  - ${m.name}: ${m.description}`).join('\n') +
    '\nRequest only the categories you need. You can request multiple categories in one call (e.g. "github,weather"). Use "all" to load everything.',
  category: 'utility',
  parameters: {
    categories: {
      type: 'string',
      required: !0,
      description:
        'Comma-separated list of category names to load (e.g. "github,weather,finance"). Use "all" to load everything.',
    },
  },
};
export const DEFAULT_TOOLS = [
  ...TERMINAL_TOOLS,
  ...SEARCH_TOOLS,
  ...UTILITY_TOOLS,
  ...MEMORY_TOOLS,
  ...SUBAGENT_TOOLS,
  REQUEST_TOOL_CATEGORIES_TOOL,
];
const TRIGGERED_STATIC_TOOLS = ALL_TRIGGERED_TOOLS;
export const STATIC_TOOLS = [...DEFAULT_TOOLS, ...TRIGGERED_STATIC_TOOLS];
export const TOOLS = STATIC_TOOLS;
const CATEGORY_TO_CONNECTOR = Object.fromEntries([
    ...CATEGORY_CONNECTOR_MAP.entries(),
    ['search', null],
    ['dictionary', null],
    ['translate', null],
    ['news', null],
    ['datetime', null],
    ['security', null],
    ['utility', null],
    ['terminal', null],
    ['mcp', null],
  ]),
  WORKSPACE_SCOPED_TOOL_NAMES = new Set([
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
  return ['string', 'number', 'integer', 'boolean', 'object', 'array'].includes(normalized)
    ? 'integer' === normalized
      ? 'number'
      : normalized
    : 'string';
}
function schemaPropToParameter(prop = {}, required = !1) {
  return {
    type: normalizeSchemaType(
      Array.isArray(prop.anyOf) ? prop.anyOf.find((value) => value?.type)?.type : prop.type,
    ),
    required: required,
    description: prop.description || prop.title || '',
  };
}
function normalizeMCPTool(tool) {
  const schema = tool.inputSchema || tool.input_schema || {},
    properties = schema.properties || {},
    required = new Set(schema.required || []);
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
function filterToolListByConnectors(tools = [], connectorStatuses = {}) {
  return tools.filter((tool) => {
    const connectorName = (function (tool = {}) {
      return tool.connectorId ? tool.connectorId : CATEGORY_TO_CONNECTOR[tool.category];
    })(tool);
    return null == connectorName || !0 === connectorStatuses?.[connectorName]?.enabled;
  });
}
function filterToolListByWorkspace(tools = [], workspacePath = state.workspacePath) {
  return workspacePath
    ? tools
    : tools.filter((tool) => !WORKSPACE_SCOPED_TOOL_NAMES.has(tool.name));
}
export function filterToolsByConnectors(connectorStatuses = {}) {
  return filterToolListByConnectors(STATIC_TOOLS, connectorStatuses);
}
export async function getAvailableTools(options = {}) {
  const workspacePath = Object.prototype.hasOwnProperty.call(options, 'workspacePath')
    ? String(options.workspacePath ?? '').trim()
    : state.workspacePath;
  let connectorStatuses = {};
  try {
    connectorStatuses = (await window.electronAPI?.invoke?.('get-connectors')) ?? {};
  } catch {}
  let mcpTools = [];
  try {
    const res = await window.electronAPI?.invoke?.('mcp-get-tools');
    res?.ok && (mcpTools = (res.tools ?? []).map(normalizeMCPTool).filter(Boolean));
  } catch {}
  let featureTools = [];
  try {
    const boot = await getFeatureBoot();
    featureTools = boot?.chat?.tools ?? [];
  } catch {}
  return (function (tools = []) {
    const byName = new Map();
    for (const tool of tools) tool?.name && (byName.has(tool.name) || byName.set(tool.name, tool));
    return [...byName.values()];
  })([
    ...filterToolListByWorkspace(
      filterToolListByConnectors(featureTools, connectorStatuses),
      workspacePath,
    ),
    ...filterToolListByWorkspace(
      filterToolListByConnectors(STATIC_TOOLS, connectorStatuses),
      workspacePath,
    ),
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
export const REQUEST_TOOL_CATEGORIES_NAME = 'request_tool_categories';
const DEFAULT_TOOL_NAMES = new Set(DEFAULT_TOOLS.map((t) => t.name)),
  DEFAULT_CATEGORIES = new Set(['terminal', 'search', 'utility', 'mcp', 'news']),
  ALL_TRIGGERED_CATEGORIES = new Set();
for (const group of TRIGGERED_GROUPS)
  for (const cat of group.featureCategories) ALL_TRIGGERED_CATEGORIES.add(cat);
const ALL_KNOWN_CATEGORIES = new Set([...DEFAULT_CATEGORIES, ...ALL_TRIGGERED_CATEGORIES]);
export function filterToolsByUserText(allTools, userText) {
  if (!userText?.trim()) return allTools;
  const matchedGroups = matchTriggeredGroups(userText),
    allowedCategories = new Set(DEFAULT_CATEGORIES);
  for (const groupName of matchedGroups) {
    const group = TRIGGERED_GROUPS.find((g) => g.name === groupName);
    if (group) for (const cat of group.featureCategories) allowedCategories.add(cat);
  }
  const allowedToolNames = new Set(DEFAULT_TOOL_NAMES);
  for (const groupName of matchedGroups) {
    const names = TOOL_NAMES_BY_GROUP.get(groupName);
    if (names) for (const name of names) allowedToolNames.add(name);
  }
  const filtered = allTools.filter(
    (tool) =>
      !!allowedToolNames.has(tool.name) ||
      'mcp' === tool.source ||
      !!allowedCategories.has(tool.category) ||
      !(!tool.category || ALL_KNOWN_CATEGORIES.has(tool.category)),
  );
  return (
    matchedGroups.size > 0
      ? console.log(
          `[Tools] Trigger-matched: ${[...matchedGroups].join(', ')} | ${allTools.length} → ${filtered.length} tools`,
        )
      : console.log(
          `[Tools] No triggers matched | ${allTools.length} → ${filtered.length} tools (defaults only)`,
        ),
    filtered
  );
}
export function parseRequestedCategories(raw = '') {
  const cleaned = String(raw ?? '').trim();
  if (!cleaned) return [];
  if (cleaned.startsWith('['))
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed))
        return parsed.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
    } catch {}
  return cleaned
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}
export function getToolsForCategories(allTools, categoryNames) {
  const requestedNames = new Set(categoryNames),
    allowedToolNames = new Set();
  for (const name of requestedNames) {
    const toolNames = TOOL_NAMES_BY_GROUP.get(name);
    if (toolNames) for (const tn of toolNames) allowedToolNames.add(tn);
  }
  const allowedCategories = new Set();
  for (const group of TRIGGERED_GROUPS)
    if (requestedNames.has(group.name))
      for (const cat of group.featureCategories) allowedCategories.add(cat);
  return allTools.filter(
    (tool) =>
      !!allowedToolNames.has(tool.name) ||
      !(!tool.category || !allowedCategories.has(tool.category)),
  );
}
export function buildCategoryLoadResult(requested, loadedTools) {
  const isAll = requested.includes('all'),
    validGroups = isAll
      ? TRIGGERED_GROUPS.map((g) => g.name)
      : requested.filter((name) => TRIGGERED_GROUPS.some((g) => g.name === name)),
    invalidGroups = isAll
      ? []
      : requested.filter((name) => !TRIGGERED_GROUPS.some((g) => g.name === name)),
    lines = [];
  (validGroups.length &&
    lines.push(
      `Loaded tools from categor${1 === validGroups.length ? 'y' : 'ies'}: ${validGroups.join(', ')}.`,
    ),
    invalidGroups.length &&
      lines.push(
        `Unknown categor${1 === invalidGroups.length ? 'y' : 'ies'}: ${invalidGroups.join(', ')}. These were ignored.`,
      ));
  const toolNames = loadedTools
    .filter(
      (t) =>
        !DEFAULT_TOOL_NAMES.has(t.name) &&
        'request_tool_categories' !== t.name &&
        'request_all_tools' !== t.name,
    )
    .map((t) => t.name);
  return (
    toolNames.length && lines.push(`Now available: ${toolNames.join(', ')}.`),
    lines.push("Proceed with the appropriate tool calls for the user's request."),
    lines.join('\n')
  );
}
/**
 * Returns a toolFilter predicate that keeps default/unscoped tools (those with
 * no connectorId / no mapped connector) and only includes connector-specific
 * tools whose connectorId appears in `activeScopes`.
 *
 * Returns null when activeScopes is empty (no restriction needed).
 */
export function buildToolScopeFilter(activeScopes = []) {
  if (!activeScopes || !activeScopes.length) return null;
  const scopeSet = new Set(activeScopes.map((s) => String(s).toLowerCase()));
  return function toolScopeFilter(tool) {
    // 1. Explicit connectorId always takes priority.
    if (tool.connectorId != null) {
      return scopeSet.has(String(tool.connectorId).toLowerCase());
    }
    // 2. Category is mapped in CATEGORY_TO_CONNECTOR.
    //    null means "default/unscoped tool" (terminal, search, utility…) — always pass.
    if (
      tool.category &&
      Object.prototype.hasOwnProperty.call(CATEGORY_TO_CONNECTOR, tool.category)
    ) {
      const connId = CATEGORY_TO_CONNECTOR[tool.category];
      if (connId === null) return true;
      return scopeSet.has(String(connId).toLowerCase());
    }
    // 3. Category is NOT in the map at all (e.g. 'sentry', 'github', 'gitlab').
    //    Treat the category name itself as the connector ID — so a '/github' scope
    //    only passes github-category tools, and sentry/gitlab/etc. are blocked.
    if (tool.category) {
      return scopeSet.has(String(tool.category).toLowerCase());
    }
    // 4. No category info whatsoever — can't determine affiliation, let it through.
    return true;
  };
}
export function buildToolCatalog(availableTools = []) {
  const availableCategories = new Set(availableTools.map((t) => t.category).filter(Boolean)),
    availableNames = new Set(availableTools.map((t) => t.name)),
    activeGroups = TRIGGERED_GROUPS.filter((group) => {
      const toolNames = TOOL_NAMES_BY_GROUP.get(group.name);
      if (toolNames) for (const name of toolNames) if (availableNames.has(name)) return !0;
      for (const cat of group.featureCategories) if (availableCategories.has(cat)) return !0;
      return !1;
    });
  return activeGroups.length
    ? [
        'Your toolset has been expanded. The following tool groups are now available:',
        '',
        ...activeGroups.map((g) => `- ${g.name}: ${g.description}`),
        '',
        "Proceed with the appropriate tool calls for the user's request.",
      ].join('\n')
    : 'No additional tool groups are available.';
}
