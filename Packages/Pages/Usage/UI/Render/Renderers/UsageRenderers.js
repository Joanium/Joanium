import { fmtTokens, fmtCost, fmtTime, providerLabel, buildDayList } from '../Formatters/UsageFormatters.js';

export function renderInsights(stats, records) {
  const element = document.getElementById('insights-list');
  if (!element) return;

  if (!records.length) {
    element.innerHTML = '<div class="insight-empty">No data yet for this period.</div>';
    return;
  }

  const insights = [];

  const topModel = Object.entries(stats.byModel).sort(([, a], [, b]) => b.calls - a.calls)[0];
  if (topModel) {
    insights.push({ icon: 'Top', title: 'Most used model', text: `<strong>${topModel[1].name}</strong> with ${topModel[1].calls} call${topModel[1].calls !== 1 ? 's' : ''} and ${fmtTokens(topModel[1].input + topModel[1].output)} tokens.` });
  }

  const peakHourEntry = Object.entries(stats.byHour).sort(([, a], [, b]) => b.calls - a.calls)[0];
  if (peakHourEntry) {
    const hour = parseInt(peakHourEntry[0], 10);
    const label = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
    insights.push({ icon: 'Hour', title: 'Peak hour', text: `You chat most at <strong>${label}</strong> - ${peakHourEntry[1].calls} call${peakHourEntry[1].calls !== 1 ? 's' : ''} in this period.` });
  }

  const busiestDay = Object.entries(stats.byDay).sort(([, a], [, b]) => b.calls - a.calls)[0];
  if (busiestDay) {
    const dayLabel = new Date(`${busiestDay[0]}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    insights.push({ icon: 'Day', title: 'Busiest day', text: `<strong>${dayLabel}</strong> with ${busiestDay[1].calls} call${busiestDay[1].calls !== 1 ? 's' : ''} and ${fmtTokens(busiestDay[1].input + busiestDay[1].output)} tokens.` });
  }

  const totalTokens = stats.totalInput + stats.totalOutput;
  if (totalTokens > 0) {
    const outputPercent = Math.round((stats.totalOutput / totalTokens) * 100);
    const verdict = outputPercent > 60 ? 'Output-heavy - the AI is doing a lot of writing.' : outputPercent < 30 ? 'Input-heavy - you are sending long prompts or documents.' : 'Balanced mix of input and output tokens.';
    insights.push({ icon: 'Mix', title: 'Token ratio', text: `${outputPercent}% output, ${100 - outputPercent}% input. ${verdict}` });
  }

  const priciest = Object.entries(stats.byModel).sort(([, a], [, b]) => b.cost - a.cost)[0];
  if (priciest && priciest[1].cost > 0) {
    insights.push({ icon: 'Cost', title: 'Highest cost model', text: `<strong>${priciest[1].name}</strong> has cost ${fmtCost(priciest[1].cost)} this period.` });
  }

  if (stats.count > 0) {
    const avgTokens = Math.round(totalTokens / stats.count);
    const verdict = avgTokens > 4000 ? 'Long conversations - lots of context per call.' : avgTokens < 500 ? 'Short, snappy exchanges.' : 'Medium-length conversations.';
    insights.push({ icon: 'Avg', title: 'Avg tokens per call', text: `<strong>${fmtTokens(avgTokens)}</strong> tokens on average. ${verdict}` });
  }

  const providerCount = Object.keys(stats.byProvider).length;
  if (providerCount > 1) {
    const providerNames = Object.keys(stats.byProvider).map(providerLabel).join(', ');
    insights.push({ icon: 'Net', title: 'Multi-provider', text: `You are using <strong>${providerCount} providers</strong> this period: ${providerNames}.` });
  }

  const efficientModels = Object.entries(stats.byModel).filter(([, value]) => value.cost > 0 && (value.input + value.output) > 0);
  if (efficientModels.length > 0) {
    const [, bestEfficient] = efficientModels.sort(([, a], [, b]) => {
      const ratioA = a.cost / ((a.input + a.output) / 1_000);
      const ratioB = b.cost / ((b.input + b.output) / 1_000);
      return ratioA - ratioB;
    })[0];
    const costPer1k = (bestEfficient.cost / ((bestEfficient.input + bestEfficient.output) / 1_000)).toFixed(6);
    insights.push({ icon: 'Eff', title: 'Most efficient model', text: `<strong>${bestEfficient.name}</strong> gives the best value at $${costPer1k} per 1K tokens this period.` });
  }

  let weekendCalls = 0;
  let weekdayCalls = 0;
  for (const [dow, data] of Object.entries(stats.byDow)) {
    if ([0, 6].includes(parseInt(dow, 10))) weekendCalls += data.calls;
    else weekdayCalls += data.calls;
  }
  if (weekendCalls + weekdayCalls > 0) {
    const heavier = weekendCalls > weekdayCalls ? 'weekends' : 'weekdays';
    const ratio = weekendCalls > weekdayCalls ? (weekendCalls / Math.max(weekdayCalls, 1)).toFixed(1) : (weekdayCalls / Math.max(weekendCalls, 1)).toFixed(1);
    const verdict = weekendCalls === 0 ? 'No weekend usage - strictly a weekday user.' : weekdayCalls === 0 ? 'Weekend-only usage - you save AI for free time.' : `You use AI <strong>${ratio}x</strong> more on <strong>${heavier}</strong>.`;
    insights.push({ icon: 'Week', title: 'Weekend vs weekday', text: verdict });
  }

  const costLeader = Object.entries(stats.byProvider).filter(([, value]) => value.cost > 0).sort(([, a], [, b]) => b.cost - a.cost)[0];
  if (costLeader) {
    const [providerId, providerData] = costLeader;
    const shareOfTotal = stats.totalCost > 0 ? Math.round((providerData.cost / stats.totalCost) * 100) : 100;
    insights.push({ icon: 'Prov', title: 'Top spending provider', text: `<strong>${providerLabel(providerId)}</strong> accounts for <strong>${shareOfTotal}%</strong> of your total spend (${fmtCost(providerData.cost)}) across ${providerData.calls} call${providerData.calls !== 1 ? 's' : ''}.` });
  }

  if (stats.count > 0 && stats.totalOutput > 0) {
    const avgOutput = Math.round(stats.totalOutput / stats.count);
    const verbosity = avgOutput > 800 ? 'Very verbose - the AI writes long, detailed responses.' : avgOutput > 300 ? 'Moderately detailed responses.' : 'Concise replies - short and to the point.';
    const topOutputModel = Object.entries(stats.byModel).filter(([, value]) => value.calls > 0).sort(([, a], [, b]) => (b.output / b.calls) - (a.output / a.calls))[0];
    const modelNote = topOutputModel ? ` <strong>${topOutputModel[1].name}</strong> is your most verbose model.` : '';
    insights.push({ icon: 'Out', title: 'Response verbosity', text: `Avg <strong>${fmtTokens(avgOutput)}</strong> output tokens per call. ${verbosity}${modelNote}` });
  }

  element.innerHTML = insights.map(insight => `
    <div class="insight-card">
      <div class="insight-icon">${insight.icon}</div>
      <div class="insight-body">
        <div class="insight-title">${insight.title}</div>
        <div class="insight-text">${insight.text}</div>
      </div>
    </div>
  `).join('');
}

export function renderChart(byDay, range) {
  const wrap = document.getElementById('chart-wrap');
  const titleElement = document.getElementById('chart-title');
  const metaElement = document.getElementById('chart-meta');
  if (!wrap) return;

  const days = buildDayList(range === 'all' ? '30' : range);
  const width = 680, height = 140, paddingLeft = 44, paddingRight = 12, paddingTop = 10, paddingBottom = 36;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const values = days.map(day => (byDay[day]?.input ?? 0) + (byDay[day]?.output ?? 0));
  const maxValue = Math.max(...values, 1);
  const barWidth = Math.max(4, Math.floor(chartWidth / days.length) - 3);
  const barGap = (chartWidth - barWidth * days.length) / Math.max(days.length - 1, 1);

  let barsHTML = '';
  let labelsHTML = '';
  const totalShown = values.reduce((sum, value) => sum + value, 0);
  if (metaElement) metaElement.textContent = `${fmtTokens(totalShown)} total`;
  if (titleElement) {
    titleElement.textContent = range === 'all' ? 'Last 30 days (tokens)' : range === 'today' ? 'Today (tokens)' : `Last ${range} days (tokens)`;
  }

  days.forEach((date, index) => {
    const x = paddingLeft + index * (barWidth + barGap);
    const input = byDay[date]?.input ?? 0;
    const output = byDay[date]?.output ?? 0;
    const inputHeight = input > 0 ? Math.max(1, (input / maxValue) * chartHeight) : 0;
    const outputHeight = output > 0 ? Math.max(1, (output / maxValue) * chartHeight) : 0;

    barsHTML += `
      <rect x="${x}" y="${paddingTop + chartHeight - inputHeight}" width="${barWidth}" height="${inputHeight}" rx="2"
        fill="var(--accent)" opacity="0.55"><title>${date}: ${fmtTokens(input)} input, ${fmtTokens(output)} output</title></rect>
      <rect x="${x}" y="${paddingTop + chartHeight - inputHeight - outputHeight}" width="${barWidth}" height="${outputHeight}" rx="2"
        fill="var(--accent)" opacity="0.9"><title>${date}: ${fmtTokens(output)} output</title></rect>`;

    const step = days.length <= 7 ? 1 : days.length <= 14 ? 2 : 5;
    if (index % step === 0 || index === days.length - 1) {
      const label = days.length === 1 ? 'Today' : date.slice(5);
      labelsHTML += `<text x="${x + barWidth / 2}" y="${height - 8}" text-anchor="middle" font-size="9" fill="var(--text-muted)" font-family="var(--font-ui)">${label}</text>`;
    }
  });

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  let yLabels = '';
  yTicks.forEach(tick => {
    const yPos = paddingTop + chartHeight - tick * chartHeight;
    yLabels += `
      <text x="${paddingLeft - 4}" y="${yPos + 3}" text-anchor="end" font-size="8" fill="var(--text-muted)" font-family="var(--font-mono)">${fmtTokens(Math.round(maxValue * tick))}</text>
      <line x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="3,3"/>`;
  });

  wrap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="usage-chart-svg">
    ${yLabels}${barsHTML}${labelsHTML}
    <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + chartHeight}" stroke="var(--border)" stroke-width="0.8"/>
    <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight}" stroke="var(--border)" stroke-width="0.8"/>
  </svg>`;
}

export function renderHeatmap(byHour) {
  const wrap = document.getElementById('heatmap-wrap');
  if (!wrap) return;
  const maxCalls = Math.max(...Object.values(byHour).map(value => value.calls), 1);
  wrap.innerHTML = Array.from({ length: 24 }, (_, hour) => {
    const data = byHour[hour] ?? { calls: 0 };
    const opacity = data.calls > 0 ? Math.max(0.08, data.calls / maxCalls) : 0.04;
    const label = hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`;
    return `
      <div class="heatmap-cell" title="${label}: ${data.calls} call${data.calls !== 1 ? 's' : ''}" style="--cell-opacity:${opacity.toFixed(2)}">
        ${data.calls > 0 ? `<div class="heatmap-count">${data.calls}</div>` : ''}
        <div class="heatmap-label">${label}</div>
      </div>`;
  }).join('');
}

export function renderDow(byDow) {
  const wrap = document.getElementById('dow-wrap');
  if (!wrap) return;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxCalls = Math.max(...days.map((_, index) => byDow[index]?.calls ?? 0), 1);
  wrap.innerHTML = days.map((day, index) => {
    const data = byDow[index] ?? { calls: 0, cost: 0 };
    const percent = Math.round((data.calls / maxCalls) * 100);
    return `
      <div class="dow-row">
        <span class="dow-label">${day}</span>
        <div class="dow-bar-track"><div class="dow-bar-fill" style="width:${percent}%"></div></div>
        <span class="dow-stat">${data.calls} call${data.calls !== 1 ? 's' : ''}</span>
        <span class="dow-cost">${fmtCost(data.cost)}</span>
      </div>`;
  }).join('');
}

export function renderCostTable(byModel) {
  const element = document.getElementById('cost-table-body');
  if (!element) return;
  const rows = Object.entries(byModel).sort(([, a], [, b]) => b.cost - a.cost).slice(0, 10);
  if (!rows.length) { element.innerHTML = '<div class="cost-empty">No cost data for this period.</div>'; return; }
  const totalCost = rows.reduce((sum, [, value]) => sum + value.cost, 0);
  const maxCost = rows[0][1].cost;
  element.innerHTML = rows.map(([modelId, value], index) => {
    const share = totalCost > 0 ? Math.round((value.cost / totalCost) * 100) : 0;
    const barPercent = maxCost > 0 ? Math.round((value.cost / maxCost) * 100) : 0;
    return `
      <div class="cost-row">
        <div class="cost-row-rank">#${index + 1}</div>
        <div class="cost-row-info">
          <div class="cost-row-name" title="${modelId}">${value.name}</div>
          <div class="cost-row-meta">${value.calls} call${value.calls !== 1 ? 's' : ''} - ${fmtTokens(value.input + value.output)} tokens</div>
          <div class="cost-row-bar-wrap"><div class="cost-row-bar" style="width:${barPercent}%"></div></div>
        </div>
        <div class="cost-row-figures">
          <div class="cost-row-total">${fmtCost(value.cost)}</div>
          <div class="cost-row-share">${share}% of total</div>
        </div>
      </div>`;
  }).join('');
}

export function renderSummary(stats, records) {
  const grid = document.getElementById('summary-grid');
  if (!grid) return;
  const avgTokensPerCall = stats.count > 0 ? Math.round((stats.totalInput + stats.totalOutput) / stats.count) : 0;
  const uniqueModels = new Set(records.map(record => record.model)).size;
  const avgCostPerCall = stats.count > 0 ? stats.totalCost / stats.count : 0;
  const cards = [
    { icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke-linecap="round"/></svg>`, label: 'Total tokens', value: fmtTokens(stats.totalInput + stats.totalOutput), sub: `${fmtTokens(stats.totalInput)} in - ${fmtTokens(stats.totalOutput)} out`, cls: '' },
    { icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>`, label: 'API calls', value: stats.count.toLocaleString(), sub: `avg ${fmtTokens(avgTokensPerCall)} tokens each`, cls: '' },
    { icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23" stroke-linecap="round"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke-linecap="round"/></svg>`, label: 'Est. cost', value: fmtCost(stats.totalCost), sub: 'based on published pricing', cls: 'cost-card' },
    { icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v4H4zM4 12h16v4H4z" stroke-linejoin="round"/></svg>`, label: 'Input tokens', value: fmtTokens(stats.totalInput), sub: `${stats.totalInput > 0 ? Math.round((stats.totalInput / (stats.totalInput + stats.totalOutput + 0.001)) * 100) : 0}% of total`, cls: '' },
    { icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke-linecap="round" stroke-linejoin="round"/></svg>`, label: 'Output tokens', value: fmtTokens(stats.totalOutput), sub: `${stats.totalOutput > 0 ? Math.round((stats.totalOutput / (stats.totalInput + stats.totalOutput + 0.001)) * 100) : 0}% of total`, cls: '' },
    { icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`, label: 'Models used', value: uniqueModels.toString(), sub: `across ${Object.keys(stats.byProvider).length} provider${Object.keys(stats.byProvider).length !== 1 ? 's' : ''}`, cls: '' },
    { icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/></svg>`, label: 'Avg cost / call', value: fmtCost(avgCostPerCall), sub: stats.count > 0 ? `over ${stats.count} call${stats.count !== 1 ? 's' : ''}` : 'no calls yet', cls: '' },
  ];
  grid.innerHTML = cards.map((card, index) => `
    <div class="usage-card ${card.cls}" style="animation-delay:${index * 0.05}s">
      <div class="usage-card-icon">${card.icon}</div>
      <div class="usage-card-label">${card.label}</div>
      <div class="usage-card-value">${card.value}</div>
      <div class="usage-card-sub">${card.sub}</div>
    </div>
  `).join('');
}

export function renderModelRows(byModel) {
  const element = document.getElementById('model-rows');
  const meta = document.getElementById('model-meta');
  if (!element) return;
  const rows = Object.entries(byModel).sort(([, a], [, b]) => (b.input + b.output) - (a.input + a.output));
  if (meta) meta.textContent = `${rows.length} model${rows.length !== 1 ? 's' : ''}`;
  if (!rows.length) { element.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No model data yet</div>'; return; }
  const maxTokens = Math.max(...rows.map(([, value]) => value.input + value.output), 1);
  element.innerHTML = rows.map(([modelId, value]) => {
    const total = value.input + value.output;
    const percent = Math.round((total / maxTokens) * 100);
    return `
      <div class="model-row">
        <div class="model-row-header">
          <span class="model-row-name" title="${modelId}">${value.name}</span>
          <div class="model-row-stats">
            <span class="model-row-tokens">${fmtTokens(total)} tokens - ${value.calls} call${value.calls !== 1 ? 's' : ''}</span>
            <span class="model-row-cost">${fmtCost(value.cost)}</span>
          </div>
        </div>
        <div class="model-bar-track"><div class="model-bar-fill" style="width:${percent}%"></div></div>
      </div>`;
  }).join('');
}

export function renderProviders(byProvider) {
  const element = document.getElementById('provider-grid');
  if (!element) return;
  const rows = Object.entries(byProvider).sort(([, a], [, b]) => (b.input + b.output) - (a.input + a.output));
  if (!rows.length) { element.innerHTML = '<div style="color:var(--text-muted);font-size:13px;grid-column:1/-1">No provider data yet</div>'; return; }
  element.innerHTML = rows.map(([id, value]) => `
    <div class="provider-card">
      <div class="provider-name">${providerLabel(id)}</div>
      <div class="provider-tokens">${fmtTokens(value.input + value.output)} tokens</div>
      <div class="provider-cost">${fmtCost(value.cost)}</div>
      <div class="provider-calls">${value.calls} call${value.calls === 1 ? '' : 's'}</div>
    </div>
  `).join('');
}

export function renderActivity(records) {
  const element = document.getElementById('activity-list');
  const meta = document.getElementById('activity-meta');
  if (!element || !meta) return;
  const recent = [...records].reverse().slice(0, 50);
  meta.textContent = `last ${Math.min(records.length, 50)} calls`;
  if (!recent.length) { element.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:18px;text-align:center">No activity yet - start chatting!</div>'; return; }
  element.innerHTML = recent.map(record => {
    const total = (record.inputTokens ?? 0) + (record.outputTokens ?? 0);
    const pricing = {};
    const cost = (() => {
      const p = pricing[record.model] ?? { in: 1, out: 3 };
      return ((record.inputTokens ?? 0) / 1_000_000) * p.in + ((record.outputTokens ?? 0) / 1_000_000) * p.out;
    })();
    return `
      <div class="activity-item">
        <div class="activity-dot"></div>
        <span class="activity-model">${record.modelName ?? record.model}</span>
        <span class="activity-tokens">${fmtTokens(total)}</span>
        <span class="activity-cost">${fmtCost(cost)}</span>
        <span class="activity-time">${fmtTime(record.timestamp)}</span>
      </div>`;
  }).join('');
}

export function showEmpty() {
  const summaryGrid = document.getElementById('summary-grid');
  if (summaryGrid) {
    summaryGrid.innerHTML = `
      <div class="usage-empty" style="grid-column:1/-1">
        <div class="usage-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:24px;height:24px">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3>No usage data yet</h3>
        <p>Start chatting and your token usage will appear here in real time.</p>
      </div>`;
  }
  ['chart-section', 'provider-section', 'model-section', 'activity-section', 'insights-section', 'heatmap-section', 'dow-section', 'cost-table-section'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
  });
}

export function showSections() {
  ['chart-section', 'provider-section', 'model-section', 'activity-section', 'insights-section', 'heatmap-section', 'dow-section', 'cost-table-section'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.style.display = '';
  });
}
