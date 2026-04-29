import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import defineEngine from '../../../System/Contracts/DefineEngine.js';
import { shouldRunNow } from '../Scheduling/Scheduling.js';
import { loadDataSources } from './loadDataSources.js';
import { callModel } from './ModelInvoker.js';
const __filename = fileURLToPath(import.meta.url),
  __dirname = path.dirname(__filename),
  DATA_SOURCES_DIR = path.resolve(__dirname, '..', 'DataSources'),
  DEFAULT_TRIGGER = { type: 'daily', time: '08:00' },
  usageFileCache = new Map();
function flushUsageFile(usageFile) {
  const cache = usageFileCache.get(usageFile);
  if (!cache) return;
  cache.timer && (clearTimeout(cache.timer), (cache.timer = null));
  const dir = path.dirname(usageFile);
  (fs.existsSync(dir) || fs.mkdirSync(dir, { recursive: !0 }),
    cache.data.records.length > 2e4 && (cache.data.records = cache.data.records.slice(-2e4)),
    fs.writeFileSync(usageFile, JSON.stringify(cache.data, null, 2), 'utf-8'));
}
function flushAllUsageFiles() {
  for (const usageFile of usageFileCache.keys()) flushUsageFile(usageFile);
}
async function trackUsage({
  usageFile: usageFile,
  provider: provider,
  model: model,
  modelName: modelName,
  inputTokens: inputTokens,
  outputTokens: outputTokens,
}) {
  try {
    if (!usageFile) return;
    const cache = (function (usageFile) {
      if (!usageFile) return null;
      if (!usageFileCache.has(usageFile)) {
        let data = { records: [] };
        if (fs.existsSync(usageFile))
          try {
            data = JSON.parse(fs.readFileSync(usageFile, 'utf-8'));
          } catch {
            data = { records: [] };
          }
        (Array.isArray(data.records) || (data.records = []),
          usageFileCache.set(usageFile, { data: data, timer: null }));
      }
      return usageFileCache.get(usageFile);
    })(usageFile);
    if (!cache) return;
    (cache.data.records.push({
      timestamp: new Date().toISOString(),
      provider: provider ?? 'unknown',
      model: model ?? 'unknown',
      modelName: modelName ?? model ?? 'unknown',
      inputTokens: inputTokens ?? 0,
      outputTokens: outputTokens ?? 0,
      chatId: null,
    }),
      cache.data.records.length > 2e4 && (cache.data.records = cache.data.records.slice(-2e4)),
      cache.timer && clearTimeout(cache.timer),
      (cache.timer = setTimeout(() => {
        try {
          flushUsageFile(usageFile);
        } catch (err) {
          console.warn('[AutomationEngine] trackUsage flush failed:', err.message);
        }
      }, 400)));
  } catch (err) {
    console.warn('[AutomationEngine] trackUsage failed:', err.message);
  }
}
function normalizeTrigger(trigger = {}) {
  const type = trigger?.type ?? DEFAULT_TRIGGER.type;
  return 'interval' === type
    ? { type: type, minutes: Math.max(1, parseInt(trigger.minutes, 10) || 30) }
    : 'daily' === type
      ? { type: type, time: trigger.time || DEFAULT_TRIGGER.time }
      : 'weekly' === type
        ? { type: type, day: trigger.day || 'monday', time: trigger.time || DEFAULT_TRIGGER.time }
        : 'hourly' === type || 'on_startup' === type
          ? { type: type }
          : { ...DEFAULT_TRIGGER };
}
function normalizeJobHistory(history = []) {
  return Array.isArray(history)
    ? history.slice(0, 30).map((entry) => ({
        timestamp: entry?.timestamp ?? new Date().toISOString(),
        acted: !0 === entry?.acted,
        skipped: !0 === entry?.skipped,
        nothingToReport: !0 === entry?.nothingToReport,
        error: entry?.error ? String(entry.error) : null,
        skipReason: entry?.skipReason ? String(entry.skipReason) : null,
        summary: String(entry?.summary ?? ''),
        fullResponse: String(entry?.fullResponse ?? ''),
      }))
    : [];
}
function normalizeDataSources(job = {}) {
  return Array.isArray(job.dataSources)
    ? job.dataSources
        .filter((source) => source && 'object' == typeof source)
        .map((source) => ({ ...source }))
    : job.dataSource?.type
      ? [{ ...job.dataSource }]
      : [];
}
function normalizeAutomation(automation = {}) {
  return {
    id: String(automation.id ?? ''),
    name: String(automation.name ?? '').trim(),
    description: String(automation.description ?? '').trim(),
    enabled: !1 !== automation.enabled,
    primaryModel:
      ((model = automation.primaryModel),
      model?.provider && model?.modelId
        ? { provider: String(model.provider), modelId: String(model.modelId) }
        : null),
    jobs: Array.isArray(automation.jobs)
      ? automation.jobs
          .map((job) =>
            (function (job = {}) {
              return {
                id: String(job.id ?? ''),
                name: String(job.name ?? '').trim(),
                enabled: !1 !== job.enabled,
                trigger: normalizeTrigger(job.trigger),
                dataSources: normalizeDataSources(job),
                instruction: String(job.instruction ?? '').trim(),
                output:
                  job.output && 'object' == typeof job.output && !Array.isArray(job.output)
                    ? { ...job.output }
                    : { type: '' },
                history: normalizeJobHistory(job.history),
                lastRun: job.lastRun ?? null,
              };
            })(job),
          )
          .filter((job) => job.id)
      : [],
  };
  var model;
}
let dataSourceCollectorMap = null,
  dataSourceLabelMap = {};
export class AutomationEngine {
  constructor(
    storage,
    {
      connectorEngine: connectorEngine = null,
      featureRegistry: featureRegistry = null,
      paths: paths = {},
      userService: userService = {},
      invalidateSystemPrompt: invalidateSystemPrompt = () => {},
    } = {},
  ) {
    ((this.storage = storage),
      (this.connectorEngine = connectorEngine),
      (this.featureRegistry = featureRegistry),
      (this.invalidateSystemPrompt = invalidateSystemPrompt),
      (this.paths = paths),
      (this.userService = userService),
      (this.automations = []),
      (this._ticker = null),
      (this._running = new Map()),
      (this._queue = []),
      (this._queuedRunKeys = new Set()),
      (this._persistTimer = null));
  }
  start() {
    (this._load(),
      this._runStartupJobs(),
      (this._ticker = setInterval(() => this._checkScheduled(), 6e4)));
  }
  stop() {
    for (
      this._ticker && (clearInterval(this._ticker), (this._ticker = null)),
        this._persistTimer && (clearTimeout(this._persistTimer), (this._persistTimer = null)),
        this._flushPersist(),
        flushAllUsageFiles();
      this._queue.length;
    ) {
      const task = this._queue.shift();
      (this._queuedRunKeys.delete(task.runKey), task.reject(new Error('App shutting down')));
    }
  }
  reload() {
    this._load();
  }
  getAll() {
    return this.automations;
  }
  getRunning() {
    return Array.from(this._running.values());
  }
  clearAllHistory() {
    this._load();
    for (const automation of this.automations)
      for (const job of automation.jobs ?? []) ((job.history = []), (job.lastRun = null));
    this._persist();
  }
  saveAutomation(automation) {
    this._load();
    const normalized = normalizeAutomation(automation);
    if (!normalized.id) throw new Error('Automation id is required.');
    if (!normalized.name) throw new Error('Automation name is required.');
    if (normalized.jobs.length && !normalized.primaryModel)
      throw new Error('Choose a primary model.');
    const index = this.automations.findIndex((item) => item.id === normalized.id);
    if (index >= 0) {
      const existing = this.automations[index],
        updatedJobs = normalized.jobs.map((newJob) => {
          const oldJob = (existing.jobs ?? []).find((job) => job.id === newJob.id);
          return oldJob
            ? { ...newJob, history: oldJob.history ?? [], lastRun: oldJob.lastRun ?? null }
            : { ...newJob, history: [], lastRun: null };
        });
      this.automations[index] = { ...existing, ...normalized, jobs: updatedJobs };
    } else
      this.automations.push({
        ...normalized,
        jobs: normalized.jobs.map((job) => ({ ...job, history: [], lastRun: null })),
      });
    return (
      this._persist(),
      this.automations.find((item) => item.id === normalized.id) ?? normalized
    );
  }
  deleteAutomation(id) {
    (this._load(),
      (this.automations = this.automations.filter((automation) => automation.id !== id)),
      this._persist());
  }
  toggleAutomation(id, enabled) {
    this._load();
    const automation = this.automations.find((item) => item.id === id);
    automation && ((automation.enabled = Boolean(enabled)), this._persist());
  }
  async runNow(automationId) {
    this._load();
    const automation = this.automations.find((item) => item.id === automationId);
    if (!automation) throw new Error(`Automation "${automationId}" not found`);
    return (
      await Promise.all(
        (automation.jobs ?? []).map((job) => this._enqueueJobRun(automation.id, job.id, 'manual')),
      ),
      this._flushPersist(),
      flushAllUsageFiles(),
      { ok: !0 }
    );
  }
  _load() {
    try {
      this._persistTimer && this._flushPersist();
      const data = this.storage.load(() => ({ automations: [] })),
        automations = Array.isArray(data?.automations) ? data.automations : [];
      this.automations = automations
        .map((automation) => normalizeAutomation(automation))
        .filter((automation) => automation.id);
    } catch (err) {
      (console.error('[AutomationEngine] _load error:', err), (this.automations = []));
    }
  }
  _persist() {
    try {
      this.storage.save({ automations: this.automations });
    } catch (err) {
      console.error('[AutomationEngine] _persist error:', err);
    }
  }
  _schedulePersist() {
    (this._persistTimer && clearTimeout(this._persistTimer),
      (this._persistTimer = setTimeout(() => {
        ((this._persistTimer = null), this._persist());
      }, 150)));
  }
  _flushPersist() {
    (this._persistTimer && (clearTimeout(this._persistTimer), (this._persistTimer = null)),
      this._persist());
  }
  _runStartupJobs() {
    for (const automation of this.automations)
      if (automation.enabled)
        for (const job of automation.jobs ?? [])
          !1 !== job.enabled &&
            'on_startup' === job.trigger?.type &&
            this._enqueueJobRun(automation.id, job.id, 'startup');
  }
  _checkScheduled() {
    const now = new Date();
    for (const automation of this.automations)
      if (automation.enabled)
        for (const job of automation.jobs ?? []) {
          const runKey = `${automation.id}__${job.id}`;
          !1 === job.enabled ||
            this._running.has(runKey) ||
            this._queuedRunKeys.has(runKey) ||
            !shouldRunNow({ trigger: job.trigger, lastRun: job.lastRun ?? null }, now) ||
            this._enqueueJobRun(automation.id, job.id, 'scheduled');
        }
  }
  _findLiveJob(automationId, jobId) {
    const automation = this.automations.find((item) => item.id === automationId),
      job = automation?.jobs?.find((item) => item.id === jobId);
    return { automation: automation, job: job };
  }
  _enqueueJobRun(automationId, jobId, triggerKind = 'scheduled') {
    const runKey = `${automationId}__${jobId}`;
    if (this._running.has(runKey))
      return Promise.resolve({ ok: !1, skipped: !0, reason: 'already running' });
    const queuedTask = this._queue.find((task) => task.runKey === runKey);
    if (queuedTask) return queuedTask.promise;
    let resolveTask, rejectTask;
    const promise = new Promise((resolve, reject) => {
      ((resolveTask = resolve), (rejectTask = reject));
    });
    return (
      this._queue.push({
        automationId: automationId,
        jobId: jobId,
        triggerKind: triggerKind,
        runKey: runKey,
        promise: promise,
        resolve: resolveTask,
        reject: rejectTask,
      }),
      this._queuedRunKeys.add(runKey),
      this._drainQueue(),
      promise
    );
  }
  _drainQueue() {
    for (; this._running.size < 3 && this._queue.length; ) {
      const task = this._queue.shift();
      this._queuedRunKeys.delete(task.runKey);
      const { automation: automation, job: job } = this._findLiveJob(task.automationId, task.jobId);
      automation && job
        ? 'manual' === task.triggerKind || (automation.enabled && !1 !== job.enabled)
          ? this._executeJob(automation, job, task.triggerKind)
              .then(task.resolve)
              .catch(task.reject)
              .finally(() => this._drainQueue())
          : task.resolve({ ok: !1, skipped: !0, reason: 'disabled' })
        : task.resolve({ ok: !1, skipped: !0, reason: 'missing automation or job' });
    }
  }
  async _executeJob(automation, job, triggerKind = 'scheduled') {
    const runKey = `${automation.id}__${job.id}`,
      automationId = automation.id,
      jobId = job.id;
    if (this._running.has(runKey)) return { ok: !1, skipped: !0, reason: 'already running' };
    this._running.set(runKey, {
      automationId: automationId,
      automationName: automation.name,
      jobId: jobId,
      jobName: job.name || 'Job',
      startedAt: new Date().toISOString(),
      trigger: job.trigger ?? null,
      type: 'automation',
      triggerKind: triggerKind,
    });
    const entry = {
      timestamp: new Date().toISOString(),
      acted: !1,
      skipped: !1,
      nothingToReport: !1,
      error: null,
      skipReason: null,
      summary: '',
      fullResponse: '',
    };
    try {
      const dataText = await (async function (job, connectorEngine, featureRegistry = null) {
          const sources =
            Array.isArray(job.dataSources) && job.dataSources.length
              ? job.dataSources
              : job.dataSource?.type
                ? [job.dataSource]
                : [];
          if (!sources.length) return '(no data source configured)';
          async function collectSource(source) {
            const featureResult = await featureRegistry?.collectAutomationDataSource?.(source, {
              connectorEngine: connectorEngine,
            });
            return featureResult?.handled
              ? featureResult.result
              : (async function (dataSource) {
                  const type = dataSource?.type,
                    handler = (
                      await (async function () {
                        if (dataSourceCollectorMap) return dataSourceCollectorMap;
                        const { collectMap: collectMap, labelMap: labelMap } =
                          await loadDataSources(DATA_SOURCES_DIR);
                        return (
                          (dataSourceCollectorMap = collectMap),
                          (dataSourceLabelMap = labelMap),
                          collectMap
                        );
                      })()
                    ).get(type);
                  return handler ? handler(dataSource) : `Unknown data source type: "${type}"`;
                })(source);
          }
          return 1 === sources.length
            ? collectSource(sources[0])
            : (await Promise.allSettled(sources.map((source) => collectSource(source))))
                .map((result, index) => {
                  const text =
                    'fulfilled' === result.status
                      ? result.value
                      : `?? Source failed: ${result.reason?.message ?? 'Unknown error'}`;
                  return `=== ${featureRegistry?.getAutomationDataSourceDefinition?.(sources[index]?.type)?.label ?? dataSourceLabelMap[sources[index]?.type] ?? `Source ${index + 1}`} ===\n${text}`;
                })
                .join('\n\n');
        })(job, this.connectorEngine, this.featureRegistry),
        allProviders = (await this.userService.readModelsWithKeys?.()) ?? [],
        systemPrompt = [
          `You are ${automation.name}, a proactive AI automation.`,
          automation.description ? automation.description : '',
          'Analyze the provided data and follow the task instruction.',
          '',
          'NOTHING-TO-REPORT RULE: If every data source is empty or there is genuinely nothing to act on, respond with ONLY the exact word [NOTHING].',
          '',
          'OUTPUT FORMAT: Write plain text only. No markdown. Write as if composing a clear professional email.',
        ]
          .filter(Boolean)
          .join(' '),
        userMessage = [
          '=== DATA ===',
          dataText,
          '',
          '=== YOUR TASK ===',
          job.instruction ?? 'Analyze the above data and provide a helpful, actionable summary.',
        ].join('\n'),
        aiResponse = await (async function (
          automation,
          systemPrompt,
          userMessage,
          allProviders,
          usageFile,
        ) {
          const candidates = [];
          if (
            ((function (providerId, modelId) {
              if (!providerId || !modelId) return;
              const provider = allProviders.find((item) => item.provider === providerId);
              provider?.configured && candidates.push({ provider: provider, modelId: modelId });
            })(automation.primaryModel?.provider, automation.primaryModel?.modelId),
            !candidates.length)
          )
            throw new Error('No AI model configured for this automation.');
          let lastErr;
          for (const { provider: provider, modelId: modelId } of candidates)
            try {
              const result = await callModel(provider, modelId, systemPrompt, userMessage);
              return (
                await trackUsage({
                  usageFile: usageFile,
                  provider: provider.provider,
                  model: modelId,
                  modelName: provider.models?.[modelId]?.name ?? modelId,
                  inputTokens: result.inputTokens,
                  outputTokens: result.outputTokens,
                }),
                result.text
              );
            } catch (err) {
              ((lastErr = err),
                console.warn(
                  `[AutomationEngine] ${provider.provider}/${modelId} failed: ${err.message}`,
                ));
            }
          throw lastErr ?? new Error('All models failed');
        })(automation, systemPrompt, userMessage, allProviders, this.paths.USAGE_FILE),
        trimmed = aiResponse.trim();
      if ('[NOTHING]' === trimmed || '[NOTHING]' === trimmed.toUpperCase()) {
        ((entry.skipped = !0), (entry.nothingToReport = !0));
        const sourceTypes = (
          Array.isArray(job.dataSources) && job.dataSources.length
            ? job.dataSources
            : job.dataSource?.type
              ? [job.dataSource]
              : []
        )
          .map((source) => source.type)
          .filter(Boolean);
        ((entry.skipReason = sourceTypes.length
          ? `No actionable data from: ${sourceTypes.join(', ')}.`
          : 'Data source returned nothing to act on.'),
          (entry.summary = entry.skipReason));
      } else {
        ((entry.fullResponse = trimmed), (entry.summary = trimmed.slice(0, 400)));
        const featureOutput = await this.featureRegistry?.executeAutomationOutput?.(
          job.output ?? {},
          { aiResponse: trimmed, agent: automation, job: job },
          { connectorEngine: this.connectorEngine },
        );
        (featureOutput?.handled
          ? await featureOutput.result
          : await (async function (
              output,
              aiResponse,
              automation,
              job,
              connectorEngine,
              dependencies = {},
            ) {
              const now = new Date(),
                dateStr = now.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                }),
                {
                  invalidateSystemPrompt: invalidateSystemPrompt = () => {},
                  paths: paths = {},
                  userService: userService = {},
                } = dependencies;
              switch (output?.type) {
                case 'send_email': {
                  const creds = connectorEngine?.getCredentials('google');
                  if (!creds?.accessToken) throw new Error('Google Workspace not connected.');
                  const { sendEmail: sendEmail } =
                      await import('../../../Capabilities/Google/Gmail/Core/API/GmailAPI.js'),
                    subject = output.subject?.trim()
                      ? output.subject
                          .replace('{{date}}', dateStr)
                          .replace('{{agent}}', automation.name)
                          .replace('{{job}}', job.name ?? '')
                      : `[${automation.name}] ${job.name ?? 'Report'} - ${dateStr}`;
                  await sendEmail(
                    creds,
                    output.to,
                    subject,
                    aiResponse,
                    output.cc ?? '',
                    output.bcc ?? '',
                  );
                  break;
                }
                case 'send_notification': {
                  const { sendNotification: sendNotification } =
                    await import('../Actions/Notification.js');
                  sendNotification(
                    output.title?.trim() || `${automation.name}: ${job.name ?? 'Report'}`,
                    aiResponse.slice(0, 200) + (aiResponse.length > 200 ? '...' : ''),
                    output.clickUrl ?? '',
                  );
                  break;
                }
                case 'write_file': {
                  if (!output.filePath) throw new Error('write_file: no file path specified.');
                  const dir = path.dirname(output.filePath);
                  fs.existsSync(dir) || fs.mkdirSync(dir, { recursive: !0 });
                  const entry = `\n\n--- ${automation.name} / ${job.name ?? 'Job'} - ${now.toISOString()} ---\n${aiResponse}\n`;
                  output.append
                    ? fs.appendFileSync(output.filePath, entry, 'utf-8')
                    : fs.writeFileSync(output.filePath, aiResponse, 'utf-8');
                  break;
                }
                case 'append_to_memory':
                  try {
                    if (!paths.MEMORY_FILE) break;
                    const ts = now.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                      existing = userService.readText?.(paths.MEMORY_FILE) || '';
                    (userService.writeText?.(
                      paths.MEMORY_FILE,
                      `${existing}\n\n--- Automation: ${automation.name} (${ts}) ---\n${aiResponse}`,
                    ),
                      invalidateSystemPrompt());
                  } catch (err) {
                    console.error('[AutomationEngine] append_to_memory failed:', err.message);
                  }
                  break;
                case 'http_webhook': {
                  if (!output.url) throw new Error('http_webhook: no URL specified.');
                  const method = (output.method ?? 'POST').toUpperCase();
                  await fetch(output.url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: ['GET', 'HEAD'].includes(method)
                      ? void 0
                      : JSON.stringify({
                          automation: automation.name,
                          job: job.name ?? '',
                          timestamp: now.toISOString(),
                          result: aiResponse,
                        }),
                  });
                  break;
                }
                default:
                  console.warn(`[AutomationEngine] Unknown output type: "${output?.type}"`);
              }
            })(job.output ?? {}, trimmed, automation, job, this.connectorEngine, {
              invalidateSystemPrompt: this.invalidateSystemPrompt,
              paths: this.paths,
              userService: this.userService,
            }),
          (entry.acted = !0));
      }
    } catch (err) {
      ((entry.error = err.message),
        (entry.summary = `Error: ${err.message}`),
        console.error(`[AutomationEngine] "${job.name ?? job.id}" failed:`, err.message));
    } finally {
      this._running.delete(runKey);
    }
    const liveAutomation = this.automations.find((item) => item.id === automationId),
      liveJob = liveAutomation?.jobs?.find((item) => item.id === jobId);
    return (
      liveAutomation && liveJob
        ? (Array.isArray(liveJob.history) || (liveJob.history = []),
          liveJob.history.unshift(entry),
          liveJob.history.length > 30 && (liveJob.history = liveJob.history.slice(0, 30)),
          (liveJob.lastRun = entry.timestamp),
          this._schedulePersist())
        : console.warn(
            `[AutomationEngine] Automation/job ${automationId}/${jobId} not found after run.`,
          ),
      { ok: !entry.error, skipped: entry.skipped, entry: entry }
    );
  }
}
export const engineMeta = defineEngine({
  id: 'automation',
  provides: 'automationEngine',
  needs: [
    'connectorEngine',
    'featureRegistry',
    'featureStorage',
    'invalidateSystemPrompt',
    'paths',
    'userService',
  ],
  storage: { key: 'automations', featureKey: 'automations', fileName: 'Automations.json' },
  create: ({
    connectorEngine: connectorEngine,
    featureRegistry: featureRegistry,
    featureStorage: featureStorage,
    invalidateSystemPrompt: invalidateSystemPrompt,
    paths: paths,
    userService: userService,
  }) =>
    new AutomationEngine(featureStorage.get('automations'), {
      connectorEngine: connectorEngine,
      featureRegistry: featureRegistry,
      invalidateSystemPrompt: invalidateSystemPrompt,
      paths: paths,
      userService: userService,
    }),
});
