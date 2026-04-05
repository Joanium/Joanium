import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import defineEngine from '../../../System/Contracts/DefineEngine.js';
import { shouldRunNow } from '../../Automation/Scheduling/Scheduling.js';
import { loadDataSources } from './loadDataSources.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_SOURCES_DIR = path.resolve(__dirname, '..', 'DataSources');

// USAGE TRACKING
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
        /* corrupt start fresh */
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
    console.warn('[AgentsEngine] trackUsage failed:', err.message);
  }
}

// AI CALLER returns { text, inputTokens, outputTokens }
async function callModel(providerData, modelId, systemPrompt, userMessage) {
  if (!providerData?.configured)
    throw new Error(`Provider "${providerData?.provider}" is not configured`);
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
      text: data.content?.find((b) => b.type === 'text')?.text ?? '(empty)',
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

  // OpenAI / OpenRouter / Mistral
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

async function callAIWithFailover(agent, systemPrompt, userMessage, allProviders, usageFile = '') {
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

  addCandidate(agent.primaryModel?.provider, agent.primaryModel?.modelId);

  for (const fb of agent.fallbackModels ?? []) {
    addCandidate(fb?.provider, fb?.modelId);
  }
  if (!candidates.length) throw new Error('No AI model configured for this agent.');

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
      console.warn(`[AgentsEngine] ${provider.provider}/${modelId} failed: ${err.message}`);
    }
  }
  throw lastErr ?? new Error('All models failed');
}

/* ══════════════════════════════════════════
   DATA SOURCE LABELS & COLLECTOR MAP
   Loaded lazily from DataSources/ directory.
══════════════════════════════════════════ */
let _dsCollectMap = null;
let _dsLabelMap = {};

async function getDataSourceMap() {
  if (_dsCollectMap) return _dsCollectMap;
  const { collectMap, labelMap } = await loadDataSources(DATA_SOURCES_DIR);
  _dsCollectMap = collectMap;
  _dsLabelMap = labelMap;
  return collectMap;
}

/* ══════════════════════════════════════════
   SOURCE COLLECTOR
══════════════════════════════════════════ */
export async function collectOneSource(ds, connectorEngine) {
  const type = ds?.type;
  const map = await getDataSourceMap();
  const handler = map.get(type);
  if (handler) return handler(ds);

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
    const featureResult = await featureRegistry?.collectAgentDataSource?.(source, {
      connectorEngine,
    });
    if (featureResult?.handled) return featureResult.result;
    return collectOneSource(source, connectorEngine);
  }

  if (sources.length === 1) return collectSource(sources[0]);

  const results = await Promise.allSettled(sources.map((source) => collectSource(source)));
  return results
    .map((result, i) => {
      const text =
        result.status === 'fulfilled'
          ? result.value
          : `?? Source failed: ${result.reason?.message ?? 'Unknown error'}`;
      const featureLabel = featureRegistry?.getAgentDataSourceDefinition?.(sources[i]?.type)?.label;
      return `=== ${featureLabel ?? _dsLabelMap[sources[i]?.type] ?? `Source ${i + 1}`} ===\n${text}`;
    })
    .join('\n\n');
}

// OUTPUT EXECUTORS
export async function executeOutput(
  output,
  aiResponse,
  agent,
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
      // Email sending uses the unified 'google' connector
      const creds = connectorEngine?.getCredentials('google');
      if (!creds?.accessToken) throw new Error('Google Workspace not connected.');
      const { sendEmail } = await import('../../../Capabilities/Google/Gmail/Core/API/GmailAPI.js');
      const subject = output.subject?.trim()
        ? output.subject
            .replace('{{date}}', dateStr)
            .replace('{{agent}}', agent.name)
            .replace('{{job}}', job.name ?? '')
        : `[${agent.name}] ${job.name ?? 'Report'} - ${dateStr}`;
      await sendEmail(creds, output.to, subject, aiResponse, output.cc ?? '', output.bcc ?? '');
      break;
    }

    case 'send_notification': {
      const { sendNotification } = await import('../../Automation/Actions/Notification.js');
      sendNotification(
        output.title?.trim() || `${agent.name}: ${job.name ?? 'Report'}`,
        aiResponse.slice(0, 200) + (aiResponse.length > 200 ? '...' : ''),
        output.clickUrl ?? '',
      );
      break;
    }

    case 'write_file': {
      if (!output.filePath) throw new Error('write_file: no file path specified.');
      const dir = path.dirname(output.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const entry = `\n\n--- ${agent.name} / ${job.name ?? 'Job'} - ${now.toISOString()} ---\n${aiResponse}\n`;
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
        userService.writeText?.(
          paths.MEMORY_FILE,
          (userService.readText?.(paths.MEMORY_FILE) || '') +
            `\n\n--- Agent: ${agent.name} (${ts}) ---\n${aiResponse}`,
        );
        invalidateSystemPrompt();
      } catch (err) {
        console.error('[AgentsEngine] append_to_memory failed:', err.message);
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
              agent: agent.name,
              job: job.name ?? '',
              timestamp: now.toISOString(),
              result: aiResponse,
            }),
      });
      break;
    }

    default:
      console.warn(`[AgentsEngine] Unknown output type: "${output?.type}"`);
  }
}

// AGENTS ENGINE CLASS
export class AgentsEngine {
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
    this.agents = [];
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
    return this.agents;
  }
  getRunning() {
    return Array.from(this._running.values());
  }

  clearAllHistory() {
    this._load();
    for (const agent of this.agents) {
      for (const job of agent.jobs ?? []) {
        job.history = [];
        job.lastRun = null;
      }
    }
    this._persist();
  }

  saveAgent(agent) {
    this._load();
    const idx = this.agents.findIndex((a) => a.id === agent.id);
    if (idx >= 0) {
      const existing = this.agents[idx];
      const updatedJobs = (agent.jobs ?? []).map((newJob) => {
        const oldJob = (existing.jobs ?? []).find((j) => j.id === newJob.id);
        return oldJob
          ? { ...newJob, history: oldJob.history ?? [], lastRun: oldJob.lastRun ?? null }
          : { ...newJob, history: [], lastRun: null };
      });
      this.agents[idx] = { ...existing, ...agent, jobs: updatedJobs };
    } else {
      this.agents.push({
        ...agent,
        jobs: (agent.jobs ?? []).map((j) => ({ ...j, history: [], lastRun: null })),
      });
    }
    this._persist();
    return this.agents.find((a) => a.id === agent.id) ?? agent;
  }

  deleteAgent(id) {
    this._load();
    this.agents = this.agents.filter((a) => a.id !== id);
    this._persist();
  }

  toggleAgent(id, enabled) {
    this._load();
    const agent = this.agents.find((a) => a.id === id);
    if (agent) {
      agent.enabled = Boolean(enabled);
      this._persist();
    }
  }

  async runNow(agentId) {
    this._load();
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent) throw new Error(`Agent "${agentId}" not found`);
    for (const job of agent.jobs ?? []) {
      await this._executeJob(agent, job);
    }
    return { ok: true };
  }

  _load() {
    try {
      const data = this.storage.load(() => ({ agents: [] }));
      this.agents = Array.isArray(data?.agents) ? data.agents : [];
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

  _runStartupJobs() {
    for (const agent of this.agents) {
      if (!agent.enabled) continue;
      for (const job of agent.jobs ?? []) {
        if (job.enabled !== false && job.trigger?.type === 'on_startup')
          this._executeJob(agent, job);
      }
    }
  }

  _checkScheduled() {
    const now = new Date();
    for (const agent of this.agents) {
      if (!agent.enabled) continue;
      for (const job of agent.jobs ?? []) {
        const runKey = `${agent.id}__${job.id}`;
        if (
          job.enabled !== false &&
          !this._running.has(runKey) &&
          shouldRunNow({ trigger: job.trigger, lastRun: job.lastRun ?? null }, now)
        )
          this._executeJob(agent, job);
      }
    }
  }

  async _executeJob(agent, job) {
    const runKey = `${agent.id}__${job.id}`;
    const agentId = agent.id;
    const jobId = job.id;

    this._running.set(runKey, {
      agentId,
      agentName: agent.name,
      jobId,
      jobName: job.name || 'Job',
      startedAt: new Date().toISOString(),
      trigger: job.trigger ?? null,
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
        `You are ${agent.name}, a proactive AI agent.`,
        agent.description ? agent.description : '',
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
        agent,
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
          .map((s) => s.type)
          .filter(Boolean);
        entry.skipReason = sourceTypes.length
          ? `No actionable data from: ${sourceTypes.join(', ')}.`
          : 'Data source returned nothing to act on.';
        entry.summary = entry.skipReason;
      } else {
        entry.fullResponse = trimmed;
        entry.summary = trimmed.slice(0, 400);
        const featureOutput = await this.featureRegistry?.executeAgentOutput?.(
          job.output ?? {},
          { aiResponse: trimmed, agent, job },
          { connectorEngine: this.connectorEngine },
        );
        if (featureOutput?.handled) {
          await featureOutput.result;
        } else {
          await executeOutput(job.output ?? {}, trimmed, agent, job, this.connectorEngine, {
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
      console.error(`[AgentsEngine] "${job.name ?? job.id}" failed:`, err.message);
    } finally {
      this._running.delete(runKey);
    }

    const liveAgent = this.agents.find((a) => a.id === agentId);
    const liveJob = liveAgent?.jobs?.find((j) => j.id === jobId);

    if (liveAgent && liveJob) {
      if (!Array.isArray(liveJob.history)) liveJob.history = [];
      liveJob.history.unshift(entry);
      if (liveJob.history.length > 30) liveJob.history = liveJob.history.slice(0, 30);
      liveJob.lastRun = entry.timestamp;
      this._persist();
    } else {
      console.warn(
        `[AgentsEngine] Agent/job ${agentId}/${jobId} not found after run — was it deleted?`,
      );
    }
  }
}

export const engineMeta = defineEngine({
  id: 'agents',
  provides: 'agentsEngine',
  needs: [
    'connectorEngine',
    'featureRegistry',
    'featureStorage',
    'invalidateSystemPrompt',
    'paths',
    'userService',
  ],
  storage: {
    key: 'agents',
    featureKey: 'agents',
    fileName: 'Agents.json',
  },
  create: ({
    connectorEngine,
    featureRegistry,
    featureStorage,
    invalidateSystemPrompt,
    paths,
    userService,
  }) =>
    new AgentsEngine(featureStorage.get('agents'), {
      connectorEngine,
      featureRegistry,
      invalidateSystemPrompt,
      paths,
      userService,
    }),
});
