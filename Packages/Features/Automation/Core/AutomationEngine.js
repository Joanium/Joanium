import path from 'path';
import { fileURLToPath } from 'url';

import defineEngine from '../../../System/Contracts/DefineEngine.js';
import { loadActions } from './loadActions.js';
import { shouldRunNow } from '../Scheduling/Scheduling.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ACTIONS_DIR = path.resolve(__dirname, '..', 'Actions');

// ACTION DISPATCHER
export async function runAction(action, connectorEngine = null) {
  if (!action?.type) return;

  if (!runAction._map) {
    runAction._map = await loadActions(ACTIONS_DIR);
  }

  const handler = runAction._map.get(action.type);
  if (handler) {
    return handler(action);
  }

  console.warn(`[AutomationEngine] Unknown action type: "${action.type}"`);
}

// AUTOMATION ENGINE CLASS
export class AutomationEngine {
  constructor(storage, connectorEngine = null, featureRegistry = null) {
    this.storage = storage;
    this.connectorEngine = connectorEngine;
    this.featureRegistry = featureRegistry;
    this.automations = [];
    this._ticker = null;
    this._running = new Set();
  }

  start() {
    this._load();
    this._runStartupAutomations();
    this._ticker = setInterval(() => this._checkScheduled(), 60_000);
  }

  stop() {
    if (this._ticker) {
      clearInterval(this._ticker);
      this._ticker = null;
    }
  }

  reload() {
    this._load();
  }

  getAll() {
    this._load();
    return this.automations;
  }

  saveAutomation(automation) {
    this._load();
    const idx = this.automations.findIndex((a) => a.id === automation.id);
    if (idx >= 0) this.automations[idx] = { ...this.automations[idx], ...automation };
    else this.automations.push(automation);
    this._persist();
    return automation;
  }

  deleteAutomation(id) {
    this._load();
    this.automations = this.automations.filter((a) => a.id !== id);
    this._persist();
  }

  toggleAutomation(id, enabled) {
    this._load();
    const a = this.automations.find((a) => a.id === id);
    if (a) {
      a.enabled = Boolean(enabled);
      this._persist();
    }
  }

  clearAllHistory() {
    this._load();
    for (const auto of this.automations) {
      auto.history = [];
      auto.lastRun = null;
    }
    this._persist();
  }

  _load() {
    try {
      const data = this.storage.load(() => ({ automations: [] }));
      this.automations = Array.isArray(data?.automations) ? data.automations : [];
    } catch (err) {
      console.error('[AutomationEngine] _load error:', err);
      this.automations = [];
    }
  }

  _persist() {
    try {
      this.storage.save({ automations: this.automations });
    } catch (err) {
      console.error('[AutomationEngine] _persist error:', err);
    }
  }

  _runStartupAutomations() {
    const targets = this.automations.filter((a) => a.enabled && a.trigger?.type === 'on_startup');
    for (const a of targets) this._execute(a);
  }

  _checkScheduled() {
    const now = new Date();
    for (const a of this.automations) {
      if (a.enabled && !this._running.has(a.id) && shouldRunNow(a, now)) this._execute(a);
    }
  }

  async _execute(automation) {
    const automationId = automation.id;
    this._running.add(automationId);

    const entry = {
      timestamp: new Date().toISOString(),
      status: 'success',
      summary: '',
      error: null,
    };

    try {
      const actionTypes = [];
      for (const action of automation.actions ?? []) {
        const featureResult = await this.featureRegistry?.runAutomationAction?.(action, {
          connectorEngine: this.connectorEngine,
        });
        if (featureResult?.handled) {
          await featureResult.result;
        } else {
          await runAction(action, this.connectorEngine);
        }
        if (action.type) actionTypes.push(action.type);
      }
      entry.summary = actionTypes.length
        ? `Ran: ${actionTypes.join(', ')}`
        : 'Automation executed (no actions)';
    } catch (err) {
      entry.status = 'error';
      entry.error = err.message;
      entry.summary = `Error: ${err.message}`;
      console.error(`[AutomationEngine] Error in "${automation.name}":`, err);
    } finally {
      this._running.delete(automationId);
    }

    const live = this.automations.find((a) => a.id === automationId);
    if (live) {
      if (!Array.isArray(live.history)) live.history = [];
      live.history.unshift(entry);
      if (live.history.length > 30) live.history = live.history.slice(0, 30);
      live.lastRun = entry.timestamp;
      this._persist();
    } else {
      console.warn(
        `[AutomationEngine] Automation ${automationId} not found after run — was it deleted?`,
      );
    }
  }
}

export const engineMeta = defineEngine({
  id: 'automation',
  provides: 'automationEngine',
  needs: ['connectorEngine', 'featureRegistry', 'featureStorage'],
  storage: {
    key: 'Automations',
    featureKey: 'Automations',
    fileName: 'Automations.json',
  },
  create: ({ connectorEngine, featureRegistry, featureStorage }) =>
    new AutomationEngine(featureStorage.get('Automations'), connectorEngine, featureRegistry),
});
