import {
  fmtTokens,
  fmtCost,
  fmtTime,
  providerLabel,
  buildDayList,
} from '../Formatters/UsageFormatters.js';
import { t } from '../../../../../System/I18n/index.js';

// Helper: formatted "N call / N calls" string
const calls = (n) => `${n} ${1 !== n ? t('usage.callPlural') : t('usage.callSingular')}`;

export function renderInsights(stats, records) {
  const element = document.getElementById('insights-list');
  if (!element) return;
  if (!records.length)
    return void (element.innerHTML = `<div class="insight-empty">${t('usage.noData')}</div>`);
  const insights = [],
    topModel = Object.entries(stats.byModel).sort(([, a], [, b]) => b.calls - a.calls)[0];
  topModel &&
    insights.push({
      icon: 'Top',
      title: t('usage.insightTopModelTitle'),
      text: t('usage.insightTopModelText', {
        model: topModel[1].name,
        calls: calls(topModel[1].calls),
        tokens: fmtTokens(topModel[1].input + topModel[1].output),
      }),
    });
  const peakHourEntry = Object.entries(stats.byHour).sort(([, a], [, b]) => b.calls - a.calls)[0];
  if (peakHourEntry) {
    const hour = parseInt(peakHourEntry[0], 10),
      label =
        0 === hour ? '12 AM' : hour < 12 ? `${hour} AM` : 12 === hour ? '12 PM' : hour - 12 + ' PM';
    insights.push({
      icon: 'Hour',
      title: t('usage.insightPeakHourTitle'),
      text: t('usage.insightPeakHourText', {
        hour: label,
        calls: calls(peakHourEntry[1].calls),
      }),
    });
  }
  const busiestDay = Object.entries(stats.byDay).sort(([, a], [, b]) => b.calls - a.calls)[0];
  if (busiestDay) {
    const dayLabel = new Date(`${busiestDay[0]}T12:00:00`).toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    insights.push({
      icon: 'Day',
      title: t('usage.insightBusiestDayTitle'),
      text: t('usage.insightBusiestDayText', {
        day: dayLabel,
        calls: calls(busiestDay[1].calls),
        tokens: fmtTokens(busiestDay[1].input + busiestDay[1].output),
      }),
    });
  }
  const totalTokens = stats.totalInput + stats.totalOutput;
  if (totalTokens > 0) {
    const outputPercent = Math.round((stats.totalOutput / totalTokens) * 100),
      verdict =
        outputPercent > 60
          ? t('usage.insightOutputHeavy')
          : outputPercent < 30
            ? t('usage.insightInputHeavy')
            : t('usage.insightBalanced');
    insights.push({
      icon: 'Mix',
      title: t('usage.insightTokenRatioTitle'),
      text: t('usage.insightTokenRatioText', {
        outputPct: outputPercent,
        inputPct: 100 - outputPercent,
        verdict,
      }),
    });
  }
  const priciest = Object.entries(stats.byModel).sort(([, a], [, b]) => b.cost - a.cost)[0];
  if (
    (priciest &&
      priciest[1].cost > 0 &&
      insights.push({
        icon: 'Cost',
        title: t('usage.insightHighestCostTitle'),
        text: t('usage.insightHighestCostText', {
          model: priciest[1].name,
          cost: fmtCost(priciest[1].cost),
        }),
      }),
    stats.count > 0)
  ) {
    const avgTokens = Math.round(totalTokens / stats.count),
      verdict =
        avgTokens > 4e3
          ? t('usage.insightAvgLong')
          : avgTokens < 500
            ? t('usage.insightAvgShort')
            : t('usage.insightAvgMedium');
    insights.push({
      icon: 'Avg',
      title: t('usage.insightAvgTokensTitle'),
      text: t('usage.insightAvgTokensText', {
        tokens: fmtTokens(avgTokens),
        verdict,
      }),
    });
  }
  const providerCount = Object.keys(stats.byProvider).length;
  if (providerCount > 1) {
    const providerNames = Object.keys(stats.byProvider).map(providerLabel).join(', ');
    insights.push({
      icon: 'Net',
      title: t('usage.insightMultiProviderTitle'),
      text: t('usage.insightMultiProviderText', {
        count: providerCount,
        names: providerNames,
      }),
    });
  }
  const efficientModels = Object.entries(stats.byModel).filter(
    ([, value]) => value.cost > 0 && value.input + value.output > 0,
  );
  if (efficientModels.length > 0) {
    const [, bestEfficient] = efficientModels.sort(
        ([, a], [, b]) =>
          a.cost / ((a.input + a.output) / 1e3) - b.cost / ((b.input + b.output) / 1e3),
      )[0],
      costPer1k = (
        bestEfficient.cost /
        ((bestEfficient.input + bestEfficient.output) / 1e3)
      ).toFixed(6);
    insights.push({
      icon: 'Eff',
      title: t('usage.insightMostEfficientTitle'),
      text: t('usage.insightMostEfficientText', {
        model: bestEfficient.name,
        rate: costPer1k,
      }),
    });
  }
  let weekendCalls = 0,
    weekdayCalls = 0;
  for (const [dow, data] of Object.entries(stats.byDow))
    [0, 6].includes(parseInt(dow, 10))
      ? (weekendCalls += data.calls)
      : (weekdayCalls += data.calls);
  if (weekendCalls + weekdayCalls > 0) {
    const heavier =
        weekendCalls > weekdayCalls ? t('usage.weekendHeavier') : t('usage.weekdayHeavier'),
      ratio =
        weekendCalls > weekdayCalls
          ? (weekendCalls / Math.max(weekdayCalls, 1)).toFixed(1)
          : (weekdayCalls / Math.max(weekendCalls, 1)).toFixed(1),
      verdict =
        0 === weekendCalls
          ? t('usage.insightWeekendStrictly')
          : 0 === weekdayCalls
            ? t('usage.insightWeekendOnly')
            : t('usage.insightWeekendMoreText', { ratio, heavier });
    insights.push({ icon: 'Week', title: t('usage.insightWeekendTitle'), text: verdict });
  }
  const costLeader = Object.entries(stats.byProvider)
    .filter(([, value]) => value.cost > 0)
    .sort(([, a], [, b]) => b.cost - a.cost)[0];
  if (costLeader) {
    const [providerId, providerData] = costLeader,
      shareOfTotal =
        stats.totalCost > 0 ? Math.round((providerData.cost / stats.totalCost) * 100) : 100;
    insights.push({
      icon: 'Prov',
      title: t('usage.insightTopSpendingTitle'),
      text: t('usage.insightTopSpendingText', {
        provider: providerLabel(providerId),
        share: shareOfTotal,
        cost: fmtCost(providerData.cost),
        calls: calls(providerData.calls),
      }),
    });
  }
  if (stats.count > 0 && stats.totalOutput > 0) {
    const avgOutput = Math.round(stats.totalOutput / stats.count),
      verdict =
        avgOutput > 800
          ? t('usage.insightVerbosityHeavy')
          : avgOutput > 300
            ? t('usage.insightVerbosityModerate')
            : t('usage.insightVerbosityConcise'),
      topOutputModel = Object.entries(stats.byModel)
        .filter(([, value]) => value.calls > 0)
        .sort(([, a], [, b]) => b.output / b.calls - a.output / a.calls)[0],
      modelNote = topOutputModel
        ? t('usage.insightVerbosityModelNote', { model: topOutputModel[1].name })
        : '';
    insights.push({
      icon: 'Out',
      title: t('usage.insightVerbosityTitle'),
      text: t('usage.insightVerbosityText', {
        tokens: fmtTokens(avgOutput),
        verdict,
        modelNote,
      }),
    });
  }
  element.innerHTML = insights
    .map(
      (insight) =>
        `\n    <div class="insight-card">\n      <div class="insight-icon">${insight.icon}</div>\n      <div class="insight-body">\n        <div class="insight-title">${insight.title}</div>\n        <div class="insight-text">${insight.text}</div>\n      </div>\n    </div>\n  `,
    )
    .join('');
}
export function renderChart(byDay, range) {
  const wrap = document.getElementById('chart-wrap'),
    titleElement = document.getElementById('chart-title'),
    metaElement = document.getElementById('chart-meta');
  if (!wrap) return;
  const days = buildDayList('all' === range ? '30' : range),
    values = days.map((day) => (byDay[day]?.input ?? 0) + (byDay[day]?.output ?? 0)),
    maxValue = Math.max(...values, 1),
    barWidth = Math.max(4, Math.floor(624 / days.length) - 3),
    barGap = (624 - barWidth * days.length) / Math.max(days.length - 1, 1);
  let barsHTML = '',
    labelsHTML = '';
  const totalShown = values.reduce((sum, value) => sum + value, 0);
  (metaElement &&
    (metaElement.textContent = t('usage.chartTokenTotal', { total: fmtTokens(totalShown) })),
    titleElement &&
      (titleElement.textContent =
        'all' === range
          ? t('usage.chartLast30')
          : 'today' === range
            ? t('usage.chartToday')
            : t('usage.chartLastN', { n: range })),
    days.forEach((date, index) => {
      const x = 44 + index * (barWidth + barGap),
        input = byDay[date]?.input ?? 0,
        output = byDay[date]?.output ?? 0,
        inputHeight = input > 0 ? Math.max(1, (input / maxValue) * 94) : 0,
        outputHeight = output > 0 ? Math.max(1, (output / maxValue) * 94) : 0;
      if (
        ((barsHTML += `\n      <rect x="${x}" y="${104 - inputHeight}" width="${barWidth}" height="${inputHeight}" rx="2"\n        fill="var(--accent)" opacity="0.55"><title>${date}: ${fmtTokens(input)} input, ${fmtTokens(output)} output</title></rect>\n      <rect x="${x}" y="${104 - inputHeight - outputHeight}" width="${barWidth}" height="${outputHeight}" rx="2"\n        fill="var(--accent)" opacity="0.9"><title>${date}: ${fmtTokens(output)} output</title></rect>`),
        index % (days.length <= 7 ? 1 : days.length <= 14 ? 2 : 5) == 0 ||
          index === days.length - 1)
      ) {
        const label = 1 === days.length ? t('usage.today') : date.slice(5);
        labelsHTML += `<text x="${x + barWidth / 2}" y="132" text-anchor="middle" font-size="9" fill="var(--text-muted)" font-family="var(--font-ui)">${label}</text>`;
      }
    }));
  let yLabels = '';
  ([0, 0.25, 0.5, 0.75, 1].forEach((tick) => {
    const yPos = 104 - 94 * tick;
    yLabels += `\n      <text x="40" y="${yPos + 3}" text-anchor="end" font-size="8" fill="var(--text-muted)" font-family="var(--font-mono)">${fmtTokens(Math.round(maxValue * tick))}</text>\n      <line x1="44" y1="${yPos}" x2="668" y2="${yPos}" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="3,3"/>`;
  }),
    (wrap.innerHTML = `<svg viewBox="0 0 680 140" class="usage-chart-svg">\n    ${yLabels}${barsHTML}${labelsHTML}\n    <line x1="44" y1="10" x2="44" y2="104" stroke="var(--border)" stroke-width="0.8"/>\n    <line x1="44" y1="104" x2="668" y2="104" stroke="var(--border)" stroke-width="0.8"/>\n  </svg>`));
}
export function renderHeatmap(byHour) {
  const wrap = document.getElementById('heatmap-wrap');
  if (!wrap) return;
  const maxCalls = Math.max(...Object.values(byHour).map((value) => value.calls), 1);
  wrap.innerHTML = Array.from({ length: 24 }, (_, hour) => {
    const data = byHour[hour] ?? { calls: 0 },
      opacity = data.calls > 0 ? Math.max(0.08, data.calls / maxCalls) : 0.04,
      label = 0 === hour ? '12a' : hour < 12 ? `${hour}a` : 12 === hour ? '12p' : hour - 12 + 'p';
    return `\n      <div class="heatmap-cell" title="${label}: ${calls(data.calls)}" style="--cell-opacity:${opacity.toFixed(2)}">\n        ${data.calls > 0 ? `<div class="heatmap-count">${data.calls}</div>` : ''}\n        <div class="heatmap-label">${label}</div>\n      </div>`;
  }).join('');
}
export function renderDow(byDow) {
  const wrap = document.getElementById('dow-wrap');
  if (!wrap) return;
  const days = [
      t('usage.dowSun'),
      t('usage.dowMon'),
      t('usage.dowTue'),
      t('usage.dowWed'),
      t('usage.dowThu'),
      t('usage.dowFri'),
      t('usage.dowSat'),
    ],
    maxCalls = Math.max(...days.map((_, index) => byDow[index]?.calls ?? 0), 1);
  wrap.innerHTML = days
    .map((day, index) => {
      const data = byDow[index] ?? { calls: 0, cost: 0 };
      return `\n      <div class="dow-row">\n        <span class="dow-label">${day}</span>\n        <div class="dow-bar-track"><div class="dow-bar-fill" style="width:${Math.round((data.calls / maxCalls) * 100)}%"></div></div>\n        <span class="dow-stat">${calls(data.calls)}</span>\n        <span class="dow-cost">${fmtCost(data.cost)}</span>\n      </div>`;
    })
    .join('');
}
export function renderCostTable(byModel) {
  const element = document.getElementById('cost-table-body');
  if (!element) return;
  const rows = Object.entries(byModel)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .slice(0, 10);
  if (!rows.length)
    return void (element.innerHTML = `<div class="cost-empty">${t('usage.noCostData')}</div>`);
  const totalCost = rows.reduce((sum, [, value]) => sum + value.cost, 0),
    maxCost = rows[0][1].cost;
  element.innerHTML = rows
    .map(([modelId, value], index) => {
      const share = totalCost > 0 ? Math.round((value.cost / totalCost) * 100) : 0,
        barPercent = maxCost > 0 ? Math.round((value.cost / maxCost) * 100) : 0;
      return `\n      <div class="cost-row">\n        <div class="cost-row-rank">#${index + 1}</div>\n        <div class="cost-row-info">\n          <div class="cost-row-name" title="${modelId}">${value.name}</div>\n          <div class="cost-row-meta">${calls(value.calls)} - ${fmtTokens(value.input + value.output)} tokens</div>\n          <div class="cost-row-bar-wrap"><div class="cost-row-bar" style="width:${barPercent}%"></div></div>\n        </div>\n        <div class="cost-row-figures">\n          <div class="cost-row-total">${fmtCost(value.cost)}</div>\n          <div class="cost-row-share">${t('usage.costShareOfTotal', { share })}</div>\n        </div>\n      </div>`;
    })
    .join('');
}
export function renderSummary(stats, records) {
  const grid = document.getElementById('summary-grid');
  if (!grid) return;
  const avgTokensPerCall =
      stats.count > 0 ? Math.round((stats.totalInput + stats.totalOutput) / stats.count) : 0,
    uniqueModels = new Set(records.map((record) => record.model)).size,
    avgCostPerCall = stats.count > 0 ? stats.totalCost / stats.count : 0,
    providerCount = Object.keys(stats.byProvider).length,
    cards = [
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke-linecap="round"/></svg>',
        label: t('usage.cardTotalTokens'),
        value: fmtTokens(stats.totalInput + stats.totalOutput),
        sub: t('usage.cardTotalSub', {
          input: fmtTokens(stats.totalInput),
          output: fmtTokens(stats.totalOutput),
        }),
        cls: '',
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        label: t('usage.cardApiCalls'),
        value: stats.count.toLocaleString(),
        sub: t('usage.cardAvgTokensSub', { n: fmtTokens(avgTokensPerCall) }),
        cls: '',
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23" stroke-linecap="round"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke-linecap="round"/></svg>',
        label: t('usage.cardEstCost'),
        value: fmtCost(stats.totalCost),
        sub: t('usage.cardEstCostSub'),
        cls: 'cost-card',
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v4H4zM4 12h16v4H4z" stroke-linejoin="round"/></svg>',
        label: t('usage.cardInputTokens'),
        value: fmtTokens(stats.totalInput),
        sub: t('usage.cardPctOfTotal', {
          pct:
            stats.totalInput > 0
              ? Math.round(
                  (stats.totalInput / (stats.totalInput + stats.totalOutput + 0.001)) * 100,
                )
              : 0,
        }),
        cls: '',
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        label: t('usage.cardOutputTokens'),
        value: fmtTokens(stats.totalOutput),
        sub: t('usage.cardPctOfTotal', {
          pct:
            stats.totalOutput > 0
              ? Math.round(
                  (stats.totalOutput / (stats.totalInput + stats.totalOutput + 0.001)) * 100,
                )
              : 0,
        }),
        cls: '',
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
        label: t('usage.cardModelsUsed'),
        value: uniqueModels.toString(),
        sub: t(
          1 !== providerCount ? 'usage.cardAcrossProviders' : 'usage.cardAcrossProvidersSingle',
          { count: providerCount },
        ),
        cls: '',
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        label: t('usage.cardAvgCostPerCall'),
        value: fmtCost(avgCostPerCall),
        sub:
          stats.count > 0
            ? t(1 !== stats.count ? 'usage.cardOverCalls' : 'usage.cardOverCallsSingle', {
                count: stats.count,
              })
            : t('usage.cardNoCallsYet'),
        cls: '',
      },
    ];
  grid.innerHTML = cards
    .map(
      (card, index) =>
        `\n    <div class="usage-card ${card.cls}" style="animation-delay:${0.05 * index}s">\n      <div class="usage-card-icon">${card.icon}</div>\n      <div class="usage-card-label">${card.label}</div>\n      <div class="usage-card-value">${card.value}</div>\n      <div class="usage-card-sub">${card.sub}</div>\n    </div>\n  `,
    )
    .join('');
}
export function renderModelRows(byModel) {
  const element = document.getElementById('model-rows'),
    meta = document.getElementById('model-meta');
  if (!element) return;
  const rows = Object.entries(byModel).sort(
    ([, a], [, b]) => b.input + b.output - (a.input + a.output),
  );
  if (
    (meta && (meta.textContent = `${rows.length} model${1 !== rows.length ? 's' : ''}`),
    !rows.length)
  )
    return void (element.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:8px 0">${t('usage.noModelData')}</div>`);
  const maxTokens = Math.max(...rows.map(([, value]) => value.input + value.output), 1);
  element.innerHTML = rows
    .map(([modelId, value]) => {
      const total = value.input + value.output,
        percent = Math.round((total / maxTokens) * 100);
      return `\n      <div class="model-row">\n        <div class="model-row-header">\n          <span class="model-row-name" title="${modelId}">${value.name}</span>\n          <div class="model-row-stats">\n            <span class="model-row-tokens">${fmtTokens(total)} tokens - ${calls(value.calls)}</span>\n            <span class="model-row-cost">${fmtCost(value.cost)}</span>\n          </div>\n        </div>\n        <div class="model-bar-track"><div class="model-bar-fill" style="width:${percent}%"></div></div>\n      </div>`;
    })
    .join('');
}
export function renderProviders(byProvider) {
  const element = document.getElementById('provider-grid');
  if (!element) return;
  const rows = Object.entries(byProvider).sort(
    ([, a], [, b]) => b.input + b.output - (a.input + a.output),
  );
  rows.length
    ? (element.innerHTML = rows
        .map(
          ([id, value]) =>
            `\n    <div class="provider-card">\n      <div class="provider-name">${providerLabel(id)}</div>\n      <div class="provider-tokens">${fmtTokens(value.input + value.output)} tokens</div>\n      <div class="provider-cost">${fmtCost(value.cost)}</div>\n      <div class="provider-calls">${calls(value.calls)}</div>\n    </div>\n  `,
        )
        .join(''))
    : (element.innerHTML = `<div style="color:var(--text-muted);font-size:13px;grid-column:1/-1">${t('usage.noProviderData')}</div>`);
}
export function renderActivity(records) {
  const element = document.getElementById('activity-list'),
    meta = document.getElementById('activity-meta');
  if (!element || !meta) return;
  const recent = [...records].reverse().slice(0, 50);
  ((meta.textContent = t('usage.activityMeta', { n: Math.min(records.length, 50) })),
    recent.length
      ? (element.innerHTML = recent
          .map((record) => {
            const total = (record.inputTokens ?? 0) + (record.outputTokens ?? 0),
              sourceLabel =
                'agent' === record.sourceType && record.sourceName
                  ? `Agent: ${record.sourceName}`
                  : providerLabel(record.provider ?? 'unknown'),
              pricing = {},
              cost = (() => {
                const p = pricing[record.model] ?? { in: 1, out: 3 };
                return (
                  ((record.inputTokens ?? 0) / 1e6) * p.in +
                  ((record.outputTokens ?? 0) / 1e6) * p.out
                );
              })();
            return `\n      <div class="activity-item">\n        <div class="activity-dot"></div>\n        <span class="activity-model">${record.modelName ?? record.model}</span>\n        <span class="activity-tokens">${fmtTokens(total)}</span>\n        <span class="activity-cost">${fmtCost(cost)}</span>\n        <span class="activity-time">${fmtTime(record.timestamp)}</span>\n        <span class="activity-source">${sourceLabel}</span>\n      </div>`;
          })
          .join(''))
      : (element.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:18px;text-align:center">${t('usage.noActivity')}</div>`));
}
export function showEmpty() {
  const summaryGrid = document.getElementById('summary-grid');
  (summaryGrid &&
    (summaryGrid.innerHTML = `\n      <div class="usage-empty" style="grid-column:1/-1">\n        <div class="usage-empty-icon">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:24px;height:24px">\n            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke-linecap="round" stroke-linejoin="round"/>\n          </svg>\n        </div>\n        <h3>${t('usage.noUsageData')}</h3>\n        <p>${t('usage.noUsageDataSub')}</p>\n      </div>`),
    [
      'chart-section',
      'provider-section',
      'model-section',
      'activity-section',
      'insights-section',
      'heatmap-section',
      'dow-section',
      'cost-table-section',
    ].forEach((id) => {
      const element = document.getElementById(id);
      element && (element.style.display = 'none');
    }));
}
export function showSections() {
  [
    'chart-section',
    'provider-section',
    'model-section',
    'activity-section',
    'insights-section',
    'heatmap-section',
    'dow-section',
    'cost-table-section',
  ].forEach((id) => {
    const element = document.getElementById(id);
    element && (element.style.display = '');
  });
}

// Module-level state for the yearly heatmap year picker
let _yhSelectedYear = new Date().getFullYear();

export function renderYearlyHeatmap(allRecords) {
  const gridEl = document.getElementById('yh-grid');
  const monthLabelsEl = document.getElementById('yh-month-labels');
  const yearPickerEl = document.getElementById('yh-year-picker');
  if (!gridEl || !monthLabelsEl || !yearPickerEl) return;

  // Build per-day call counts from ALL records (not range-filtered)
  const byDay = {};
  for (const r of allRecords) {
    const day = String(r.timestamp).slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }

  // Collect available years (always include current year)
  const currentYear = new Date().getFullYear();
  const yearsSet = new Set([currentYear]);
  for (const day of Object.keys(byDay)) {
    const y = parseInt(day.slice(0, 4), 10);
    if (!isNaN(y) && y >= 2000 && y <= currentYear + 1) yearsSet.add(y);
  }
  const years = [...yearsSet].sort((a, b) => b - a); // newest first

  // Keep selected year valid
  if (!years.includes(_yhSelectedYear)) _yhSelectedYear = currentYear;

  const GAP = 2;
  const ITEM_H = 32,
    CONTAINER_H = 160,
    SPACER_H = (CONTAINER_H - ITEM_H) / 2;
  const MONTH_NAMES = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  function padDate(dt) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  function renderGrid(year) {
    // Correctly detect leap years
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const totalDays = isLeap ? 366 : 365;
    const jan1Dow = new Date(year, 0, 1).getDay(); // 0 = Sun
    const weeks = Math.ceil((jan1Dow + totalDays) / 7);
    const totalCells = weeks * 7;

    // Compute dynamic cell size to fill available width
    const bodyRow = gridEl.closest('.yh-body-row');
    const dayLabelsEl = bodyRow?.querySelector('.yh-day-labels');
    const gutterW = (dayLabelsEl?.offsetWidth ?? 24) + GAP;
    const availW = Math.max(300, (bodyRow?.offsetWidth ?? 700) - gutterW);
    const CELL = Math.max(8, Math.floor((availW - GAP * (weeks - 1)) / weeks));
    const STEP = CELL + GAP;

    // Apply sizes to the grid and matching day-label rows
    gridEl.style.gridAutoColumns = `${CELL}px`;
    gridEl.style.gridTemplateRows = `repeat(7, ${CELL}px)`;
    if (dayLabelsEl) dayLabelsEl.style.gridTemplateRows = `repeat(7, ${CELL}px)`;

    // Find max calls in this year for level normalization
    let maxCalls = 1;
    for (const [ds, count] of Object.entries(byDay)) {
      if (ds.startsWith(String(year) + '-')) maxCalls = Math.max(maxCalls, count);
    }

    // Build cell HTML (cells are laid out column-major via grid-auto-flow:column)
    // i iterates: week0-Sun, week0-Mon, ..., week0-Sat, week1-Sun, ...
    const monthCols = {};
    let html = '';

    for (let i = 0; i < totalCells; i++) {
      const dayOffset = i - jan1Dow;
      if (dayOffset < 0 || dayOffset >= totalDays) {
        html += '<div class="yh-cell" style="visibility:hidden"></div>';
        continue;
      }
      const dt = new Date(year, 0, 1 + dayOffset);
      const ds = padDate(dt);
      const c = byDay[ds] || 0;

      // Record the week column index for each month's first day
      if (dt.getDate() === 1) {
        const m = dt.getMonth();
        if (monthCols[m] === undefined) monthCols[m] = Math.floor(i / 7);
      }

      // Map count to 0-4 level relative to this year's max
      let level = 0;
      if (c > 0 && maxCalls > 0) {
        const ratio = c / maxCalls;
        level = ratio < 0.15 ? 1 : ratio < 0.4 ? 2 : ratio < 0.7 ? 3 : 4;
      }

      const tip = `${ds}: ${c} ${c === 1 ? 'use' : 'uses'}`;
      html += `<div class="yh-cell" data-level="${level}" title="${tip}"></div>`;
    }

    gridEl.innerHTML = html;

    // Position month labels using absolute left offsets
    let labelsHtml = '';
    for (let m = 0; m < 12; m++) {
      const col = monthCols[m];
      if (col !== undefined) {
        labelsHtml += `<span class="yh-month-label" style="left:${col * STEP}px">${MONTH_NAMES[m]}</span>`;
      }
    }
    monthLabelsEl.style.width = `${weeks * STEP}px`;
    monthLabelsEl.innerHTML = labelsHtml;
  }

  // Build year picker HTML (spacers enable first/last item to scroll to center)
  yearPickerEl.innerHTML =
    `<div style="height:${SPACER_H}px;flex-shrink:0;pointer-events:none"></div>` +
    years
      .map(
        (y) =>
          `<div class="yh-year-item${y === _yhSelectedYear ? ' active' : ''}" data-year="${y}">${y}</div>`,
      )
      .join('') +
    `<div style="height:${SPACER_H}px;flex-shrink:0;pointer-events:none"></div>`;

  // Click handler: select year and scroll it to center
  yearPickerEl.querySelectorAll('.yh-year-item').forEach((el) => {
    el.addEventListener('click', () => {
      _yhSelectedYear = parseInt(el.dataset.year, 10);
      yearPickerEl
        .querySelectorAll('.yh-year-item')
        .forEach((e) =>
          e.classList.toggle('active', parseInt(e.dataset.year, 10) === _yhSelectedYear),
        );
      renderGrid(_yhSelectedYear);
      const itemCenter = el.offsetTop + el.offsetHeight / 2;
      yearPickerEl.scrollTo({ top: itemCenter - CONTAINER_H / 2, behavior: 'smooth' });
    });
  });

  // Scroll handler: update active year in real-time as user scrolls
  if (!yearPickerEl.dataset.yhInit) {
    yearPickerEl.dataset.yhInit = '1';
    yearPickerEl.addEventListener('scroll', () => {
      const pickerCenter = yearPickerEl.scrollTop + yearPickerEl.clientHeight / 2;
      let closest = _yhSelectedYear,
        closestDist = Infinity;
      yearPickerEl.querySelectorAll('.yh-year-item').forEach((el) => {
        const center = el.offsetTop + el.offsetHeight / 2;
        const dist = Math.abs(center - pickerCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closest = parseInt(el.dataset.year, 10);
        }
      });
      if (closest !== _yhSelectedYear) {
        _yhSelectedYear = closest;
        // Update active class without rebuilding (avoids interrupting scroll)
        yearPickerEl
          .querySelectorAll('.yh-year-item')
          .forEach((el) =>
            el.classList.toggle('active', parseInt(el.dataset.year, 10) === _yhSelectedYear),
          );
        renderGrid(_yhSelectedYear);
      }
    });
  }

  // Scroll to active item (instant on first mount, avoids layout jump)
  const activeEl = yearPickerEl.querySelector('.yh-year-item.active');
  if (activeEl) {
    yearPickerEl.scrollTop = activeEl.offsetTop + activeEl.offsetHeight / 2 - CONTAINER_H / 2;
  }

  renderGrid(_yhSelectedYear);
}
