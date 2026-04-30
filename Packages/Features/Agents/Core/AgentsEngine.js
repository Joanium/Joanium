import { randomUUID } from 'crypto';
import defineEngine from '../../../System/Contracts/DefineEngine.js';
import { shouldRunNow } from './Scheduling.js';
const DEFAULT_TRIGGER = { type: 'interval', minutes: 30 };
// Maximum time a single agent run is allowed to take before it is forcibly
// cancelled. 24 hours gives long-running agentic tasks (deep research, large
// codebases, multi-step automation) enough headroom without hanging forever.
const MAX_AGENT_RUN_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
function normalizeTrigger(trigger = {}) {
  const type = trigger?.type ?? DEFAULT_TRIGGER.type;
  return 'interval' === type
    ? { type: type, minutes: Math.max(1, parseInt(trigger.minutes, 10) || DEFAULT_TRIGGER.minutes) }
    : 'daily' === type
      ? { type: type, time: trigger.time || '09:00' }
      : 'weekly' === type
        ? { type: type, day: trigger.day || 'monday', time: trigger.time || '09:00' }
        : 'hourly' === type || 'on_startup' === type
          ? { type: type }
          : { ...DEFAULT_TRIGGER };
}
function normalizeWorkspacePath(workspacePath) {
  return String(workspacePath ?? '').trim() || null;
}
function normalizeProjectSnapshot(project) {
  if (!project || 'object' != typeof project) return null;
  const rootPath = normalizeWorkspacePath(project.rootPath);
  return rootPath
    ? {
        id: project.id ? String(project.id) : null,
        name: String(project.name ?? '').trim() || 'Workspace',
        rootPath: rootPath,
        context: String(project.context ?? '').trim(),
      }
    : null;
}
function normalizeHistory(history = []) {
  return Array.isArray(history)
    ? history.slice(0, 30).map((entry) => ({
        timestamp: entry?.timestamp ?? new Date().toISOString(),
        status: 'error' === entry?.status ? 'error' : 'success',
        summary: String(entry?.summary ?? ''),
        fullResponse: String(entry?.fullResponse ?? ''),
        error: entry?.error ? String(entry.error) : null,
        usedProvider: entry?.usedProvider ? String(entry.usedProvider) : null,
        usedModel: entry?.usedModel ? String(entry.usedModel) : null,
        usage: entry?.usage ?? null,
        triggerKind: entry?.triggerKind ? String(entry.triggerKind) : null,
      }))
    : [];
}
function normalizeAgent(agent = {}) {
  return {
    id: String(agent.id ?? ''),
    name: String(agent.name ?? '').trim(),
    description: String(agent.description ?? '').trim(),
    prompt: String(agent.prompt ?? '').trim(),
    enabled: !1 !== agent.enabled,
    primaryModel:
      ((model = agent.primaryModel),
      model?.provider && model?.modelId
        ? { provider: String(model.provider), modelId: String(model.modelId) }
        : null),
    trigger: normalizeTrigger(agent.trigger ?? agent.schedule),
    workspacePath: normalizeWorkspacePath(agent.workspacePath ?? agent.project?.rootPath),
    project: normalizeProjectSnapshot(agent.project),
    history: normalizeHistory(agent.history),
    lastRun: agent.lastRun ?? null,
  };
  var model;
}
function stripRuntimeFields(agent = {}) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    prompt: agent.prompt,
    enabled: agent.enabled,
    primaryModel: agent.primaryModel,
    trigger: agent.trigger,
    workspacePath: agent.workspacePath ?? null,
    project: agent.project ?? null,
  };
}
export class AgentsEngine {
  constructor(storage) {
    ((this.storage = storage),
      (this.agents = []),
      (this._ticker = null),
      (this._running = new Map()),
      (this._pending = new Map()),
      (this._queue = []),
      (this._queuedAgentIds = new Set()),
      (this._mainWindow = null),
      (this._startupDispatched = !1));
  }
  attachWindow(windowRef) {
    windowRef &&
      ((this._mainWindow = windowRef),
      (this._startupDispatched = !1),
      windowRef.on?.('closed', () => {
        this._mainWindow === windowRef &&
          ((this._mainWindow = null), (this._startupDispatched = !1));
      }),
      this._runStartupAgents());
  }
  start() {
    (this._load(), (this._ticker = setInterval(() => this._checkScheduled(), 6e4)));
  }
  stop() {
    this._ticker && (clearInterval(this._ticker), (this._ticker = null));
    for (const [, pending] of this._pending) pending.reject(new Error('App shutting down'));
    for (this._pending.clear(); this._queue.length; ) {
      const task = this._queue.shift();
      (this._queuedAgentIds.delete(task.agentId), task.reject(new Error('App shutting down')));
    }
  }
  reload() {
    this._load();
  }
  getAll() {
    return (this._load(), this.agents);
  }
  getRunning() {
    return Array.from(this._running.values());
  }
  clearAllHistory() {
    this._load();
    for (const agent of this.agents) ((agent.history = []), (agent.lastRun = null));
    this._persist();
  }
  saveAgent(agent) {
    this._load();
    const normalized = normalizeAgent(agent);
    if (!normalized.id) throw new Error('Agent id is required.');
    if (!normalized.name) throw new Error('Agent name is required.');
    if (!normalized.prompt) throw new Error('Agent prompt is required.');
    if (!normalized.primaryModel) throw new Error('Choose a primary model.');
    const index = this.agents.findIndex((item) => item.id === normalized.id);
    if (index >= 0) {
      const existing = this.agents[index];
      this.agents[index] = {
        ...existing,
        ...normalized,
        history: existing.history ?? [],
        lastRun: existing.lastRun ?? null,
      };
    } else this.agents.push({ ...normalized, history: [], lastRun: null });
    return (this._persist(), this.agents.find((item) => item.id === normalized.id) ?? normalized);
  }
  deleteAgent(id) {
    (this._load(), (this.agents = this.agents.filter((agent) => agent.id !== id)), this._persist());
  }
  toggleAgent(id, enabled) {
    this._load();
    const agent = this.agents.find((item) => item.id === id);
    agent && ((agent.enabled = Boolean(enabled)), this._persist());
  }
  async runNow(agentId) {
    this._load();
    const agent = this.agents.find((item) => item.id === agentId);
    if (!agent) throw new Error(`Agent "${agentId}" not found.`);
    if (this._running.has(agent.id) || this._queuedAgentIds.has(agent.id))
      throw new Error('This agent is already running.');
    return (await this._enqueueAgentRun(agent.id, 'manual'), { ok: !0 });
  }
  resolveRun(requestId, payload) {
    const pending = this._pending.get(requestId);
    pending && (this._pending.delete(requestId), pending.resolve(payload));
  }
  _load() {
    try {
      const data = this.storage.load(() => ({ agents: [] })),
        agents = Array.isArray(data?.agents) ? data.agents : [];
      this.agents = agents.map((agent) => normalizeAgent(agent)).filter((agent) => agent.id);
    } catch (err) {
      (console.error('[AgentsEngine] _load error:', err), (this.agents = []));
    }
  }
  _persist() {
    try {
      this.storage.save({ agents: this.agents });
    } catch (err) {
      console.error('[AgentsEngine] _persist error:', err);
    }
  }
  _runStartupAgents() {
    if (this._mainWindow && !this._startupDispatched) {
      this._startupDispatched = !0;
      for (const agent of this.agents)
        agent.enabled &&
          'on_startup' === agent.trigger?.type &&
          (this._running.has(agent.id) ||
            this._queuedAgentIds.has(agent.id) ||
            this._enqueueAgentRun(agent.id, 'startup'));
    }
  }
  _checkScheduled() {
    if (!this._mainWindow) return;
    const now = new Date();
    for (const agent of this.agents)
      agent.enabled &&
        'on_startup' !== agent.trigger?.type &&
        (this._running.has(agent.id) ||
          this._queuedAgentIds.has(agent.id) ||
          (shouldRunNow(
            { trigger: agent.trigger ?? DEFAULT_TRIGGER, lastRun: agent.lastRun ?? null },
            now,
          ) &&
            this._enqueueAgentRun(agent.id, 'scheduled')));
  }
  _findLiveAgent(agentId) {
    return this.agents.find((item) => item.id === agentId) ?? null;
  }
  _enqueueAgentRun(agentId, triggerKind = 'scheduled') {
    if (this._running.has(agentId))
      return Promise.resolve({ ok: !1, skipped: !0, reason: 'already running' });
    const queuedTask = this._queue.find((task) => task.agentId === agentId);
    if (queuedTask) return queuedTask.promise;
    let resolveTask, rejectTask;
    const promise = new Promise((resolve, reject) => {
      ((resolveTask = resolve), (rejectTask = reject));
    });
    return (
      this._queue.push({
        agentId: agentId,
        triggerKind: triggerKind,
        promise: promise,
        resolve: resolveTask,
        reject: rejectTask,
      }),
      this._queuedAgentIds.add(agentId),
      this._drainQueue(),
      promise
    );
  }
  _drainQueue() {
    for (; this._running.size < 3 && this._queue.length; ) {
      const task = this._queue.shift();
      this._queuedAgentIds.delete(task.agentId);
      const agent = this._findLiveAgent(task.agentId);
      agent
        ? 'manual' === task.triggerKind || agent.enabled
          ? this._executeAgent(agent, task.triggerKind)
              .then(task.resolve)
              .catch(task.reject)
              .finally(() => this._drainQueue())
          : task.resolve({ ok: !1, skipped: !0, reason: 'disabled' })
        : task.resolve({ ok: !1, skipped: !0, reason: 'missing agent' });
    }
  }
  _dispatchToRenderer(agent, triggerKind) {
    return new Promise((resolve, reject) => {
      if (!this._mainWindow || this._mainWindow.isDestroyed())
        return void reject(new Error('App window not available.'));
      const requestId = randomUUID(),
        timeoutHours = Math.round(MAX_AGENT_RUN_TIMEOUT_MS / 3600000),
        timer = setTimeout(() => {
          (this._pending.delete(requestId),
            reject(new Error(`Scheduled agent run timed out after ${timeoutHours} hours.`)));
        }, MAX_AGENT_RUN_TIMEOUT_MS);
      (this._pending.set(requestId, {
        resolve: (payload) => {
          (clearTimeout(timer), resolve(payload));
        },
        reject: (err) => {
          (clearTimeout(timer), reject(err));
        },
      }),
        this._mainWindow.webContents.send('scheduled-agent-run', {
          requestId: requestId,
          triggerKind: triggerKind,
          agent: stripRuntimeFields(agent),
        }));
    });
  }
  async _executeAgent(agent, triggerKind = 'scheduled') {
    const runKey = agent.id;
    if (this._running.has(runKey)) return { ok: !1, skipped: !0, reason: 'already running' };
    const startedAt = new Date().toISOString();
    this._running.set(runKey, {
      agentId: agent.id,
      agentName: agent.name,
      jobId: agent.id,
      jobName: 'Scheduled run',
      startedAt: startedAt,
      trigger: agent.trigger ?? null,
      type: 'agent',
      mode: 'agentic',
      triggerKind: triggerKind,
    });
    const entry = {
      timestamp: startedAt,
      status: 'success',
      summary: '',
      fullResponse: '',
      error: null,
      usedProvider: null,
      usedModel: null,
      usage: null,
      triggerKind: triggerKind,
    };
    try {
      const result = await this._dispatchToRenderer(agent, triggerKind);
      if (!result?.ok) throw new Error(result?.error ?? 'Scheduled agent run failed.');
      const finalText = String(result.text ?? '').trim();
      ((entry.fullResponse = finalText),
        (entry.summary = (function (text) {
          const trimmed = String(text ?? '').trim();
          return trimmed ? trimmed.slice(0, 400) : 'Completed without a final response.';
        })(finalText)),
        (entry.usedProvider = result.usedProvider ?? null),
        (entry.usedModel = result.usedModel ?? null),
        (entry.usage = result.usage ?? null));
    } catch (err) {
      ((entry.status = 'error'),
        (entry.error = (function (err) {
          return err instanceof Error ? err.message : String(err ?? 'Unknown error');
        })(err)),
        (entry.summary = `Error: ${entry.error}`),
        console.error(`[AgentsEngine] "${agent.name}" failed:`, entry.error));
    } finally {
      this._running.delete(runKey);
    }
    const liveAgent = this.agents.find((item) => item.id === agent.id);
    if (liveAgent)
      return (
        Array.isArray(liveAgent.history) || (liveAgent.history = []),
        liveAgent.history.unshift(entry),
        liveAgent.history.length > 30 && (liveAgent.history = liveAgent.history.slice(0, 30)),
        (liveAgent.lastRun = entry.timestamp),
        this._persist(),
        { ok: 'error' !== entry.status, skipped: !1, entry: entry }
      );
    console.warn(`[AgentsEngine] Agent "${agent.id}" was removed before history could be saved.`);
  }
}
export const engineMeta = defineEngine({
  id: 'agents',
  provides: 'agentsEngine',
  needs: ['featureStorage'],
  storage: { key: 'agenticAgents', featureKey: 'agenticAgents', fileName: 'AgenticAgents.json' },
  create: ({ featureStorage: featureStorage }) =>
    new AgentsEngine(featureStorage.get('agenticAgents')),
});
