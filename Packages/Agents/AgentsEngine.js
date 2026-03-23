// ─────────────────────────────────────────────
//  openworld — Packages/Agents/AgentsEngine.js
// ─────────────────────────────────────────────

import fs   from 'fs';
import path from 'path';
import os   from 'os';
import { shouldRunNow } from '../Automation/Scheduling.js';

/* ══════════════════════════════════════════
   USAGE TRACKING
══════════════════════════════════════════ */
async function trackUsage({ provider, model, modelName, inputTokens, outputTokens }) {
  try {
    const Paths = (await import('../Main/Paths.js')).default;
    const usageFile = Paths.USAGE_FILE;
    const dir = path.dirname(usageFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let data = { records: [] };
    if (fs.existsSync(usageFile)) {
      try { data = JSON.parse(fs.readFileSync(usageFile, 'utf-8')); }
      catch { /* corrupt — start fresh */ }
    }
    if (!Array.isArray(data.records)) data.records = [];

    data.records.push({
      timestamp:    new Date().toISOString(),
      provider:     provider     ?? 'unknown',
      model:        model        ?? 'unknown',
      modelName:    modelName    ?? model ?? 'unknown',
      inputTokens:  inputTokens  ?? 0,
      outputTokens: outputTokens ?? 0,
      chatId:       null,
    });

    if (data.records.length > 20_000)
      data.records = data.records.slice(-20_000);

    fs.writeFileSync(usageFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[AgentsEngine] trackUsage failed:', err.message);
  }
}

/* ══════════════════════════════════════════
   AI CALLER  — returns { text, inputTokens, outputTokens }
══════════════════════════════════════════ */
async function callModel(providerData, modelId, systemPrompt, userMessage) {
  if (!providerData?.api?.trim()) throw new Error(`No API key for "${providerData?.provider}"`);
  const { provider: pid, endpoint, api, auth_header, auth_prefix = '' } = providerData;

  if (pid === 'anthropic') {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': api, 'anthropic-version': '2023-06-01' },
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
      text:         data.content?.find(b => b.type === 'text')?.text ?? '(empty)',
      inputTokens:  data.usage?.input_tokens  ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
  }

  if (pid === 'google') {
    const res = await fetch(endpoint.replace('{model}', modelId) + `?key=${api}`, {
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
      text:         data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(empty)',
      inputTokens:  data.usageMetadata?.promptTokenCount     ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  // OpenAI / OpenRouter / Mistral
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [auth_header]: `${auth_prefix}${api}`,
      ...(pid === 'openrouter' ? { 'HTTP-Referer': 'https://openworld.app', 'X-Title': 'openworld' } : {}),
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: providerData.models?.[modelId]?.max_output ?? 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `API ${res.status}`);
  return {
    text:         data.choices?.[0]?.message?.content ?? '(empty)',
    inputTokens:  data.usage?.prompt_tokens     ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

async function callAIWithFailover(agent, systemPrompt, userMessage, allProviders) {
  const candidates = [];
  if (agent.primaryModel?.provider && agent.primaryModel?.modelId) {
    const p = allProviders.find(x => x.provider === agent.primaryModel.provider);
    if (p) candidates.push({ provider: p, modelId: agent.primaryModel.modelId });
  }
  for (const fb of (agent.fallbackModels ?? [])) {
    if (!fb?.provider || !fb?.modelId) continue;
    const p = allProviders.find(x => x.provider === fb.provider);
    if (p?.api?.trim()) candidates.push({ provider: p, modelId: fb.modelId });
  }
  if (!candidates.length) throw new Error('No AI model configured for this agent.');

  let lastErr;
  for (const { provider, modelId } of candidates) {
    try {
      const result = await callModel(provider, modelId, systemPrompt, userMessage);
      await trackUsage({
        provider:     provider.provider,
        model:        modelId,
        modelName:    provider.models?.[modelId]?.name ?? modelId,
        inputTokens:  result.inputTokens,
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
   DATA SOURCE LABELS
══════════════════════════════════════════ */
const DS_LABELS = {
  gmail_inbox: 'Gmail Inbox', gmail_search: 'Gmail Search',
  github_notifications: 'GitHub Notifications', github_prs: 'GitHub Pull Requests',
  github_issues: 'GitHub Issues', github_commits: 'GitHub Commits', github_repos: 'GitHub Repos',
  hacker_news: 'Hacker News', rss_feed: 'RSS Feed', reddit_posts: 'Reddit',
  read_file: 'File', system_stats: 'System Stats',
  weather: 'Weather', crypto_price: 'Crypto Prices', fetch_url: 'Web Page',
  custom_context: 'Custom Context',
};

/* ══════════════════════════════════════════
   SOURCE COLLECTOR
══════════════════════════════════════════ */
async function collectOneSource(ds, connectorEngine) {
  const type = ds?.type;
  switch (type) {

    case 'gmail_inbox': {
      const creds = connectorEngine?.getCredentials('gmail');
      if (!creds?.accessToken) return '⚠️ Gmail not connected.';
      const { getEmailBrief } = await import('../Automation/Gmail.js');
      const brief = await getEmailBrief(creds, ds.maxResults ?? 20);
      if (!brief.count) return 'EMPTY: Gmail Inbox has no unread emails.';
      return `Gmail Inbox — ${brief.count} unread email(s):\n\n${brief.text}`;
    }

    case 'gmail_search': {
      const creds = connectorEngine?.getCredentials('gmail');
      if (!creds?.accessToken) return '⚠️ Gmail not connected.';
      if (!ds.query) return '⚠️ No search query specified.';
      const { searchEmails } = await import('../Automation/Gmail.js');
      const emails = await searchEmails(creds, ds.query, ds.maxResults ?? 10);
      if (!emails.length) return `EMPTY: Gmail search "${ds.query}" returned no results.`;
      return `Gmail Search "${ds.query}" — ${emails.length} result(s):\n\n` +
        emails.map((e, i) => `${i + 1}. Subject: "${e.subject}" | From: ${e.from}\n   ${e.snippet}`).join('\n\n');
    }

    case 'github_notifications': {
      const creds = connectorEngine?.getCredentials('github');
      if (!creds?.token) return '⚠️ GitHub not connected.';
      const { getNotifications } = await import('../Automation/Github.js');
      const notifs = await getNotifications(creds);
      if (!notifs?.length) return 'EMPTY: GitHub has no unread notifications.';
      return `GitHub Notifications — ${notifs.length} unread:\n\n` +
        notifs.slice(0, 15).map((n, i) =>
          `${i + 1}. [${n.reason}] ${n.subject?.title} in ${n.repository?.full_name}`
        ).join('\n');
    }

    case 'github_prs': {
      const creds = connectorEngine?.getCredentials('github');
      if (!creds?.token) return '⚠️ GitHub not connected.';
      if (!ds.owner || !ds.repo) return '⚠️ GitHub owner/repo not specified.';
      const { getPullRequests } = await import('../Automation/Github.js');
      const prs = await getPullRequests(creds, ds.owner, ds.repo, ds.state ?? 'open', 20);
      if (!prs.length) return `EMPTY: ${ds.owner}/${ds.repo} has no ${ds.state ?? 'open'} pull requests.`;
      return `GitHub PRs (${ds.owner}/${ds.repo}) — ${prs.length}:\n\n` +
        prs.map((p, i) => `${i + 1}. #${p.number}: "${p.title}" by ${p.user?.login}`).join('\n\n');
    }

    case 'github_issues': {
      const creds = connectorEngine?.getCredentials('github');
      if (!creds?.token) return '⚠️ GitHub not connected.';
      if (!ds.owner || !ds.repo) return '⚠️ GitHub owner/repo not specified.';
      const { getIssues } = await import('../Automation/Github.js');
      const issues = await getIssues(creds, ds.owner, ds.repo, ds.state ?? 'open', 20);
      if (!issues.length) return `EMPTY: ${ds.owner}/${ds.repo} has no ${ds.state ?? 'open'} issues.`;
      return `GitHub Issues (${ds.owner}/${ds.repo}) — ${issues.length}:\n\n` +
        issues.map((iss, i) => `${i + 1}. #${iss.number}: "${iss.title}" by ${iss.user?.login}`).join('\n\n');
    }

    case 'github_commits': {
      const creds = connectorEngine?.getCredentials('github');
      if (!creds?.token) return '⚠️ GitHub not connected.';
      if (!ds.owner || !ds.repo) return '⚠️ GitHub owner/repo not specified.';
      const { getCommits } = await import('../Automation/Github.js');
      const commits = await getCommits(creds, ds.owner, ds.repo, ds.maxResults ?? 10);
      if (!commits.length) return `EMPTY: ${ds.owner}/${ds.repo} has no commits.`;
      return `GitHub Commits (${ds.owner}/${ds.repo}) — ${commits.length}:\n\n` +
        commits.map((c, i) =>
          `${i + 1}. ${c.commit.message.split('\n')[0]} — ${c.commit.author?.name}`
        ).join('\n');
    }

    case 'github_repos': {
      const creds = connectorEngine?.getCredentials('github');
      if (!creds?.token) return '⚠️ GitHub not connected.';
      const { getRepos } = await import('../Automation/Github.js');
      const repos = await getRepos(creds, ds.maxResults ?? 30);
      if (!repos.length) return 'EMPTY: No GitHub repositories found.';
      return `GitHub Repositories — ${repos.length} repos:\n\n` +
        repos.map((r, i) => `${i + 1}. ${r.full_name} [${r.language ?? 'unknown'}]`).join('\n');
    }

    case 'hacker_news': {
      const count = ds.count ?? 10;
      const typeMap = { top: 'topstories', new: 'newstories', best: 'beststories', ask: 'askstories' };
      const ids = await fetch(
        `https://hacker-news.firebaseio.com/v0/${typeMap[ds.hnType ?? 'top']}.json`
      ).then(r => r.json());
      const stories = await Promise.all(
        ids.slice(0, count).map(id =>
          fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json()).catch(() => null)
        )
      );
      const valid = stories.filter(Boolean);
      if (!valid.length) return 'EMPTY: No Hacker News stories found.';
      return `Hacker News ${ds.hnType ?? 'top'} stories:\n\n` +
        valid.map((s, i) => `${i + 1}. ${s.title} (${s.score} pts)`).join('\n\n');
    }

    case 'rss_feed': {
      if (!ds.url) return '⚠️ No RSS feed URL specified.';
      try {
        const xml = await fetch(ds.url, { headers: { 'User-Agent': 'openworld-agent/1.0' } }).then(r => r.text());
        const items = [];
        const max = ds.maxResults ?? 10;
        const extractTag = (str, tag) => {
          const m = new RegExp(`<${tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${tag}>`, 'i').exec(str);
          return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
        };
        const regex = xml.includes('<item')
          ? /<item[^>]*>([\s\S]*?)<\/item>/gi
          : /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
        let match;
        while ((match = regex.exec(xml)) !== null && items.length < max) {
          const title = extractTag(match[1], 'title');
          if (title) items.push(`${items.length + 1}. ${title}`);
        }
        return items.length ? `RSS Feed:\n\n${items.join('\n')}` : 'EMPTY: RSS feed returned no items.';
      } catch (err) { return `⚠️ RSS fetch failed: ${err.message}`; }
    }

    case 'reddit_posts': {
      if (!ds.subreddit?.trim()) return '⚠️ No subreddit specified.';
      try {
        const data = await fetch(
          `https://www.reddit.com/r/${ds.subreddit}/${ds.sort ?? 'hot'}.json?limit=${Math.min(ds.maxResults ?? 10, 25)}`,
          { headers: { 'User-Agent': 'openworld-agent/1.0' } }
        ).then(r => r.json());
        const posts = data.data?.children ?? [];
        if (!posts.length) return `EMPTY: r/${ds.subreddit} has no posts.`;
        return `r/${ds.subreddit}:\n\n` +
          posts.map((p, i) => `${i + 1}. ${p.data.title}`).join('\n\n');
      } catch (err) { return `⚠️ Reddit fetch failed: ${err.message}`; }
    }

    case 'read_file': {
      if (!ds.filePath) return '⚠️ No file path specified.';
      if (!fs.existsSync(ds.filePath)) return `⚠️ File not found: ${ds.filePath}`;
      const stat = fs.statSync(ds.filePath);
      if (stat.size > 500_000) return '⚠️ File too large (>500 KB).';
      const content = fs.readFileSync(ds.filePath, 'utf-8').trim();
      if (!content) return `EMPTY: File ${ds.filePath} is empty.`;
      return `File: ${ds.filePath}\n\n${content.slice(0, 6000)}`;
    }

    case 'system_stats': {
      const cpus = os.cpus(), total = os.totalmem(), free = os.freemem(), up = os.uptime();
      return [
        `System Stats (${new Date().toLocaleString()}):`,
        `Platform: ${process.platform} ${os.release()}`,
        `CPU: ${cpus[0]?.model?.trim()} (${cpus.length} cores)`,
        `Memory: ${(total / 1e9).toFixed(1)} GB total | ${(free / 1e9).toFixed(1)} GB free`,
        `Uptime: ${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m`,
      ].join('\n');
    }

    case 'weather': {
      if (!ds.location) return '⚠️ No location specified.';
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ds.location)}&count=1&format=json`
      ).then(r => r.json());
      if (!geo.results?.length) return `⚠️ Location not found: ${ds.location}`;
      const { latitude, longitude, name, country, timezone } = geo.results[0];
      const units = ds.units ?? 'celsius';
      const w = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation` +
        `&temperature_unit=${units}&wind_speed_unit=kmh&timezone=${encodeURIComponent(timezone ?? 'auto')}&forecast_days=1`
      ).then(r => r.json());
      const c = w.current, deg = units === 'fahrenheit' ? '°F' : '°C';
      return `Weather in ${name}, ${country}:\nTemp: ${c.temperature_2m}${deg}\nHumidity: ${c.relative_humidity_2m}%\nWind: ${c.wind_speed_10m} km/h`;
    }

    case 'crypto_price': {
      const coins = (ds.coins ?? 'bitcoin,ethereum').split(',').map(c => c.trim().toLowerCase()).join(',');
      const cur   = (ds.currency ?? 'usd').toLowerCase();
      const data  = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=${cur}&include_24hr_change=true`
      ).then(r => r.json());
      if (!Object.keys(data).length) return 'EMPTY: No crypto price data returned.';
      return `Crypto Prices:\n` +
        Object.entries(data).map(([coin, info]) =>
          `${coin}: ${info[cur]} ${cur.toUpperCase()} (${info[`${cur}_24h_change`]?.toFixed(2) ?? 'N/A'}% 24h)`
        ).join('\n');
    }

    case 'fetch_url': {
      if (!ds.url) return '⚠️ No URL specified.';
      try {
        const html = await fetch(ds.url, { headers: { 'User-Agent': 'openworld-agent/1.0' } }).then(r => r.text());
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
          .slice(0, 6000);
        if (!text) return `EMPTY: No readable content found at ${ds.url}`;
        return `Content from ${ds.url}:\n\n${text}`;
      } catch (err) { return `⚠️ Failed to fetch URL: ${err.message}`; }
    }

    case 'custom_context':
      return ds.context?.trim() || '(no context provided)';

    default:
      return `⚠️ Unknown data source type: "${type}"`;
  }
}

async function collectData(job, connectorEngine) {
  const sources = Array.isArray(job.dataSources) && job.dataSources.length
    ? job.dataSources
    : (job.dataSource?.type ? [job.dataSource] : []);
  if (!sources.length) return '(no data source configured)';
  if (sources.length === 1) return collectOneSource(sources[0], connectorEngine);
  const results = await Promise.all(sources.map(s => collectOneSource(s, connectorEngine)));
  return results
    .map((text, i) => `=== ${DS_LABELS[sources[i]?.type] ?? `Source ${i + 1}`} ===\n${text}`)
    .join('\n\n');
}

/* ══════════════════════════════════════════
   OUTPUT EXECUTORS
══════════════════════════════════════════ */
async function executeOutput(output, aiResponse, agent, job, connectorEngine) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  switch (output?.type) {

    case 'send_email': {
      const creds = connectorEngine?.getCredentials('gmail');
      if (!creds?.accessToken) throw new Error('Gmail not connected.');
      const { sendEmail } = await import('../Automation/Gmail.js');
      const subject = output.subject?.trim()
        ? output.subject.replace('{{date}}', dateStr).replace('{{agent}}', agent.name).replace('{{job}}', job.name ?? '')
        : `[${agent.name}] ${job.name ?? 'Report'} — ${dateStr}`;
      await sendEmail(creds, output.to, subject, aiResponse, output.cc ?? '', output.bcc ?? '');
      break;
    }

    case 'send_notification': {
      const { sendNotification } = await import('../Automation/Notification.js');
      sendNotification(
        output.title?.trim() || `${agent.name}: ${job.name ?? 'Report'}`,
        aiResponse.slice(0, 200) + (aiResponse.length > 200 ? '…' : ''),
        output.clickUrl ?? ''
      );
      break;
    }

    case 'write_file': {
      if (!output.filePath) throw new Error('write_file: no file path specified.');
      const dir = path.dirname(output.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const entry = `\n\n--- ${agent.name} / ${job.name ?? 'Job'} — ${now.toISOString()} ---\n${aiResponse}\n`;
      if (output.append) fs.appendFileSync(output.filePath, entry, 'utf-8');
      else               fs.writeFileSync(output.filePath, aiResponse, 'utf-8');
      break;
    }

    case 'append_to_memory': {
      try {
        const Paths = (await import('../Main/Paths.js')).default;
        const { readText, writeText } = await import('../Main/Services/UserService.js');
        const { invalidate } = await import('../Main/Services/SystemPromptService.js');
        const ts = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        writeText(
          Paths.MEMORY_FILE,
          (readText(Paths.MEMORY_FILE) || '') + `\n\n--- Agent: ${agent.name} (${ts}) ---\n${aiResponse}`
        );
        invalidate();
      } catch (err) { console.error('[AgentsEngine] append_to_memory failed:', err.message); }
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
          : JSON.stringify({ agent: agent.name, job: job.name ?? '', timestamp: now.toISOString(), result: aiResponse }),
      });
      break;
    }

    case 'github_pr_review': {
      const creds = connectorEngine?.getCredentials('github');
      if (!creds?.token) throw new Error('GitHub not connected.');
      if (!output.owner || !output.repo || !output.prNumber) {
        throw new Error('github_pr_review: owner, repo, and prNumber are required.');
      }
      const { createPRReview } = await import('../Automation/Github.js');
      const event = output.event ?? 'COMMENT';
      await createPRReview(creds, output.owner, output.repo, output.prNumber, {
        body: aiResponse,
        event,
      });
      break;
    }

    default:
      console.warn(`[AgentsEngine] Unknown output type: "${output?.type}"`);
  }
}

/* ══════════════════════════════════════════
   AGENTS ENGINE CLASS
══════════════════════════════════════════ */
export class AgentsEngine {
  constructor(agentsFilePath, connectorEngine = null) {
    this.filePath        = agentsFilePath;
    this.connectorEngine = connectorEngine;
    this.agents          = [];
    this._ticker         = null;
    this._running        = new Map();
  }

  start() {
    this._load();
    this._runStartupJobs();
    this._ticker = setInterval(() => this._checkScheduled(), 60_000);
    console.log('[AgentsEngine] Started —', this.agents.length, 'agent(s)');
  }

  stop()       { if (this._ticker) { clearInterval(this._ticker); this._ticker = null; } }
  reload()     { this._load(); }
  getAll()     { return this.agents; }
  getRunning() { return Array.from(this._running.values()); }

  /**
   * Clear all job history AND lastRun from every agent on disk.
   * This is the persistent wipe the Events "Clear" button needs.
   */
  clearAllHistory() {
    this._load(); // get latest from disk first
    for (const agent of this.agents) {
      for (const job of (agent.jobs ?? [])) {
        job.history = [];
        job.lastRun = null;
      }
    }
    this._persist();
    console.log('[AgentsEngine] All job history cleared.');
  }

  saveAgent(agent) {
    this._load();
    const idx = this.agents.findIndex(a => a.id === agent.id);
    if (idx >= 0) {
      const existing    = this.agents[idx];
      const updatedJobs = (agent.jobs ?? []).map(newJob => {
        const oldJob = (existing.jobs ?? []).find(j => j.id === newJob.id);
        return oldJob
          ? { ...newJob, history: oldJob.history ?? [], lastRun: oldJob.lastRun ?? null }
          : { ...newJob, history: [], lastRun: null };
      });
      this.agents[idx] = { ...existing, ...agent, jobs: updatedJobs };
    } else {
      this.agents.push({
        ...agent,
        jobs: (agent.jobs ?? []).map(j => ({ ...j, history: [], lastRun: null })),
      });
    }
    this._persist();
    return this.agents.find(a => a.id === agent.id) ?? agent;
  }

  deleteAgent(id) {
    this._load();
    this.agents = this.agents.filter(a => a.id !== id);
    this._persist();
  }

  toggleAgent(id, enabled) {
    this._load();
    const a = this.agents.find(a => a.id === id);
    if (a) { a.enabled = Boolean(enabled); this._persist(); }
  }

  async runNow(agentId) {
    this._load();
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) throw new Error(`Agent "${agentId}" not found`);
    for (const job of (agent.jobs ?? [])) {
      await this._executeJob(agent, job);
    }
    return { ok: true };
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data  = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        this.agents = Array.isArray(data.agents) ? data.agents : [];
      } else {
        this.agents = [];
      }
    } catch (err) { console.error('[AgentsEngine] _load error:', err); this.agents = []; }
  }

  _persist() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify({ agents: this.agents }, null, 2), 'utf-8');
    } catch (err) { console.error('[AgentsEngine] _persist error:', err); }
  }

  _runStartupJobs() {
    for (const agent of this.agents) {
      if (!agent.enabled) continue;
      for (const job of (agent.jobs ?? [])) {
        if (job.enabled !== false && job.trigger?.type === 'on_startup')
          this._executeJob(agent, job);
      }
    }
  }

  _checkScheduled() {
    const now = new Date();
    for (const agent of this.agents) {
      if (!agent.enabled) continue;
      for (const job of (agent.jobs ?? [])) {
        if (
          job.enabled !== false &&
          shouldRunNow({ trigger: job.trigger, lastRun: job.lastRun ?? null }, now)
        ) this._executeJob(agent, job);
      }
    }
  }

  async _executeJob(agent, job) {
    const runKey  = `${agent.id}__${job.id}`;
    const agentId = agent.id;
    const jobId   = job.id;
    console.log(`[AgentsEngine] Running "${job.name ?? job.id}" for "${agent.name}"`);

    this._running.set(runKey, {
      agentId,
      agentName: agent.name,
      jobId,
      jobName:   job.name || 'Job',
      startedAt: new Date().toISOString(),
      trigger:   job.trigger ?? null,
    });

    const entry = {
      timestamp:       new Date().toISOString(),
      acted:           false,
      skipped:         false,
      nothingToReport: false,
      error:           null,
      skipReason:      null,
      summary:         '',
      fullResponse:    '',
    };

    try {
      const dataText = await collectData(job, this.connectorEngine);

      const { readModelsWithKeys } = await import('../Main/Services/UserService.js');
      const allProviders = readModelsWithKeys();

      const systemPrompt = [
        `You are ${agent.name}, a proactive AI agent.`,
        agent.description ? agent.description : '',
        'Analyze the provided data and follow the task instruction.',
        '',
        'NOTHING-TO-REPORT RULE: If every data source is empty or there is genuinely nothing to act on, respond with ONLY the exact word [NOTHING].',
        '',
        'OUTPUT FORMAT: Write plain text only. No markdown. Write as if composing a clear professional email.',
      ].filter(Boolean).join(' ');

      const userMessage = [
        '=== DATA ===', dataText, '',
        '=== YOUR TASK ===',
        job.instruction ?? 'Analyze the above data and provide a helpful, actionable summary.',
      ].join('\n');

      const aiResponse = await callAIWithFailover(agent, systemPrompt, userMessage, allProviders);
      const trimmed    = aiResponse.trim();
      const isNothing  = trimmed === '[NOTHING]' || trimmed.toUpperCase() === '[NOTHING]';

      if (isNothing) {
        entry.skipped         = true;
        entry.nothingToReport = true;
        const sourceTypes = (Array.isArray(job.dataSources) && job.dataSources.length
          ? job.dataSources
          : (job.dataSource?.type ? [job.dataSource] : [])
        ).map(s => s.type).filter(Boolean);
        entry.skipReason = sourceTypes.length
          ? `No actionable data from: ${sourceTypes.join(', ')}.`
          : 'Data source returned nothing to act on.';
        entry.summary = entry.skipReason;
        console.log(`[AgentsEngine] "${job.name ?? job.id}" — nothing to report`);
      } else {
        entry.fullResponse = trimmed;
        entry.summary      = trimmed.slice(0, 400);
        await executeOutput(job.output ?? {}, trimmed, agent, job, this.connectorEngine);
        entry.acted = true;
        console.log(`[AgentsEngine] "${job.name ?? job.id}" — acted ✓`);
      }

    } catch (err) {
      entry.error   = err.message;
      entry.summary = `Error: ${err.message}`;
      console.error(`[AgentsEngine] "${job.name ?? job.id}" failed:`, err.message);
    } finally {
      this._running.delete(runKey);
    }

    // Re-find by ID — guards against concurrent _load() replacing this.agents
    const liveAgent = this.agents.find(a => a.id === agentId);
    const liveJob   = liveAgent?.jobs?.find(j => j.id === jobId);

    if (liveAgent && liveJob) {
      if (!Array.isArray(liveJob.history)) liveJob.history = [];
      liveJob.history.unshift(entry);
      if (liveJob.history.length > 30) liveJob.history = liveJob.history.slice(0, 30);
      if (!entry.error) liveJob.lastRun = entry.timestamp;
      this._persist();
    } else {
      console.warn(`[AgentsEngine] Agent/job ${agentId}/${jobId} not found after run — was it deleted?`);
    }
  }
}
