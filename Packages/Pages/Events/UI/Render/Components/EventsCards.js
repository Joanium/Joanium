import { esc, timeAgo, runningDuration, fullDateTime, triggerLabel } from '../Utils/EventsUtils.js';
const STATUS_ICONS = {
    success:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>',
    skipped:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14" stroke-linecap="round"/></svg>',
  },
  STATUS_LABELS = { success: 'Acted', error: 'Error', skipped: 'Skipped' },
  AGENT_TYPE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="event-type-icon event-type-icon--agent">\n  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/>\n  <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/>\n</svg>',
  AUTOMATION_TYPE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="event-type-icon event-type-icon--automation">\n  <path d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z" stroke-linejoin="round"/>\n</svg>';
export function buildRunningCard(job) {
  const card = document.createElement('div');
  ((card.className = 'event-row event-row--running'),
    (card.dataset.runKey = `${job.type ?? 'run'}__${job.agentId ?? job.automationId ?? ''}__${job.jobId ?? ''}`));
  const isAutomation = 'automation' === job.type,
    sourceName = job.automationName ?? job.agentName ?? 'Run',
    itemName = job.jobName || (isAutomation ? 'Job' : ''),
    typeIcon = isAutomation ? AUTOMATION_TYPE_ICON : AGENT_TYPE_ICON,
    summaryText = isAutomation
      ? 'Collecting data and calling AI...'
      : 'Running prompt with tools and connectors...';
  return (
    (card.innerHTML = `\n    <div class="event-status-icon event-status--running">\n      <svg class="running-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">\n        <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/>\n      </svg>\n    </div>\n    <div class="event-row-body">\n      <div class="event-row-top">\n        <div class="event-source-wrap">\n          ${typeIcon}\n          <span class="event-source">${esc(sourceName)}</span>\n          ${itemName ? `<span class="event-job-sep">&rsaquo;</span><span class="event-job-name">${esc(itemName)}</span>` : ''}\n        </div>\n        <div class="event-row-badges">\n          ${job.trigger ? `<span class="event-trigger-badge">${esc(triggerLabel(job.trigger))}</span>` : ''}\n          <span class="event-status-badge event-status-badge--running">Running</span>\n        </div>\n      </div>\n      <div class="event-summary">${summaryText}</div>\n      <div class="event-row-footer">\n        <span class="event-time running-duration" data-started="${esc(job.startedAt)}">Started ${timeAgo(job.startedAt)}</span>\n        <span class="event-elapsed">Elapsed: <span class="elapsed-value">${runningDuration(job.startedAt)}</span></span>\n      </div>\n    </div>`),
    card
  );
}
export function buildEventRow(event, isNew = !1, onOpenDetail) {
  const row = document.createElement('div');
  ((row.className = `event-row event-row--${event.status}${isNew ? ' event-row--new' : ''}`),
    (row.dataset.eventId = event.id));
  const statusIcon = STATUS_ICONS[event.status] ?? '',
    typeIcon = 'agent' === event.type ? AGENT_TYPE_ICON : AUTOMATION_TYPE_ICON,
    statusLabel = STATUS_LABELS[event.status] ?? event.status,
    triggerBadge = event.trigger
      ? `<span class="event-trigger-badge">${esc(triggerLabel(event.trigger))}</span>`
      : '',
    hasDetail = event.fullResponse || event.error || event.summary;
  let bodyContent = '';
  if ('error' === event.status && event.error)
    bodyContent = `<div class="event-error-preview">${esc(event.error.slice(0, 140))}${event.error.length > 140 ? '...' : ''}</div>`;
  else if ('skipped' === event.status) {
    const reason =
      event.skipReason || 'Data source returned nothing to act on - no output was sent.';
    bodyContent = `<div class="event-summary muted">${esc(reason)}</div>`;
  } else
    event.summary &&
      (bodyContent = `<div class="event-summary">${esc(event.summary.slice(0, 140))}${event.summary.length > 140 ? '...' : ''}</div>`);
  return (
    (row.innerHTML = `\n    <div class="event-status-icon event-status--${event.status}">${statusIcon}</div>\n    <div class="event-row-body">\n      <div class="event-row-top">\n        <div class="event-source-wrap">\n          ${typeIcon}\n          <span class="event-source">${esc(event.source)}</span>\n          ${event.jobName ? `<span class="event-job-sep">&rsaquo;</span><span class="event-job-name">${esc(event.jobName)}</span>` : ''}\n        </div>\n        <div class="event-row-badges">\n          ${triggerBadge}\n          <span class="event-status-badge event-status-badge--${event.status}">${statusLabel}</span>\n        </div>\n      </div>\n      ${bodyContent}\n      <div class="event-row-footer">\n        <span class="event-time" title="${fullDateTime(event.timestamp)}">${timeAgo(event.timestamp)}</span>\n        ${!1 === event.agentEnabled || !1 === event.autoEnabled ? '<span class="event-disabled-badge">disabled</span>' : ''}\n        ${hasDetail ? '<button class="event-view-btn" type="button">View output</button>' : ''}\n      </div>\n    </div>`),
    hasDetail &&
      (row.querySelector('.event-view-btn')?.addEventListener('click', (evt) => {
        (evt.stopPropagation(), onOpenDetail(event));
      }),
      (row.style.cursor = 'pointer'),
      row.addEventListener('click', (evt) => {
        evt.target.closest('.event-view-btn') || onOpenDetail(event);
      })),
    row
  );
}
