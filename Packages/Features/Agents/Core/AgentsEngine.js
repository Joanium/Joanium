import { randomUUID } from 'crypto';

import defineEngine from '../../../System/Contracts/DefineEngine.js';
import { shouldRunNow } from '../../Automation/Scheduling/Scheduling.js';

const RUN_TIMEOUT_MS = 10 * 60_000;
const MAX_HISTORY = 30;
const DEFAULT_TRIGGER = { type: 'interval', minutes: 30 };

function normalizeTrigger(trigger = {}) {
  const type = trigger?.type ?? DEFAULT_TRIGGER.type;

  if (type === 'interval') {
    return {
      type,
      minutes: Math.max(1, parseInt(trigger.minutes, 10) || DEFAULT_TRIGGER.minutes),
    };
  }

  if (type === 'daily') {
    return { type, time: trigger.time || '09:00' };
  }

  if (type === 'weekly') {
    return {
      type,
      day: trigger.day || 'monday',
      time: trigger.time || '09:00',
    };
  }

  if (type === 'hourly' || type === 'on_startup') {
    return { type };
  }

  return { ...DEFAULT_TRIGGER };
}

function normalizeModelSelection(model) {
  if (!model?.provider || !model?.modelId) return null;
  return {
    provider: String(model.provider),
    modelId: String(model.modelId),
  };
}

function normalizeFallbacks(fallbacks = []) {
  return fallbacks.map((fallback) => normalizeModelSelection(fallback)).filter(Boolean);
}

function normalizeHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history.slice(0, MAX_HISTORY).map((entry) => ({
    timestamp: entry?.timestamp ?? new Date().toISOString(),
    status: entry?.status === 'error' ? 'error' : 'success',
    summary: String(entry?.summary ?? ''),
    fullResponse: String(entry?.fullResponse ?? ''),
    error: entry?.error ? String(entry.error) : null,
    usedProvider: entry?.usedProvider ? String(entry.usedProvider) : null,
    usedModel: entry?.usedModel ? String(entry.usedModel) : null,
    usage: entry?.usage ?? null,
    triggerKind: entry?.triggerKind ? String(entry.triggerKind) : null,
  }));
}

function normalizeAgent(agent = {}) {
  return {
    id: String(agent.id ?? ''),
    name: String(agent.name ?? '').trim(),
    description: String(agent.description ?? '').trim(),
    prompt: String(agent.prompt ?? '').trim(),
    enabled: agent.enabled !== false,
    primaryModel: normalizeModelSelection(agent.primaryModel),
    fallbackModels: normalizeFallbacks(agent.fallbackModels),
    trigger: normalizeTrigger(agent.trigger ?? agent.schedule),
    history: normalizeHistory(agent.history),
    lastRun: agent.lastRun ?? null,
  };
}

function summarizeResponse(text) {
  const trimmed = String(text ?? '').trim();
  return trimmed ? trimmed.slice(0, 400) : 'Completed without a final response.';
}

function getErrorMessage(err) {
  return err instanceof Error ? err.message : String(err ?? 'Unknown error');
}

function stripRuntimeFields(agent = {}) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    prompt: agent.prompt,
    enabled: agent.enabled,
    primaryModel: agent.primaryModel,
    fallbackModels: agent.fallbackModels,
    trigger: agent.trigger,
  };
}

export class AgentsEngine {
  constructor(storage) {
    this.storage = storage;
    this.agents = [];
    this._ticker = null;
    this._running = new Map();
    this._pending = new Map();
    this._mainWindow = null;
    this._startupDispatched = false;
  }

  attachWindow(windowRef) {
    if (!windowRef) return;

    this._mainWindow = windowRef;
    this._startupDispatched = false;

    windowRef.on?.('closed', () => {
      if (this._mainWindow === windowRef) {
        this._mainWindow = null;
        this._startupDispatched = false;
      }
    });

    this._runStartupAgents();
  }

  start() {
    this._load();
    this._ticker = setInterval(() => this._checkScheduled(), 60_000);
  }

  stop() {
    if (this._ticker) {
      clearInterval(this._ticker);
      this._ticker = null;
    }

    for (const [, pending] of this._pending) {
      pending.reject(new Error('App shutting down'));
    }
    this._pending.clear();
  }

  reload() {
    this._load();
  }

  getAll() {
    this._load();
    return this.agents;
  }

  getRunning() {
    return Array.from(this._running.values());
  }

  clearAllHistory() {
    this._load();
    for (const agent of this.agents) {
      agent.history = [];
      agent.lastRun = null;
    }
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
    } else {
      this.agents.push({
        ...normalized,
        history: [],
        lastRun: null,
      });
    }

    this._persist();
    return this.agents.find((item) => item.id === normalized.id) ?? normalized;
  }

  deleteAgent(id) {
    this._load();
    this.agents = this.agents.filter((agent) => agent.id !== id);
    this._persist();
  }

  toggleAgent(id, enabled) {
    this._load();
    const agent = this.agents.find((item) => item.id === id);
    if (!agent) return;
    agent.enabled = Boolean(enabled);
    this._persist();
  }

  async runNow(agentId) {
    this._load();
    const agent = this.agents.find((item) => item.id === agentId);
    if (!agent) throw new Error(`Agent "${agentId}" not found.`);
    if (this._running.has(agent.id)) throw new Error('This agent is already running.');
    await this._executeAgent(agent, 'manual');
    return { ok: true };
  }

  resolveRun(requestId, payload) {
    const pending = this._pending.get(requestId);
    if (!pending) return;
    this._pending.delete(requestId);
    pending.resolve(payload);
  }

  _load() {
    try {
      const data = this.storage.load(() => ({ agents: [] }));
      const agents = Array.isArray(data?.agents) ? data.agents : [];
      this.agents = agents.map((agent) => normalizeAgent(agent)).filter((agent) => agent.id);
    } catch (err) {
      console.error('[AgentsEngine] _load error:', err);
      this.agents = [];
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
    if (!this._mainWindow || this._startupDispatched) return;

    this._startupDispatched = true;
    for (const agent of this.agents) {
      if (!agent.enabled) continue;
      if (agent.trigger?.type !== 'on_startup') continue;
      if (this._running.has(agent.id)) continue;
      this._executeAgent(agent, 'startup');
    }
  }

  _checkScheduled() {
    if (!this._mainWindow) return;

    const now = new Date();
    for (const agent of this.agents) {
      if (!agent.enabled) continue;
      if (agent.trigger?.type === 'on_startup') continue;
      if (this._running.has(agent.id)) continue;

      if (
        shouldRunNow(
          {
            trigger: agent.trigger ?? DEFAULT_TRIGGER,
            lastRun: agent.lastRun ?? null,
          },
          now,
        )
      ) {
        this._executeAgent(agent, 'scheduled');
      }
    }
  }

  _dispatchToRenderer(agent, triggerKind) {
    return new Promise((resolve, reject) => {
      if (!this._mainWindow || this._mainWindow.isDestroyed()) {
        reject(new Error('App window not available.'));
        return;
      }

      const requestId = randomUUID();
      const timer = setTimeout(() => {
        this._pending.delete(requestId);
        reject(new Error('Scheduled agent run timed out after 10 minutes.'));
      }, RUN_TIMEOUT_MS);

      this._pending.set(requestId, {
        resolve: (payload) => {
          clearTimeout(timer);
          resolve(payload);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this._mainWindow.webContents.send('scheduled-agent-run', {
        requestId,
        triggerKind,
        agent: stripRuntimeFields(agent),
      });
    });
  }

  async _executeAgent(agent, triggerKind = 'scheduled') {
    const runKey = agent.id;
    if (this._running.has(runKey)) return;

    const startedAt = new Date().toISOString();
    this._running.set(runKey, {
      agentId: agent.id,
      agentName: agent.name,
      jobId: agent.id,
      jobName: 'Scheduled run',
      startedAt,
      trigger: agent.trigger ?? null,
      type: 'agent',
      mode: 'agentic',
      triggerKind,
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
      triggerKind,
    };

    try {
      const result = await this._dispatchToRenderer(agent, triggerKind);
      if (!result?.ok) {
        throw new Error(result?.error ?? 'Scheduled agent run failed.');
      }

      const finalText = String(result.text ?? '').trim();
      entry.fullResponse = finalText;
      entry.summary = summarizeResponse(finalText);
      entry.usedProvider = result.usedProvider ?? null;
      entry.usedModel = result.usedModel ?? null;
      entry.usage = result.usage ?? null;
    } catch (err) {
      entry.status = 'error';
      entry.error = getErrorMessage(err);
      entry.summary = `Error: ${entry.error}`;
      console.error(`[AgentsEngine] "${agent.name}" failed:`, entry.error);
    } finally {
      this._running.delete(runKey);
    }

    const liveAgent = this.agents.find((item) => item.id === agent.id);
    if (!liveAgent) {
      console.warn(`[AgentsEngine] Agent "${agent.id}" was removed before history could be saved.`);
      return;
    }

    if (!Array.isArray(liveAgent.history)) liveAgent.history = [];
    liveAgent.history.unshift(entry);
    if (liveAgent.history.length > MAX_HISTORY) {
      liveAgent.history = liveAgent.history.slice(0, MAX_HISTORY);
    }
    liveAgent.lastRun = entry.timestamp;
    this._persist();
  }
}

export const engineMeta = defineEngine({
  id: 'agents',
  provides: 'agentsEngine',
  needs: ['featureStorage'],
  storage: {
    key: 'agenticAgents',
    featureKey: 'agenticAgents',
    fileName: 'AgenticAgents.json',
  },
  create: ({ featureStorage }) => new AgentsEngine(featureStorage.get('agenticAgents')),
});
