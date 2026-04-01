const MAX_EVENTS = 200;

/**
 * Fetch and normalize all historical events from agents and automations.
 * Returns a flat array sorted newest-first, capped at MAX_EVENTS.
 */
export async function fetchHistory() {
  const events = [];

  try {
    const res = await window.electronAPI?.getAgents?.();
    const agents = Array.isArray(res?.agents) ? res.agents : [];
    for (const agent of agents) {
      for (const job of agent.jobs ?? []) {
        for (const entry of job.history ?? []) {
          const status = entry.error
            ? 'error'
            : (entry.nothingToReport || entry.skipped) ? 'skipped' : 'success';
          events.push({
            id: `agent__${agent.id}__${job.id}__${entry.timestamp}`,
            type: 'agent',
            source: agent.name,
            agentId: agent.id,
            jobId: job.id,
            jobName: job.name || 'Job',
            status,
            timestamp: entry.timestamp,
            summary: entry.summary || '',
            fullResponse: entry.fullResponse || '',
            error: entry.error || null,
            skipReason: entry.skipReason || null,
            trigger: job.trigger || null,
            agentEnabled: agent.enabled,
          });
        }
      }
    }
  } catch { /* non-fatal */ }

  try {
    const res = await window.electronAPI?.getAutomations?.();
    const automations = Array.isArray(res?.automations) ? res.automations : [];
    for (const automation of automations) {
      for (const entry of automation.history ?? []) {
        events.push({
          id: `auto__${automation.id}__${entry.timestamp}`,
          type: 'automation',
          source: automation.name,
          autoId: automation.id,
          status: entry.error ? 'error' : 'success',
          timestamp: entry.timestamp,
          summary: entry.summary || automation.description || `${automation.actions?.length ?? 0} action(s) ran`,
          fullResponse: entry.summary || '',
          error: entry.error || null,
          skipReason: null,
          trigger: automation.trigger || null,
          autoEnabled: automation.enabled,
        });
      }

      if (!(automation.history?.length) && automation.lastRun) {
        events.push({
          id: `auto__${automation.id}__${automation.lastRun}`,
          type: 'automation',
          source: automation.name,
          autoId: automation.id,
          status: 'success',
          timestamp: automation.lastRun,
          summary: automation.description || `${automation.actions?.length ?? 0} action(s) ran`,
          fullResponse: '',
          error: null,
          skipReason: null,
          trigger: automation.trigger || null,
          autoEnabled: automation.enabled,
        });
      }
    }
  } catch { /* non-fatal */ }

  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return events.slice(0, MAX_EVENTS);
}

/** Fetch jobs that are currently running. Returns an array (empty on error). */
export async function fetchRunning() {
  try {
    const res = await window.electronAPI?.getRunningJobs?.();
    return Array.isArray(res?.running) ? res.running : [];
  } catch {
    return [];
  }
}
