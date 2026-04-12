import {
  escapeHtml,
  capitalize,
  generateId,
  formatTrigger,
  timeAgo,
  fullDateTime,
} from '../../../../../System/Utils.js';
export { escapeHtml, capitalize, formatTrigger, timeAgo, fullDateTime };
export function generateAgentId() {
  return generateId('agent');
}
export function generateJobId() {
  return generateId('job');
}
export function resolveModelLabel(allModels, providerId, modelId) {
  const entry = allModels.find(
    (model) => model.providerId === providerId && model.modelId === modelId,
  );
  return entry ? `${entry.modelName} (${entry.provider})` : (modelId ?? '');
}
export function getAgentHealth(agent) {
  const allRuns = (agent.jobs ?? []).flatMap((job) => job.history ?? []);
  if (!allRuns.length) return 'none';
  const latestRun = [...allRuns].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  return latestRun.error
    ? 'error'
    : latestRun.nothingToReport || latestRun.skipped
      ? 'skipped'
      : latestRun.acted
        ? 'acted'
        : 'none';
}
export function getSourceCount(job) {
  return Array.isArray(job?.dataSources) && job.dataSources.length
    ? job.dataSources.length
    : job?.dataSource?.type
      ? 1
      : 0;
}
export function getPrimarySourceType(job) {
  return Array.isArray(job?.dataSources) && job.dataSources.length
    ? (job.dataSources[0]?.type ?? '')
    : (job?.dataSource?.type ?? '');
}
export function getJobLabel(job, dataSourceTypes, fallback = 'Job') {
  const sourceType = getPrimarySourceType(job),
    dataSource = dataSourceTypes.find((item) => item.value === sourceType);
  return job?.name || dataSource?.label || fallback;
}
export function normalizeJobDataSources(job) {
  return Array.isArray(job?.dataSources) && job.dataSources.length
    ? job.dataSources.map((source) => ({ ...source }))
    : job?.dataSource?.type
      ? [{ ...job.dataSource }]
      : [{ type: '' }];
}
export function ensureJobDataSources(job) {
  return (
    (Array.isArray(job.dataSources) && job.dataSources.length) ||
      (job.dataSources = normalizeJobDataSources(job)),
    job.dataSources
  );
}
export function cloneJobsForEditing(agent) {
  return agent?.jobs
    ? agent.jobs.map((job) => ({
        ...job,
        dataSources: normalizeJobDataSources(job),
        output: { ...(job.output ?? { type: '' }) },
        trigger: { ...(job.trigger ?? { type: 'daily', time: '08:00' }) },
        history: job.history ?? [],
      }))
    : [];
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
