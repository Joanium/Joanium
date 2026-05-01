import { buildMinuteKey, scheduleMatchesDate } from '../../../System/Agents/Schedule.js';
import { executeSavedAgent, trackSavedAgentUsage } from './AgentExecution.js';

let initialized = false,
  backendReady = false,
  refreshTimer = null,
  startupHandled = false,
  refreshInFlight = null,
  cachedAgents = [],
  runningByAgentId = new Map();

function dispatchRuntimeUpdate(detail = {}) {
  window.dispatchEvent(new CustomEvent('jo:agents-runtime-updated', { detail }));
}

function patchCachedAgent(agentId, patch = {}) {
  cachedAgents = cachedAgents.map((entry) =>
    entry.id === agentId ? { ...entry, ...patch } : entry,
  );
}

function scheduleNextTick(delayMs = 20_000) {
  refreshTimer && clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    checkDueAgents().catch((error) => console.warn('[Agents] Scheduler tick failed:', error));
  }, delayMs);
}

async function refreshAgents() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const result = await window.electronAPI?.invoke?.('get-agents');
    cachedAgents = Array.isArray(result) ? result : [];
    dispatchRuntimeUpdate({ reason: 'refresh', agents: cachedAgents });
    return cachedAgents;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function isSameMinute(iso, date = new Date()) {
  return iso ? buildMinuteKey(iso) === buildMinuteKey(date) : false;
}

function shouldRunCronAgent(agent, now = new Date()) {
  return (
    agent?.enabled &&
    'cron' === agent?.schedule?.type &&
    scheduleMatchesDate(agent.schedule, now) &&
    !runningByAgentId.has(agent.id) &&
    !('schedule' === agent.lastRunSource && isSameMinute(agent.lastRunAt, now))
  );
}

async function maybeRunStartupAgents() {
  if (startupHandled) return;
  startupHandled = true;
  for (const agent of cachedAgents.filter(
    (entry) => entry?.enabled && 'on_startup' === entry?.schedule?.type,
  )) {
    await runAgent(agent.id, { source: 'startup' });
  }
}

async function checkDueAgents() {
  if (!backendReady) return void scheduleNextTick();
  await refreshAgents();
  await maybeRunStartupAgents();
  const now = new Date();
  for (const agent of cachedAgents.filter((entry) => shouldRunCronAgent(entry, now))) {
    await runAgent(agent.id, { source: 'schedule' });
  }
  scheduleNextTick();
}

export async function listAgents({ refresh = false } = {}) {
  return refresh || 0 === cachedAgents.length ? refreshAgents() : cachedAgents;
}

export async function getAgent(agentId, { refresh = false } = {}) {
  const agents = await listAgents({ refresh });
  return agents.find((entry) => entry.id === agentId) ?? null;
}

export async function findAgentByCommand(text = '', { refresh = false } = {}) {
  const id = String(text ?? '')
    .trim()
    .match(/^\/([a-z0-9_]+)$/i)?.[1]
    ?.toLowerCase();
  if (!id) return null;
  return getAgent(id, { refresh });
}

export async function runAgent(agentId, { source = 'manual', signal = null } = {}) {
  const agent = await getAgent(agentId, { refresh: true });
  if (!agent) throw new Error(`Agent "${agentId}" was not found.`);
  if (runningByAgentId.has(agent.id)) return runningByAgentId.get(agent.id);
  const promise = (async () => {
    const startedAt = new Date().toISOString(),
      runStart = await window.electronAPI?.invoke?.('start-agent-run', {
        agentId: agent.id,
        agentName: agent.name,
        source,
        sourceLabel: agent.name,
        trigger: agent.schedule,
        workspacePath: agent.workspace?.workspacePath ?? null,
        projectId: agent.workspace?.projectId ?? null,
        provider: agent.primaryModel?.provider ?? null,
        model: agent.primaryModel?.modelId ?? null,
        startedAt,
      });
    if (!runStart?.ok || !runStart.run)
      throw new Error(runStart?.error || 'Could not start agent run.');
    patchCachedAgent(agent.id, {
      lastRunAt: startedAt,
      lastRunStatus: 'running',
      lastRunSource: source,
      lastRunError: null,
    });
    await window.electronAPI?.invoke?.('update-agent-runtime', agent.id, {
      lastRunAt: startedAt,
      lastRunStatus: 'running',
      lastRunSource: source,
      lastRunError: null,
    });
    dispatchRuntimeUpdate({ reason: 'run-start', agentId: agent.id, source });
    try {
      const result = await executeSavedAgent(agent, { signal });
      await trackSavedAgentUsage(agent, result.usage, result.usedProvider, result.usedModel);
      await window.electronAPI?.invoke?.('finish-agent-run', runStart.run.id, {
        status: 'success',
        provider: result.usedProvider?.provider ?? null,
        model: result.usedModel ?? null,
        summary: result.text.slice(0, 220),
        fullResponse: result.text,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        finishedAt: new Date().toISOString(),
      });
      const runtimePatch = {
        lastRunAt: new Date().toISOString(),
        lastRunStatus: 'success',
        lastRunSource: source,
        lastRunError: null,
        lastRunSummary: result.text.slice(0, 220),
        lastRunModel: result.usedModel ?? null,
        lastRunProvider: result.usedProvider?.provider ?? null,
      };
      patchCachedAgent(agent.id, runtimePatch);
      await window.electronAPI?.invoke?.('update-agent-runtime', agent.id, runtimePatch);
      dispatchRuntimeUpdate({ reason: 'run-finish', agentId: agent.id, source, status: 'success' });
      return result;
    } catch (error) {
      const runtimePatch = {
        lastRunAt: new Date().toISOString(),
        lastRunStatus: 'error',
        lastRunSource: source,
        lastRunError: error.message,
      };
      await window.electronAPI?.invoke?.('finish-agent-run', runStart.run.id, {
        status: 'error',
        error: error.message,
        finishedAt: new Date().toISOString(),
      });
      patchCachedAgent(agent.id, runtimePatch);
      await window.electronAPI?.invoke?.('update-agent-runtime', agent.id, runtimePatch);
      dispatchRuntimeUpdate({ reason: 'run-finish', agentId: agent.id, source, status: 'error' });
      throw error;
    }
  })().finally(() => {
    runningByAgentId.delete(agent.id);
  });
  runningByAgentId.set(agent.id, promise);
  return promise;
}

export function initAgentManager() {
  if (initialized) return window.joaniumAgents;
  initialized = true;
  const bootstrap = async () => {
    backendReady = true;
    await checkDueAgents();
  };
  window.electronAPI?.on?.('backend-ready', () => {
    bootstrap().catch((error) => console.warn('[Agents] Backend bootstrap failed:', error));
  });
  bootstrap().catch(() => {});
  window.addEventListener('jo:agents-changed', () => {
    refreshAgents().catch(() => {});
  });
  window.joaniumAgents = {
    listAgents,
    getAgent,
    findAgentByCommand,
    runAgent,
    refreshAgents,
  };
  return window.joaniumAgents;
}
