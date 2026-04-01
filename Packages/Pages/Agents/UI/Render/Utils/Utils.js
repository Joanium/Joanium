export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export function generateAgentId() {
  return `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function formatTrigger(trigger) {
  if (!trigger) return '?';
  switch (trigger.type) {
    case 'on_startup': return '\u26A1 Startup';
    case 'interval': return `\u23F1 Every ${trigger.minutes}m`;
    case 'hourly': return '\u23F0 Hourly';
    case 'daily': return `\u{1F305} Daily ${trigger.time ?? ''}`;
    case 'weekly': return `\u{1F4C5} ${capitalize(trigger.day ?? '')} ${trigger.time ?? ''}`;
    default: return trigger.type;
  }
}

export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso);
  const minute = 60_000;
  const hour = 3_600_000;

  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / hour)}h ago`;

  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function fullDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function resolveModelLabel(allModels, providerId, modelId) {
  const entry = allModels.find(model => model.providerId === providerId && model.modelId === modelId);
  return entry ? `${entry.modelName} (${entry.provider})` : modelId ?? '';
}

export function getAgentHealth(agent) {
  const allRuns = (agent.jobs ?? []).flatMap(job => job.history ?? []);
  if (!allRuns.length) return 'none';

  const latestRun = [...allRuns].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  if (latestRun.error) return 'error';
  if (latestRun.nothingToReport || latestRun.skipped) return 'skipped';
  if (latestRun.acted) return 'acted';
  return 'none';
}

export function getSourceCount(job) {
  if (Array.isArray(job?.dataSources) && job.dataSources.length) return job.dataSources.length;
  return job?.dataSource?.type ? 1 : 0;
}

export function getPrimarySourceType(job) {
  if (Array.isArray(job?.dataSources) && job.dataSources.length) return job.dataSources[0]?.type ?? '';
  return job?.dataSource?.type ?? '';
}

export function getJobLabel(job, dataSourceTypes, fallback = 'Job') {
  const sourceType = getPrimarySourceType(job);
  const dataSource = dataSourceTypes.find(item => item.value === sourceType);
  return job?.name || dataSource?.label || fallback;
}

export function normalizeJobDataSources(job) {
  if (Array.isArray(job?.dataSources) && job.dataSources.length) {
    return job.dataSources.map(source => ({ ...source }));
  }

  if (job?.dataSource?.type) return [{ ...job.dataSource }];
  return [{ type: '' }];
}

export function ensureJobDataSources(job) {
  if (!Array.isArray(job.dataSources) || !job.dataSources.length) {
    job.dataSources = normalizeJobDataSources(job);
  }
  return job.dataSources;
}

export function cloneJobsForEditing(agent) {
  if (!agent?.jobs) return [];

  return agent.jobs.map(job => ({
    ...job,
    dataSources: normalizeJobDataSources(job),
    output: { ...(job.output ?? { type: '' }) },
    trigger: { ...(job.trigger ?? { type: 'daily', time: '08:00' }) },
    history: job.history ?? [],
  }));
}

export function createNewJob() {
  return {
    id: generateJobId(),
    name: '',
    trigger: { type: 'daily', time: '08:00' },
    dataSources: [{ type: '' }],
    instruction: '',
    output: { type: '' },
    history: [],
    lastRun: null,
  };
}
