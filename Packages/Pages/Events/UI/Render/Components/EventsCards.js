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
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="event-type-icon event-type-icon--agent">\n  <rect x="4" y="4" width="16" height="16" rx="4" stroke-linejoin="round"/>\n  <path d="M9 9h6v6H9z" stroke-linejoin="round"/>\n  <path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke-linecap="round"/>\n</svg>',
  CHANNEL_TYPE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="event-type-icon event-type-icon--channel">\n  <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-4 4v-4h-.5A2.5 2.5 0 0 1 4 12.5v-6Z" stroke-linejoin="round"/>\n</svg>';

function previewText(value, limit = 160) {
  const text = String(value ?? '');
  return `${esc(text.slice(0, limit))}${text.length > limit ? '...' : ''}`;
}
export function buildRunningCard(job) {
  const card = document.createElement('div');
  ((card.className = 'event-row event-row--running'),
    (card.dataset.runKey = `${job.type ?? 'run'}__${job.jobId ?? ''}`));
  const sourceName = job.jobName || 'Run',
    typeIcon = 'agent' === job.type ? AGENT_TYPE_ICON : CHANNEL_TYPE_ICON,
    summaryText =
      'agent' === job.type
        ? 'Running saved agent prompt and processing the result...'
        : 'Collecting data and processing with AI...';
  return (
    (card.innerHTML = `\n    <div class="event-status-icon event-status--running">\n      <svg class="running-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">\n        <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/>\n      </svg>\n    </div>\n    <div class="event-row-body">\n      <div class="event-row-top">\n        <div class="event-source-wrap">\n          ${typeIcon}\n          <span class="event-source">${esc(sourceName)}</span>\n        </div>\n        <div class="event-row-badges">\n          ${job.trigger ? `<span class="event-trigger-badge">${esc(triggerLabel(job.trigger))}</span>` : ''}\n          <span class="event-status-badge event-status-badge--running">Running</span>\n        </div>\n      </div>\n      <div class="event-summary">${summaryText}</div>\n      <div class="event-row-footer">\n        <span class="event-time running-duration" data-started="${esc(job.startedAt)}">Started ${timeAgo(job.startedAt)}</span>\n        <span class="event-elapsed">Elapsed: <span class="elapsed-value">${runningDuration(job.startedAt)}</span></span>\n      </div>\n    </div>`),
    card
  );
}
export function buildEventRow(event, isNew = !1, onOpenDetail) {
  const row = document.createElement('div');
  ((row.className = `event-row event-row--${event.status}${isNew ? ' event-row--new' : ''}`),
    (row.dataset.eventId = event.id));
  const statusIcon = STATUS_ICONS[event.status] ?? '',
    typeIcon = 'agent' === event.type ? AGENT_TYPE_ICON : CHANNEL_TYPE_ICON,
    statusLabel =
      'channel' === event.type && 'success' === event.status
        ? 'Replied'
        : 'agent' === event.type && 'success' === event.status
          ? 'Completed'
          : (STATUS_LABELS[event.status] ?? event.status),
    triggerBadge = event.trigger
      ? `<span class="event-trigger-badge">${esc(triggerLabel(event.trigger))}</span>`
      : '',
    hasDetail =
      event.fullResponse || event.error || event.summary || event.inboundMessage || event.replyText;
  let bodyContent = '';
  if ('channel' === event.type) {
    const inboundPreview = event.inboundMessage || event.summary,
      replyPreview = event.replyText || event.fullResponse;
    bodyContent = `\n      ${inboundPreview ? `<div class="event-summary event-summary--channel"><span class="event-preview-label">Inbound</span><span>${previewText(inboundPreview)}</span></div>` : ''}\n      ${replyPreview ? `<div class="event-summary event-summary--channel event-summary--secondary"><span class="event-preview-label">Reply</span><span>${previewText(replyPreview)}</span></div>` : ''}\n      ${!replyPreview && event.error ? `<div class="event-error-preview">${previewText(event.error, 140)}</div>` : ''}`;
  } else if ('error' === event.status && event.error)
    bodyContent = `<div class="event-error-preview">${esc(event.error.slice(0, 140))}${event.error.length > 140 ? '...' : ''}</div>`;
  else if ('skipped' === event.status) {
    const reason =
      event.skipReason || 'Data source returned nothing to act on - no output was sent.';
    bodyContent = `<div class="event-summary muted">${esc(reason)}</div>`;
  } else
    event.summary &&
      (bodyContent = `<div class="event-summary">${esc(event.summary.slice(0, 140))}${event.summary.length > 140 ? '...' : ''}</div>`);
  return (
    (row.innerHTML = `\n    <div class="event-status-icon event-status--${event.status}">${statusIcon}</div>\n    <div class="event-row-body">\n      <div class="event-row-top">\n        <div class="event-source-wrap">\n          ${typeIcon}\n          <span class="event-source">${esc(event.source)}</span>\n          ${event.jobName ? `<span class="event-job-sep">&rsaquo;</span><span class="event-job-name">${esc(event.jobName)}</span>` : ''}\n        </div>\n        <div class="event-row-badges">\n          ${triggerBadge}\n          <span class="event-status-badge event-status-badge--${event.status}">${statusLabel}</span>\n        </div>\n      </div>\n      ${bodyContent}\n      <div class="event-row-footer">\n        <span class="event-time" title="${fullDateTime(event.timestamp)}">${timeAgo(event.timestamp)}</span>\n        ${hasDetail ? `<button class="event-view-btn" type="button">View message</button>` : ''}\n      </div>\n    </div>`),
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
