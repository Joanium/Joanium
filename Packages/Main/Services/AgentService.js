import path from 'path';
import { loadJson, persistJson } from '../Core/FileSystem.js';
import Paths from '../Core/Paths.js';
import {
  STATIC_CONNECTORS,
  STATIC_FREE_CONNECTORS,
} from '../../Pages/Shared/Connectors/Catalog/ConnectorDefs.js';
import {
  BUILT_IN_SLASH_COMMAND_IDS,
  sanitizeSlashCommandId,
  isBuiltInSlashCommandId,
} from '../../System/Agents/CommandId.js';
import {
  describeSchedule,
  getNextRunAt,
  isValidCronExpression,
} from '../../System/Agents/Schedule.js';

const TEMPLATE_INDEX_FILE = path.join(process.cwd(), 'Data', 'Templates', 'Index.json');

function loadStore() {
  return loadJson(Paths.AGENTS_FILE, { agents: [] });
}

function persistStore(store) {
  persistJson(Paths.AGENTS_FILE, store);
}

function loadTemplateIds() {
  return (loadJson(TEMPLATE_INDEX_FILE, []) ?? [])
    .map((entry) => sanitizeSlashCommandId(entry?.id ?? entry?.trigger ?? ''))
    .filter(Boolean);
}

function connectorIds() {
  return [...STATIC_CONNECTORS, ...STATIC_FREE_CONNECTORS]
    .map((connector) => sanitizeSlashCommandId(connector?.id))
    .filter(Boolean);
}

function normalizeModelRef(value = null) {
  const provider = String(value?.provider ?? '').trim(),
    modelId = String(value?.modelId ?? '').trim();
  return provider && modelId ? { provider, modelId } : null;
}

function normalizeFallbackModels(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map(normalizeModelRef)
    .filter(Boolean)
    .filter((item) => {
      const key = `${item.provider}::${item.modelId}`;
      return seen.has(key) ? false : (seen.add(key), true);
    });
}

function normalizeWorkspace(workspace = null) {
  const projectId = String(workspace?.projectId ?? '').trim(),
    projectName = String(workspace?.projectName ?? '').trim(),
    workspacePath = String(workspace?.workspacePath ?? '').trim();
  return projectId && projectName && workspacePath
    ? { projectId, projectName, workspacePath }
    : null;
}

function normalizeSchedule(schedule = {}) {
  const type = String(schedule?.type ?? '')
    .trim()
    .toLowerCase();
  if ('on_startup' === type) return { type: 'on_startup', label: 'On app startup' };
  if ('cron' !== type) throw new Error('Schedule must be startup or cron.');
  const expression = String(schedule?.expression ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!isValidCronExpression(expression)) throw new Error('Invalid cron expression.');
  const editor =
    schedule?.editor && 'object' == typeof schedule.editor ? { ...schedule.editor } : null;
  return {
    type: 'cron',
    expression,
    editor,
    label: describeSchedule({ type: 'cron', expression, editor }),
  };
}

function reservedSlashIds(currentAgentId = null) {
  return new Set([
    ...BUILT_IN_SLASH_COMMAND_IDS,
    ...loadTemplateIds(),
    ...connectorIds(),
    ...list()
      .map((agent) => agent.id)
      .filter((id) => id !== currentAgentId),
  ]);
}

function assertValidName(rawName, currentAgentId = null) {
  const id = sanitizeSlashCommandId(rawName);
  if (!id || id.length < 2) throw new Error('Agent name must be at least 2 characters.');
  if (isBuiltInSlashCommandId(id))
    throw new Error(`"/${id}" conflicts with a built-in slash command.`);
  if (reservedSlashIds(currentAgentId).has(id))
    throw new Error(
      `"/${id}" is already used by another slash command, template, connector, or agent.`,
    );
  return id;
}

function normalizeAgentInput(input = {}, currentAgent = null) {
  const now = new Date().toISOString(),
    id = assertValidName(input?.name ?? input?.id ?? '', currentAgent?.id ?? null),
    name = String(input?.name ?? '').trim() || id,
    prompt = String(input?.prompt ?? '').trim(),
    description = String(input?.description ?? '').trim(),
    primaryModel = normalizeModelRef(input?.primaryModel),
    fallbackModels = normalizeFallbackModels(input?.fallbackModels),
    workspace = normalizeWorkspace(input?.workspace),
    schedule = normalizeSchedule(input?.schedule),
    enabled = false !== input?.enabled;
  if (!prompt) throw new Error('Agent prompt is required.');
  if (!primaryModel) throw new Error('Choose a primary model.');
  return {
    id,
    name,
    prompt,
    description,
    primaryModel,
    fallbackModels: fallbackModels.filter(
      (item) =>
        `${item.provider}::${item.modelId}` !== `${primaryModel.provider}::${primaryModel.modelId}`,
    ),
    workspace,
    schedule,
    enabled,
    createdAt: currentAgent?.createdAt ?? now,
    updatedAt: now,
    lastRunAt: currentAgent?.lastRunAt ?? null,
    lastRunStatus: currentAgent?.lastRunStatus ?? 'idle',
    lastRunSource: currentAgent?.lastRunSource ?? null,
    lastRunError: currentAgent?.lastRunError ?? null,
    lastRunSummary: currentAgent?.lastRunSummary ?? null,
    lastRunModel: currentAgent?.lastRunModel ?? null,
    lastRunProvider: currentAgent?.lastRunProvider ?? null,
  };
}

function decorateAgent(agent = {}) {
  const workspace = normalizeWorkspace(agent.workspace);
  return {
    ...agent,
    workspace,
    schedule: normalizeSchedule(agent.schedule),
    nextRunAt: getNextRunAt(agent.schedule),
  };
}

export function list() {
  const store = loadStore();
  return (Array.isArray(store?.agents) ? store.agents : [])
    .map(decorateAgent)
    .sort((left, right) => {
      if (left.enabled !== right.enabled) return left.enabled ? -1 : 1;
      const leftTime = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
      const rightTime = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
      return rightTime - leftTime;
    });
}

export function get(agentId) {
  const id = sanitizeSlashCommandId(agentId),
    agent = list().find((entry) => entry.id === id);
  if (!agent) throw new Error(`Agent "${id}" was not found.`);
  return agent;
}

export function create(input = {}) {
  const store = loadStore(),
    nextAgent = normalizeAgentInput(input, null);
  store.agents = [...(Array.isArray(store.agents) ? store.agents : []), nextAgent];
  return (persistStore(store), decorateAgent(nextAgent));
}

export function update(agentId, patch = {}) {
  const id = sanitizeSlashCommandId(agentId),
    store = loadStore(),
    agents = Array.isArray(store.agents) ? store.agents : [],
    index = agents.findIndex((entry) => sanitizeSlashCommandId(entry.id) === id);
  if (index < 0) throw new Error(`Agent "${id}" was not found.`);
  const nextAgent = normalizeAgentInput({ ...agents[index], ...patch }, agents[index]);
  agents[index] = nextAgent;
  return (persistStore({ ...store, agents }), decorateAgent(nextAgent));
}

export function updateRuntime(agentId, fields = {}) {
  const id = sanitizeSlashCommandId(agentId),
    store = loadStore(),
    agents = Array.isArray(store.agents) ? store.agents : [],
    index = agents.findIndex((entry) => sanitizeSlashCommandId(entry.id) === id);
  if (index < 0) return null;
  const nextAgent = {
    ...agents[index],
    ...fields,
    updatedAt: new Date().toISOString(),
  };
  agents[index] = nextAgent;
  return (persistStore({ ...store, agents }), decorateAgent(nextAgent));
}

export function remove(agentId) {
  const id = sanitizeSlashCommandId(agentId),
    store = loadStore();
  store.agents = (Array.isArray(store.agents) ? store.agents : []).filter(
    (entry) => sanitizeSlashCommandId(entry.id) !== id,
  );
  persistStore(store);
}
