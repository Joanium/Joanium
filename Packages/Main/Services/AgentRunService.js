import { loadJson, persistJson } from '../Core/FileSystem.js';
import Paths from '../Core/Paths.js';

const MAX_RUNS = 5000;
const runningJobs = new Map();

function loadStore() {
  const store = loadJson(Paths.AGENT_RUNS_FILE, { runs: [] });
  let changed = false;
  const runs = (Array.isArray(store?.runs) ? store.runs : []).map((run) => {
    if ('running' !== run?.status) return run;
    changed = true;
    return {
      ...run,
      status: 'error',
      finishedAt: run.finishedAt ?? new Date().toISOString(),
      error: run.error || 'The app closed before this agent run finished.',
    };
  });
  changed && persistJson(Paths.AGENT_RUNS_FILE, { runs });
  return { runs };
}

function persistStore(store) {
  persistJson(Paths.AGENT_RUNS_FILE, {
    runs: (Array.isArray(store?.runs) ? store.runs : []).slice(-MAX_RUNS),
  });
}

function cloneRunningJob(job = {}) {
  return { ...job, trigger: job.trigger ? { ...job.trigger } : null };
}

export function listRuns(limit = 500) {
  const store = loadStore();
  return [...(Array.isArray(store.runs) ? store.runs : [])]
    .sort(
      (left, right) =>
        new Date(right.startedAt ?? right.timestamp ?? 0) -
        new Date(left.startedAt ?? left.timestamp ?? 0),
    )
    .slice(0, Math.max(1, Number(limit) || 500));
}

export function listRunning() {
  return [...runningJobs.values()].map(cloneRunningJob);
}

export function startRun(run = {}) {
  const startedAt = run.startedAt ?? new Date().toISOString(),
    record = {
      id: String(run.id ?? `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`),
      agentId: String(run.agentId ?? '').trim(),
      agentName: String(run.agentName ?? 'Agent').trim() || 'Agent',
      source: String(run.source ?? 'manual').trim() || 'manual',
      status: 'running',
      type: 'agent',
      sourceLabel: String(run.sourceLabel ?? run.agentName ?? 'Agent').trim() || 'Agent',
      jobName: String(run.jobName ?? '').trim() || null,
      trigger: run.trigger ?? null,
      workspacePath: String(run.workspacePath ?? '').trim() || null,
      projectId: String(run.projectId ?? '').trim() || null,
      startedAt,
      timestamp: startedAt,
      provider: String(run.provider ?? '').trim() || null,
      model: String(run.model ?? '').trim() || null,
      summary: '',
      fullResponse: '',
      error: null,
      inputTokens: 0,
      outputTokens: 0,
      finishedAt: null,
    },
    store = loadStore();
  store.runs = [...(Array.isArray(store.runs) ? store.runs : []), record];
  persistStore(store);
  runningJobs.set(record.id, {
    type: 'agent',
    jobId: record.id,
    agentId: record.agentId,
    jobName: record.agentName,
    source: record.sourceLabel,
    startedAt,
    trigger: record.trigger,
  });
  return record;
}

export function finishRun(runId, patch = {}) {
  const id = String(runId ?? '').trim(),
    store = loadStore(),
    runs = Array.isArray(store.runs) ? store.runs : [],
    index = runs.findIndex((entry) => String(entry.id) === id);
  if (index < 0) return null;
  const finishedAt = patch.finishedAt ?? new Date().toISOString(),
    nextRun = {
      ...runs[index],
      ...patch,
      id,
      type: 'agent',
      status: String(patch?.status ?? runs[index].status ?? 'success'),
      finishedAt,
      timestamp: runs[index].startedAt ?? runs[index].timestamp ?? finishedAt,
      inputTokens: Number(patch?.inputTokens ?? runs[index].inputTokens ?? 0) || 0,
      outputTokens: Number(patch?.outputTokens ?? runs[index].outputTokens ?? 0) || 0,
    };
  runs[index] = nextRun;
  persistStore({ runs });
  runningJobs.delete(id);
  return nextRun;
}

export function clearRuns() {
  persistStore({ runs: [] });
  runningJobs.clear();
}
