import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import defineEngine from '../../../System/Contracts/DefineEngine.js';
import { shouldRunNow } from '../Scheduling/Scheduling.js';
import { loadDataSources } from './loadDataSources.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_SOURCES_DIR = path.resolve(__dirname, '..', 'DataSources');

async function trackUsage({ usageFile, provider, model, modelName, inputTokens, outputTokens }) {
  try {
    if (!usageFile) return;

    const dir = path.dirname(usageFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let data = { records: [] };
    if (fs.existsSync(usageFile)) {
      try {
        data = JSON.parse(fs.readFileSync(usageFile, 'utf-8'));
      } catch {
        data = { records: [] };
      }
    }

    if (!Array.isArray(data.records)) data.records = [];

    data.records.push({
      timestamp: new Date().toISOString(),
      provider: provider ?? 'unknown',
      model: model ?? 'unknown',
      modelName: modelName ?? model ?? 'unknown',
      inputTokens: inputTokens ?? 0,
      outputTokens: outputTokens ?? 0,
      chatId: null,
    });

    if (data.records.length > 20_000) data.records = data.records.slice(-20_000);
    fs.writeFileSync(usageFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[AutomationEngine] trackUsage failed:', err.message);
  }
}

async function callModel(providerData, modelId, systemPrompt, userMessage) {
  if (!providerData?.configured) {
    throw new Error(`Provider "${providerData?.provider}" is not configured`);
  }

  const { provider: pid, endpoint, api, auth_header, auth_prefix = '' } = providerData;
  const apiKey = String(api ?? '').trim();

  if (providerData.requires_api_key !== false && !apiKey) {
    throw new Error(`No API key for "${providerData?.provider}"`);
  }

  if (pid === 'anthropic') {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: providerData.models?.[modelId]?.max_output ?? 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? `Anthropic ${res.status}`);
    return {
      text: data.content?.find((block) => block.type === 'text')?.text ?? '(empty)',
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
  }

  if (pid === 'google') {
    const res = await fetch(endpoint.replace('{model}', modelId) + `?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? `Google ${res.status}`);
    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(empty)',
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(auth_header && apiKey ? { [auth_header]: `${auth_prefix}${apiKey}` } : {}),
      ...(pid === 'openrouter'
        ? { 'HTTP-Referer': 'https://www.joanium.com', 'X-Title': 'Joanium' }
        : {}),
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: providerData.models?.[modelId]?.max_output ?? 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `API ${res.status}`);
  return {
    text: data.choices?.[0]?.message?.content ?? '(empty)',
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

async function callAIWithFailover(automation, systemPrompt, userMessage, allProviders, usageFile) {
  const candidates = [];
  const seenCandidates = new Set();

  function addCandidate(providerId, modelId) {
    if (!providerId || !modelId) return;

    const provider = allProviders.find((item) => item.provider === providerId);
    if (!provider?.configured) return;

    const key = `${provider.provider}::${modelId}`;
    if (seenCandidates.has(key)) return;

    seenCandidates.add(key);
    candidates.push({ provider, modelId });
  }

  addCandidate(automation.primaryModel?.provider, automation.primaryModel?.modelId);

  for (const fallback of automation.fallbackModels ?? []) {
    addCandidate(fallback?.provider, fallback?.modelId);
  }

  if (!candidates.length) {
    throw new Error('No AI model configured for this automation.');
  }

  let lastErr;
  for (const { provider, modelId } of candidates) {
    try {
      const result = await callModel(provider, modelId, systemPrompt, userMessage);
      await trackUsage({
        usageFile,
        provider: provider.provider,
        model: modelId,
        modelName: provider.models?.[modelId]?.name ?? modelId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });
      return result.text;
    } catch (err) {
      lastErr = err;
      console.warn(`[AutomationEngine] ${provider.provider}/${modelId} failed: ${err.message}`);
    }
  }

  throw lastErr ?? new Error('All models failed');
}

let dataSourceCollectorMap = null;
let dataSourceLabelMap = {};

async function getDataSourceMap() {
  if (dataSourceCollectorMap) return dataSourceCollectorMap;
  const { collectMap, labelMap } = await loadDataSources(DATA_SOURCES_DIR);
  dataSourceCollectorMap = collectMap;
  dataSourceLabelMap = labelMap;
  return collectMap;
}

async function collectOneSource(dataSource) {
  const type = dataSource?.type;
  const map = await getDataSourceMap();
  const handler = map.get(type);
  if (handler) return handler(dataSource);

  return `Unknown data source type: "${type}"`;
}

async function collectData(job, connectorEngine, featureRegistry = null) {
  const sources =
    Array.isArray(job.dataSources) && job.dataSources.length
      ? job.dataSources
      : job.dataSource?.type
        ? [job.dataSource]
        : [];

  if (!sources.length) return '(no data source configured)';

  async function collectSource(source) {
    const featureResult = await featureRegistry?.collectAutomationDataSource?.(source, {
      connectorEngine,
    });
    if (featureResult?.handled) return featureResult.result;
    return collectOneSource(source);
  }

  if (sources.length === 1) return collectSource(sources[0]);

  const results = await Promise.allSettled(sources.map((source) => collectSource(source)));
  return results
    .map((result, index) => {
      const text =
        result.status === 'fulfilled'
          ? result.value
          : `?? Source failed: ${result.reason?.message ?? 'Unknown error'}`;
      const label =
        featureRegistry?.getAutomationDataSourceDefinition?.(sources[index]?.type)?.label ??
        dataSourceLabelMap[sources[index]?.type] ??
        `Source ${index + 1}`;
      return `=== ${label} ===\n${text}`;
    })
    .join('\n\n');
}

async function executeOutput(
  output,
  aiResponse,
  automation,
  job,
  connectorEngine,
  dependencies = {},
) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const { invalidateSystemPrompt = () => {}, paths = {}, userService = {} } = dependencies;

  switch (output?.type) {
    case 'send_email': {
      const creds = connectorEngine?.getCredentials('google');
      if (!creds?.accessToken) throw new Error('Google Workspace not connected.');
      const { sendEmail } = await import('../../../Capabilities/Google/Gmail/Core/API/GmailAPI.js');
      const subject = output.subject?.trim()
        ? output.subject
            .replace('{{date}}', dateStr)
            .replace('{{agent}}', automation.name)
            .replace('{{job}}', job.name ?? '')
        : `[${automation.name}] ${job.name ?? 'Report'} - ${dateStr}`;
      await sendEmail(creds, output.to, subject, aiResponse, output.cc ?? '', output.bcc ?? '');
      break;
    }

    case 'send_notification': {
      const { sendNotification } = await import('../Actions/Notification.js');
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
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const entry =
        `\n\n--- ${automation.name} / ${job.name ?? 'Job'} - ${now.toISOString()} ---\n` +
        `${aiResponse}\n`;
      if (output.append) fs.appendFileSync(output.filePath, entry, 'utf-8');
      else fs.writeFileSync(output.filePath, aiResponse, 'utf-8');
      break;
    }

    case 'append_to_memory': {
      try {
        if (!paths.MEMORY_FILE) break;
        const ts = now.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const existing = userService.readText?.(paths.MEMORY_FILE) || '';
        userService.writeText?.(
          paths.MEMORY_FILE,
          `${existing}\n\n--- Automation: ${automation.name} (${ts}) ---\n${aiResponse}`,
        );
        invalidateSystemPrompt();
      } catch (err) {
        console.error('[AutomationEngine] append_to_memory failed:', err.message);
      }
      break;
    }

    case 'http_webhook': {
      if (!output.url) throw new Error('http_webhook: no URL specified.');
      const method = (output.method ?? 'POST').toUpperCase();
      await fetch(output.url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: ['GET', 'HEAD'].includes(method)
          ? undefined
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
}

export class AutomationEngine {
  constructor(
    storage,
    {
      connectorEngine = null,
      featureRegistry = null,
      paths = {},
      userService = {},
      invalidateSystemPrompt = () => {},
    } = {},
  ) {
    this.storage = storage;
    this.connectorEngine = connectorEngine;
    this.featureRegistry = featureRegistry;
    this.invalidateSystemPrompt = invalidateSystemPrompt;
    this.paths = paths;
    this.userService = userService;
    this.automations = [];
    this._ticker = null;
    this._running = new Map();
  }

  start() {
    this._load();
    this._runStartupJobs();
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

  getRunning() {
    return Array.from(this._running.values());
  }

  clearAllHistory() {
    this._load();
    for (const automation of this.automations) {
      for (const job of automation.jobs ?? []) {
        job.history = [];
        job.lastRun = null;
      }
    }
    this._persist();
  }

  saveAutomation(automation) {
    this._load();
    const index = this.automations.findIndex((item) => item.id === automation.id);

    if (index >= 0) {
      const existing = this.automations[index];
      const updatedJobs = (automation.jobs ?? []).map((newJob) => {
        const oldJob = (existing.jobs ?? []).find((job) => job.id === newJob.id);
        return oldJob
          ? { ...newJob, history: oldJob.history ?? [], lastRun: oldJob.lastRun ?? null }
          : { ...newJob, history: [], lastRun: null };
      });
      this.automations[index] = { ...existing, ...automation, jobs: updatedJobs };
    } else {
      this.automations.push({
        ...automation,
        jobs: (automation.jobs ?? []).map((job) => ({ ...job, history: [], lastRun: null })),
      });
    }

    this._persist();
    return this.automations.find((item) => item.id === automation.id) ?? automation;
  }

  deleteAutomation(id) {
    this._load();
    this.automations = this.automations.filter((automation) => automation.id !== id);
    this._persist();
  }

  toggleAutomation(id, enabled) {
    this._load();
    const automation = this.automations.find((item) => item.id === id);
    if (automation) {
      automation.enabled = Boolean(enabled);
      this._persist();
    }
  }

  async runNow(automationId) {
    this._load();
    const automation = this.automations.find((item) => item.id === automationId);
    if (!automation) throw new Error(`Automation "${automationId}" not found`);

    for (const job of automation.jobs ?? []) {
      await this._executeJob(automation, job, 'manual');
    }

    return { ok: true };
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

  _runStartupJobs() {
    for (const automation of this.automations) {
      if (!automation.enabled) continue;
      for (const job of automation.jobs ?? []) {
        if (job.enabled !== false && job.trigger?.type === 'on_startup') {
          this._executeJob(automation, job, 'startup');
        }
      }
    }
  }

  _checkScheduled() {
    const now = new Date();
    for (const automation of this.automations) {
      if (!automation.enabled) continue;
      for (const job of automation.jobs ?? []) {
        const runKey = `${automation.id}__${job.id}`;
        if (
          job.enabled !== false &&
          !this._running.has(runKey) &&
          shouldRunNow({ trigger: job.trigger, lastRun: job.lastRun ?? null }, now)
        ) {
          this._executeJob(automation, job, 'scheduled');
        }
      }
    }
  }

  async _executeJob(automation, job, triggerKind = 'scheduled') {
    const runKey = `${automation.id}__${job.id}`;
    const automationId = automation.id;
    const jobId = job.id;

    this._running.set(runKey, {
      automationId,
      automationName: automation.name,
      jobId,
      jobName: job.name || 'Job',
      startedAt: new Date().toISOString(),
      trigger: job.trigger ?? null,
      type: 'automation',
      triggerKind,
    });

    const entry = {
      timestamp: new Date().toISOString(),
      acted: false,
      skipped: false,
      nothingToReport: false,
      error: null,
      skipReason: null,
      summary: '',
      fullResponse: '',
    };

    try {
      const dataText = await collectData(job, this.connectorEngine, this.featureRegistry);
      const allProviders = (await this.userService.readModelsWithKeys?.()) ?? [];

      const systemPrompt = [
        `You are ${automation.name}, a proactive AI automation.`,
        automation.description ? automation.description : '',
        'Analyze the provided data and follow the task instruction.',
        '',
        'NOTHING-TO-REPORT RULE: If every data source is empty or there is genuinely nothing to act on, respond with ONLY the exact word [NOTHING].',
        '',
        'OUTPUT FORMAT: Write plain text only. No markdown. Write as if composing a clear professional email.',
      ]
        .filter(Boolean)
        .join(' ');

      const userMessage = [
        '=== DATA ===',
        dataText,
        '',
        '=== YOUR TASK ===',
        job.instruction ?? 'Analyze the above data and provide a helpful, actionable summary.',
      ].join('\n');

      const aiResponse = await callAIWithFailover(
        automation,
        systemPrompt,
        userMessage,
        allProviders,
        this.paths.USAGE_FILE,
      );

      const trimmed = aiResponse.trim();
      const isNothing = trimmed === '[NOTHING]' || trimmed.toUpperCase() === '[NOTHING]';

      if (isNothing) {
        entry.skipped = true;
        entry.nothingToReport = true;
        const sourceTypes = (
          Array.isArray(job.dataSources) && job.dataSources.length
            ? job.dataSources
            : job.dataSource?.type
              ? [job.dataSource]
              : []
        )
          .map((source) => source.type)
          .filter(Boolean);
        entry.skipReason = sourceTypes.length
          ? `No actionable data from: ${sourceTypes.join(', ')}.`
          : 'Data source returned nothing to act on.';
        entry.summary = entry.skipReason;
      } else {
        entry.fullResponse = trimmed;
        entry.summary = trimmed.slice(0, 400);
        const featureOutput = await this.featureRegistry?.executeAutomationOutput?.(
          job.output ?? {},
          { aiResponse: trimmed, agent: automation, job },
          { connectorEngine: this.connectorEngine },
        );
        if (featureOutput?.handled) {
          await featureOutput.result;
        } else {
          await executeOutput(job.output ?? {}, trimmed, automation, job, this.connectorEngine, {
            invalidateSystemPrompt: this.invalidateSystemPrompt,
            paths: this.paths,
            userService: this.userService,
          });
        }
        entry.acted = true;
      }
    } catch (err) {
      entry.error = err.message;
      entry.summary = `Error: ${err.message}`;
      console.error(`[AutomationEngine] "${job.name ?? job.id}" failed:`, err.message);
    } finally {
      this._running.delete(runKey);
    }

    const liveAutomation = this.automations.find((item) => item.id === automationId);
    const liveJob = liveAutomation?.jobs?.find((item) => item.id === jobId);

    if (liveAutomation && liveJob) {
      if (!Array.isArray(liveJob.history)) liveJob.history = [];
      liveJob.history.unshift(entry);
      if (liveJob.history.length > 30) liveJob.history = liveJob.history.slice(0, 30);
      liveJob.lastRun = entry.timestamp;
      this._persist();
    } else {
      console.warn(
        `[AutomationEngine] Automation/job ${automationId}/${jobId} not found after run.`,
      );
    }
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
  storage: {
    key: 'automations',
    featureKey: 'automations',
    fileName: 'Automations.json',
  },
  create: ({
    connectorEngine,
    featureRegistry,
    featureStorage,
    invalidateSystemPrompt,
    paths,
    userService,
  }) =>
    new AutomationEngine(featureStorage.get('automations'), {
      connectorEngine,
      featureRegistry,
      invalidateSystemPrompt,
      paths,
      userService,
    }),
});
