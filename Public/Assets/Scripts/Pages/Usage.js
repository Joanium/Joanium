// Window controls
import '../Shared/WindowControls.js';

// Modals / shared
import { initSidebar } from '../Shared/Sidebar.js';
import { initAboutModal } from '../Shared/Modals/AboutModal.js';
import { initLibraryModal } from '../Shared/Modals/LibraryModal.js';
import { initSettingsModal } from '../Shared/Modals/SettingsModal.js';

const about = initAboutModal();
const settings = initSettingsModal();

const library = initLibraryModal({
  onChatSelect: (chatId) => {
    if (chatId) localStorage.setItem('ow-pending-chat', chatId);
    window.electronAPI?.launchMain();
  },
});

const sidebar = initSidebar({
  activePage: 'usage',
  onNewChat: () => window.electronAPI?.launchMain(),
  onLibrary: () => library.isOpen() ? library.close() : library.open(),
  onAutomations: () => window.electronAPI?.launchAutomations?.(),
  onSkills: () => window.electronAPI?.launchSkills?.(),
  onPersonas: () => window.electronAPI?.launchPersonas?.(),
  onUsage: () => { /* already here */ },
  onSettings: () => settings.open(),
  onAbout: () => about.open(),
});

window.addEventListener('ow:user-profile-updated', e => sidebar.setUser(e.detail?.name ?? ''));
settings.loadUser().then(user => sidebar.setUser(user?.name ?? ''));

// ─────────────────────────────────────────────
//  PRICING  (built dynamically from Models.json)
//  Falls back to { in: 1, out: 3 } for unknown models.
// ─────────────────────────────────────────────

/** @type {Record<string, { in: number, out: number }>} */
let _pricing = {};

async function loadPricing() {
  try {
    const providers = await window.electronAPI?.getModels?.() ?? [];
    for (const provider of providers) {
      for (const [modelId, info] of Object.entries(provider.models ?? {})) {
        if (info.pricing) {
          _pricing[modelId] = { in: info.pricing.input, out: info.pricing.output };
        }
      }
    }
  } catch (err) {
    console.warn('[Usage] Could not load model pricing:', err);
  }
}

function tokenCost(model, inputTokens, outputTokens) {
  const p = _pricing[model] ?? { in: 1, out: 3 };
  return (inputTokens / 1_000_000) * p.in + (outputTokens / 1_000_000) * p.out;
}

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────

let _records = [];
let _range = 'today';

// ─────────────────────────────────────────────
//  RANGE FILTER
// ─────────────────────────────────────────────

function sinceDate(range) {
  const now = new Date();
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === '7') { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d; }
  if (range === '30') { const d = new Date(now); d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d; }
  return null;
}

function filteredRecords() {
  const since = sinceDate(_range);
  if (!since) return _records;
  return _records.filter(r => new Date(r.timestamp) >= since);
}

// ─────────────────────────────────────────────
//  COMPUTE STATS
// ─────────────────────────────────────────────

function computeStats(records) {
  let totalInput = 0, totalOutput = 0, totalCost = 0;
  const byModel = {}, byProvider = {}, byDay = {}, byHour = {}, byDow = {};

  for (const r of records) {
    const inp = r.inputTokens ?? 0;
    const out = r.outputTokens ?? 0;
    const cost = tokenCost(r.model, inp, out);
    totalInput += inp;
    totalOutput += out;
    totalCost += cost;

    // by model
    if (!byModel[r.model])
      byModel[r.model] = { name: r.modelName ?? r.model, input: 0, output: 0, calls: 0, cost: 0 };
    byModel[r.model].input += inp;
    byModel[r.model].output += out;
    byModel[r.model].calls += 1;
    byModel[r.model].cost += cost;

    // by provider
    const prov = r.provider ?? 'unknown';
    if (!byProvider[prov])
      byProvider[prov] = { input: 0, output: 0, calls: 0, cost: 0 };
    byProvider[prov].input += inp;
    byProvider[prov].output += out;
    byProvider[prov].calls += 1;
    byProvider[prov].cost += cost;

    // by day
    const day = r.timestamp.slice(0, 10);
    if (!byDay[day])
      byDay[day] = { input: 0, output: 0, calls: 0, cost: 0 };
    byDay[day].input += inp;
    byDay[day].output += out;
    byDay[day].calls += 1;
    byDay[day].cost += cost;

    // by hour (0–23)
    const hour = new Date(r.timestamp).getHours();
    if (!byHour[hour]) byHour[hour] = { calls: 0, tokens: 0 };
    byHour[hour].calls += 1;
    byHour[hour].tokens += inp + out;

    // by day of week (0=Sun … 6=Sat)
    const dow = new Date(r.timestamp).getDay();
    if (!byDow[dow]) byDow[dow] = { calls: 0, tokens: 0, cost: 0 };
    byDow[dow].calls += 1;
    byDow[dow].tokens += inp + out;
    byDow[dow].cost += cost;
  }

  return { totalInput, totalOutput, totalCost, count: records.length, byModel, byProvider, byDay, byHour, byDow };
}

// ─────────────────────────────────────────────
//  FORMATTERS
// ─────────────────────────────────────────────

function fmtTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function fmtCost(usd) {
  if (usd === 0) return '$0.00';
  if (usd < 0.001) return '<$0.001';
  if (usd < 1) return '$' + usd.toFixed(4);
  return '$' + usd.toFixed(3);
}

function fmtTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + 'm ago';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'h ago';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function providerLabel(id) {
  const m = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', openrouter: 'OpenRouter', mistral: 'Mistral AI' };
  return m[id] ?? id;
}

// ─────────────────────────────────────────────
//  CHART
// ─────────────────────────────────────────────

function buildDayList(range) {
  const days = range === 'today' ? 1 : range === '7' ? 7 : range === '30' ? 30 : 14;
  const list = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    list.push(d.toISOString().slice(0, 10));
  }
  return list;
}

function renderChart(byDay, range) {
  const wrap = document.getElementById('chart-wrap');
  const titleEl = document.getElementById('chart-title');
  const metaEl = document.getElementById('chart-meta');
  if (!wrap) return;

  const days = buildDayList(range === 'all' ? '30' : range);
  const W = 680, H = 140, PL = 44, PR = 12, PT = 10, PB = 36;
  const cW = W - PL - PR;
  const cH = H - PT - PB;

  const values = days.map(d => (byDay[d]?.input ?? 0) + (byDay[d]?.output ?? 0));
  const maxVal = Math.max(...values, 1);
  const barW = Math.max(4, Math.floor(cW / days.length) - 3);
  const barGap = (cW - barW * days.length) / Math.max(days.length - 1, 1);

  let barsHTML = '', labelsHTML = '';
  const totalShown = values.reduce((a, b) => a + b, 0);
  if (metaEl) metaEl.textContent = fmtTokens(totalShown) + ' total';
  if (titleEl) titleEl.textContent = range === 'all' ? 'Last 30 days (tokens)' :
    range === 'today' ? 'Today (tokens)' : `Last ${range} days (tokens)`;

  days.forEach((date, i) => {
    const x = PL + i * (barW + barGap);
    const inp = byDay[date]?.input ?? 0;
    const out = byDay[date]?.output ?? 0;
    const inH = inp > 0 ? Math.max(1, (inp / maxVal) * cH) : 0;
    const outH = out > 0 ? Math.max(1, (out / maxVal) * cH) : 0;

    barsHTML += `
      <rect x="${x}" y="${PT + cH - inH}" width="${barW}" height="${inH}" rx="2"
        fill="var(--accent)" opacity="0.55">
        <title>${date}: ${fmtTokens(inp)} input, ${fmtTokens(out)} output</title>
      </rect>
      <rect x="${x}" y="${PT + cH - inH - outH}" width="${barW}" height="${outH}" rx="2"
        fill="var(--accent)" opacity="0.9">
        <title>${date}: ${fmtTokens(out)} output</title>
      </rect>`;

    const step = days.length <= 7 ? 1 : days.length <= 14 ? 2 : 5;
    if (i % step === 0 || i === days.length - 1) {
      const label = days.length === 1 ? 'Today' : date.slice(5);
      labelsHTML += `<text x="${x + barW / 2}" y="${H - 8}" text-anchor="middle"
        font-size="9" fill="var(--text-muted)" font-family="var(--font-ui)">${label}</text>`;
    }
  });

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];
  let yLabels = '';
  yTicks.forEach(t => {
    const yPos = PT + cH - t * cH;
    yLabels += `
      <text x="${PL - 4}" y="${yPos + 3}" text-anchor="end" font-size="8"
        fill="var(--text-muted)" font-family="var(--font-mono)">${fmtTokens(Math.round(maxVal * t))}</text>
      <line x1="${PL}" y1="${yPos}" x2="${W - PR}" y2="${yPos}"
        stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="3,3"/>`;
  });

  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="usage-chart-svg">
    ${yLabels}${barsHTML}${labelsHTML}
    <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT + cH}" stroke="var(--border)" stroke-width="0.8"/>
    <line x1="${PL}" y1="${PT + cH}" x2="${W - PR}" y2="${PT + cH}" stroke="var(--border)" stroke-width="0.8"/>
  </svg>`;
}

// ─────────────────────────────────────────────
//  INSIGHTS
// ─────────────────────────────────────────────

function renderInsights(stats, records) {
  const el = document.getElementById('insights-list');
  if (!el) return;

  if (!records.length) {
    el.innerHTML = '<div class="insight-empty">No data yet for this period.</div>';
    return;
  }

  const insights = [];

  // Most used model
  const topModel = Object.entries(stats.byModel).sort(([, a], [, b]) => b.calls - a.calls)[0];
  if (topModel) {
    insights.push({
      icon: '🏆',
      title: 'Most used model',
      text: `<strong>${topModel[1].name}</strong> with ${topModel[1].calls} call${topModel[1].calls !== 1 ? 's' : ''} and ${fmtTokens(topModel[1].input + topModel[1].output)} tokens.`,
    });
  }

  // Peak hour
  const peakHourEntry = Object.entries(stats.byHour).sort(([, a], [, b]) => b.calls - a.calls)[0];
  if (peakHourEntry) {
    const h = parseInt(peakHourEntry[0]);
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
    insights.push({
      icon: '⏰',
      title: 'Peak hour',
      text: `You chat most at <strong>${label}</strong> — ${peakHourEntry[1].calls} call${peakHourEntry[1].calls !== 1 ? 's' : ''} in this period.`,
    });
  }

  // Busiest day
  const busiestDay = Object.entries(stats.byDay).sort(([, a], [, b]) => b.calls - a.calls)[0];
  if (busiestDay) {
    const dayLabel = new Date(busiestDay[0] + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    insights.push({
      icon: '📅',
      title: 'Busiest day',
      text: `<strong>${dayLabel}</strong> with ${busiestDay[1].calls} call${busiestDay[1].calls !== 1 ? 's' : ''} and ${fmtTokens(busiestDay[1].input + busiestDay[1].output)} tokens.`,
    });
  }

  // Input vs output ratio
  const total = stats.totalInput + stats.totalOutput;
  if (total > 0) {
    const outPct = Math.round((stats.totalOutput / total) * 100);
    const verdict = outPct > 60 ? 'Output-heavy — the AI is doing a lot of writing.'
      : outPct < 30 ? 'Input-heavy — you\'re sending long prompts or documents.'
        : 'Balanced mix of input and output tokens.';
    insights.push({
      icon: '⚖️',
      title: 'Token ratio',
      text: `${outPct}% output, ${100 - outPct}% input. ${verdict}`,
    });
  }

  // Most expensive model
  const priciest = Object.entries(stats.byModel).sort(([, a], [, b]) => b.cost - a.cost)[0];
  if (priciest && priciest[1].cost > 0) {
    insights.push({
      icon: '💸',
      title: 'Highest cost model',
      text: `<strong>${priciest[1].name}</strong> has cost ${fmtCost(priciest[1].cost)} this period.`,
    });
  }

  // Average tokens per call
  if (stats.count > 0) {
    const avg = Math.round(total / stats.count);
    const verdict = avg > 4000 ? 'Long conversations — lots of context per call.'
      : avg < 500 ? 'Short, snappy exchanges.'
        : 'Medium-length conversations.';
    insights.push({
      icon: '📊',
      title: 'Avg tokens per call',
      text: `<strong>${fmtTokens(avg)}</strong> tokens on average. ${verdict}`,
    });
  }

  // Provider diversity
  const provCount = Object.keys(stats.byProvider).length;
  if (provCount > 1) {
    const provNames = Object.keys(stats.byProvider).map(providerLabel).join(', ');
    insights.push({
      icon: '🔀',
      title: 'Multi-provider',
      text: `You're using <strong>${provCount} providers</strong> this period: ${provNames}.`,
    });
  }

  // ── 4 NEW INSIGHTS ──────────────────────────────────────────────────────

  // 1. Most cost-efficient model (lowest cost per 1K tokens, among models with >0 cost)
  const efficientModels = Object.entries(stats.byModel)
    .filter(([, v]) => v.cost > 0 && (v.input + v.output) > 0);
  if (efficientModels.length > 0) {
    const [, bestEff] = efficientModels.sort(([, a], [, b]) => {
      const ratioA = a.cost / ((a.input + a.output) / 1_000);
      const ratioB = b.cost / ((b.input + b.output) / 1_000);
      return ratioA - ratioB;
    })[0];
    const costPer1K = (bestEff.cost / ((bestEff.input + bestEff.output) / 1_000)).toFixed(6);
    insights.push({
      icon: '🎯',
      title: 'Most efficient model',
      text: `<strong>${bestEff.name}</strong> gives the best value at $${costPer1K} per 1K tokens — lowest cost-per-token this period.`,
    });
  }

  // 2. Weekend vs weekday activity
  const WEEKEND_DAYS = [0, 6]; // Sun, Sat
  let weekendCalls = 0, weekdayCalls = 0;
  for (const [dow, data] of Object.entries(stats.byDow)) {
    if (WEEKEND_DAYS.includes(parseInt(dow))) weekendCalls += data.calls;
    else weekdayCalls += data.calls;
  }
  if (weekendCalls + weekdayCalls > 0) {
    const heavier = weekendCalls > weekdayCalls ? 'weekends' : 'weekdays';
    const ratio = weekendCalls > weekdayCalls
      ? (weekendCalls / Math.max(weekdayCalls, 1)).toFixed(1)
      : (weekdayCalls / Math.max(weekendCalls, 1)).toFixed(1);
    const weekendVerdict = weekendCalls === 0 ? 'No weekend usage — strictly a weekday user.'
      : weekdayCalls === 0 ? 'Weekend-only usage — you save AI for your free time.'
        : `You use AI <strong>${ratio}×</strong> more on <strong>${heavier}</strong>. ${heavier === 'weekends' ? 'Weekend warrior! 🏄' : 'Strictly business. 💼'}`;
    insights.push({
      icon: '📆',
      title: 'Weekend vs weekday',
      text: weekendVerdict,
    });
  }

  // 3. Provider cost leader (most expensive provider)
  const costLeader = Object.entries(stats.byProvider)
    .filter(([, v]) => v.cost > 0)
    .sort(([, a], [, b]) => b.cost - a.cost)[0];
  if (costLeader) {
    const [leaderId, leaderData] = costLeader;
    const shareOfTotal = stats.totalCost > 0
      ? Math.round((leaderData.cost / stats.totalCost) * 100)
      : 100;
    insights.push({
      icon: '🏦',
      title: 'Top spending provider',
      text: `<strong>${providerLabel(leaderId)}</strong> accounts for <strong>${shareOfTotal}%</strong> of your total spend (${fmtCost(leaderData.cost)}) across ${leaderData.calls} call${leaderData.calls !== 1 ? 's' : ''}.`,
    });
  }

  // 4. Output verbosity — avg output tokens per call
  if (stats.count > 0 && stats.totalOutput > 0) {
    const avgOut = Math.round(stats.totalOutput / stats.count);
    const verbosity = avgOut > 800 ? 'Very verbose — the AI writes long, detailed responses.'
      : avgOut > 300 ? 'Moderately detailed responses.'
        : 'Concise replies — short and to the point.';
    const topOutputModel = Object.entries(stats.byModel)
      .filter(([, v]) => v.calls > 0)
      .sort(([, a], [, b]) => (b.output / b.calls) - (a.output / a.calls))[0];
    const modelNote = topOutputModel
      ? ` <strong>${topOutputModel[1].name}</strong> is your most verbose model.`
      : '';
    insights.push({
      icon: '✍️',
      title: 'Response verbosity',
      text: `Avg <strong>${fmtTokens(avgOut)}</strong> output tokens per call. ${verbosity}${modelNote}`,
    });
  }

  el.innerHTML = insights.map(ins => `
    <div class="insight-card">
      <div class="insight-icon">${ins.icon}</div>
      <div class="insight-body">
        <div class="insight-title">${ins.title}</div>
        <div class="insight-text">${ins.text}</div>
      </div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────
//  HOURLY HEATMAP
// ─────────────────────────────────────────────

function renderHeatmap(byHour) {
  const wrap = document.getElementById('heatmap-wrap');
  if (!wrap) return;

  const maxCalls = Math.max(...Object.values(byHour).map(v => v.calls), 1);

  wrap.innerHTML = Array.from({ length: 24 }, (_, h) => {
    const data = byHour[h] ?? { calls: 0 };
    const opacity = data.calls > 0 ? Math.max(0.08, data.calls / maxCalls) : 0.04;
    const label = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;
    return `
      <div class="heatmap-cell" title="${label}: ${data.calls} call${data.calls !== 1 ? 's' : ''}" style="--cell-opacity:${opacity.toFixed(2)}">
        ${data.calls > 0 ? `<div class="heatmap-count">${data.calls}</div>` : ''}
        <div class="heatmap-label">${label}</div>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
//  DAY OF WEEK
// ─────────────────────────────────────────────

function renderDow(byDow) {
  const wrap = document.getElementById('dow-wrap');
  if (!wrap) return;

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxCalls = Math.max(...DAYS.map((_, i) => byDow[i]?.calls ?? 0), 1);

  wrap.innerHTML = DAYS.map((day, i) => {
    const data = byDow[i] ?? { calls: 0, cost: 0 };
    const pct = Math.round((data.calls / maxCalls) * 100);
    return `
      <div class="dow-row">
        <span class="dow-label">${day}</span>
        <div class="dow-bar-track">
          <div class="dow-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="dow-stat">${data.calls} call${data.calls !== 1 ? 's' : ''}</span>
        <span class="dow-cost">${fmtCost(data.cost)}</span>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
//  COST TABLE
// ─────────────────────────────────────────────

function renderCostTable(byModel) {
  const el = document.getElementById('cost-table-body');
  if (!el) return;

  const sorted = Object.entries(byModel)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .slice(0, 10);

  if (!sorted.length) {
    el.innerHTML = '<div class="cost-empty">No cost data for this period.</div>';
    return;
  }

  const totalCost = sorted.reduce((sum, [, v]) => sum + v.cost, 0);
  const maxCost = sorted[0][1].cost;

  el.innerHTML = sorted.map(([modelId, v], i) => {
    const share = totalCost > 0 ? Math.round((v.cost / totalCost) * 100) : 0;
    const barPct = maxCost > 0 ? Math.round((v.cost / maxCost) * 100) : 0;
    return `
      <div class="cost-row">
        <div class="cost-row-rank">#${i + 1}</div>
        <div class="cost-row-info">
          <div class="cost-row-name" title="${modelId}">${v.name}</div>
          <div class="cost-row-meta">${v.calls} call${v.calls !== 1 ? 's' : ''} · ${fmtTokens(v.input + v.output)} tokens</div>
          <div class="cost-row-bar-wrap"><div class="cost-row-bar" style="width:${barPct}%"></div></div>
        </div>
        <div class="cost-row-figures">
          <div class="cost-row-total">${fmtCost(v.cost)}</div>
          <div class="cost-row-share">${share}% of total</div>
        </div>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
//  SUMMARY CARDS
// ─────────────────────────────────────────────

function renderSummary(stats, records) {
  const grid = document.getElementById('summary-grid');
  if (!grid) return;

  const avgPerMsg = stats.count > 0 ? Math.round((stats.totalInput + stats.totalOutput) / stats.count) : 0;
  const uniqueModels = new Set(records.map(r => r.model)).size;
  const avgCostPerCall = stats.count > 0 ? stats.totalCost / stats.count : 0;

  const cards = [
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke-linecap="round"/></svg>`,
      label: 'Total tokens',
      value: fmtTokens(stats.totalInput + stats.totalOutput),
      sub: `${fmtTokens(stats.totalInput)} in · ${fmtTokens(stats.totalOutput)} out`,
      cls: '',
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      label: 'API calls',
      value: stats.count.toLocaleString(),
      sub: `avg ${fmtTokens(avgPerMsg)} tokens each`,
      cls: '',
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23" stroke-linecap="round"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke-linecap="round"/></svg>`,
      label: 'Est. cost',
      value: fmtCost(stats.totalCost),
      sub: 'based on published pricing',
      cls: 'cost-card',
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v4H4zM4 12h16v4H4z" stroke-linejoin="round"/></svg>`,
      label: 'Input tokens',
      value: fmtTokens(stats.totalInput),
      sub: `${stats.totalInput > 0 ? Math.round(stats.totalInput / (stats.totalInput + stats.totalOutput + 0.001) * 100) : 0}% of total`,
      cls: '',
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      label: 'Output tokens',
      value: fmtTokens(stats.totalOutput),
      sub: `${stats.totalOutput > 0 ? Math.round(stats.totalOutput / (stats.totalInput + stats.totalOutput + 0.001) * 100) : 0}% of total`,
      cls: '',
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
      label: 'Models used',
      value: uniqueModels.toString(),
      sub: `across ${Object.keys(stats.byProvider).length} provider${Object.keys(stats.byProvider).length !== 1 ? 's' : ''}`,
      cls: '',
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      label: 'Avg cost / call',
      value: fmtCost(avgCostPerCall),
      sub: stats.count > 0 ? `over ${stats.count} call${stats.count !== 1 ? 's' : ''}` : 'no calls yet',
      cls: '',
    },
  ];

  grid.innerHTML = cards.map((c, i) => `
    <div class="usage-card ${c.cls}" style="animation-delay:${i * 0.05}s">
      <div class="usage-card-icon">${c.icon}</div>
      <div class="usage-card-label">${c.label}</div>
      <div class="usage-card-value">${c.value}</div>
      <div class="usage-card-sub">${c.sub}</div>
    </div>
  `).join('');
}

function renderModelRows(byModel) {
  const el = document.getElementById('model-rows');
  const meta = document.getElementById('model-meta');
  if (!el) return;

  const sorted = Object.entries(byModel).sort(([, a], [, b]) => (b.input + b.output) - (a.input + a.output));
  if (meta) meta.textContent = `${sorted.length} model${sorted.length !== 1 ? 's' : ''}`;

  if (!sorted.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No model data yet</div>';
    return;
  }

  const maxTok = Math.max(...sorted.map(([, v]) => v.input + v.output), 1);
  el.innerHTML = sorted.map(([modelId, v]) => {
    const total = v.input + v.output;
    const pct = Math.round((total / maxTok) * 100);
    return `
      <div class="model-row">
        <div class="model-row-header">
          <span class="model-row-name" title="${modelId}">${v.name}</span>
          <div class="model-row-stats">
            <span class="model-row-tokens">${fmtTokens(total)} tokens · ${v.calls} call${v.calls !== 1 ? 's' : ''}</span>
            <span class="model-row-cost">${fmtCost(v.cost)}</span>
          </div>
        </div>
        <div class="model-bar-track">
          <div class="model-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

function renderProviders(byProvider) {
  const el = document.getElementById('provider-grid');
  if (!el) return;

  const sorted = Object.entries(byProvider).sort(([, a], [, b]) => (b.input + b.output) - (a.input + a.output));

  if (!sorted.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;grid-column:1/-1">No provider data yet</div>';
    return;
  }

  el.innerHTML = sorted.map(([id, v]) => `
    <div class="provider-card">
      <div class="provider-name">${providerLabel(id)}</div>
      <div class="provider-tokens">${fmtTokens(v.input + v.output)} tokens</div>
      <div class="provider-cost">${fmtCost(v.cost)}</div>
      <div class="provider-calls">${v.calls} call${v.calls !== 1 ? 's' : ''}</div>
    </div>
  `).join('');
}

function renderActivity(records) {
  const el = document.getElementById('activity-list');
  const meta = document.getElementById('activity-meta');
  if (!el) return;

  const recent = [...records].reverse().slice(0, 50);
  if (meta) meta.textContent = `last ${Math.min(records.length, 50)} calls`;

  if (!recent.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:18px;text-align:center">No activity yet — start chatting!</div>';
    return;
  }

  el.innerHTML = recent.map(r => {
    const total = (r.inputTokens ?? 0) + (r.outputTokens ?? 0);
    const cost = tokenCost(r.model, r.inputTokens ?? 0, r.outputTokens ?? 0);
    return `
      <div class="activity-item">
        <div class="activity-dot"></div>
        <span class="activity-model">${r.modelName ?? r.model}</span>
        <span class="activity-tokens">${fmtTokens(total)}</span>
        <span class="activity-cost">${fmtCost(cost)}</span>
        <span class="activity-time">${fmtTime(r.timestamp)}</span>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
//  EMPTY STATE
// ─────────────────────────────────────────────

function showEmpty() {
  const summaryGrid = document.getElementById('summary-grid');
  if (summaryGrid) summaryGrid.innerHTML = `
    <div class="usage-empty" style="grid-column:1/-1">
      <div class="usage-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:24px;height:24px">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h3>No usage data yet</h3>
      <p>Start chatting and your token usage will appear here in real time.</p>
    </div>`;

  const hideIds = [
    'chart-section', 'provider-section', 'model-section', 'activity-section',
    'insights-section', 'heatmap-section', 'dow-section', 'cost-table-section',
  ];
  hideIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function showSections() {
  const showIds = [
    'chart-section', 'provider-section', 'model-section', 'activity-section',
    'insights-section', 'heatmap-section', 'dow-section', 'cost-table-section',
  ];
  showIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });
}

// ─────────────────────────────────────────────
//  MAIN RENDER
// ─────────────────────────────────────────────

function render() {
  const records = filteredRecords();
  const stats = computeStats(records);

  if (!_records.length) { showEmpty(); return; }

  showSections();
  renderSummary(stats, records);
  renderInsights(stats, records);
  renderChart(stats.byDay, _range);
  renderHeatmap(stats.byHour);
  renderDow(stats.byDow);
  renderCostTable(stats.byModel);
  renderModelRows(stats.byModel);
  renderProviders(stats.byProvider);
  renderActivity(records);
}

// ─────────────────────────────────────────────
//  LOAD
// ─────────────────────────────────────────────

async function load() {
  try {
    const res = await window.electronAPI?.getUsage?.();
    if (res?.ok) _records = res.records ?? [];
  } catch (err) {
    console.error('[Usage] load error:', err);
  }
  render();
}

// ─────────────────────────────────────────────
//  RANGE BUTTONS
// ─────────────────────────────────────────────

document.querySelectorAll('.usage-range-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.usage-range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _range = btn.dataset.range;
    render();
  });
});

// ─────────────────────────────────────────────
//  REFRESH BUTTON
// ─────────────────────────────────────────────

document.getElementById('refresh-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('refresh-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Refreshing…'; }
  await load();
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M23 4v6h-6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M1 20v-6h6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke-linecap="round" stroke-linejoin="round"/>
    </svg> Refresh`;
  }
});

// ─────────────────────────────────────────────
//  CLEAR DATA
// ─────────────────────────────────────────────

const overlay = document.getElementById('confirm-overlay');
const confirmCancel = document.getElementById('confirm-cancel');
const confirmDelete = document.getElementById('confirm-delete');
const clearBtn = document.getElementById('clear-usage-btn');

clearBtn?.addEventListener('click', () => overlay?.classList.add('open'));
confirmCancel?.addEventListener('click', () => overlay?.classList.remove('open'));
overlay?.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

confirmDelete?.addEventListener('click', async () => {
  overlay?.classList.remove('open');
  await window.electronAPI?.clearUsage?.();
  _records = [];
  render();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') overlay?.classList.remove('open');
});

// ─────────────────────────────────────────────
//  BOOT  — load pricing first, then data (no polling)
// ─────────────────────────────────────────────

loadPricing().then(() => load());