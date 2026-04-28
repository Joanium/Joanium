import { getEventsHTML } from './Templates/EventsTemplate.js';
import { esc, runningDuration, fullDateTime, triggerLabel } from './Utils/EventsUtils.js';
import { fetchHistory, fetchRunning } from './Data/EventsFetcher.js';
import { buildRunningCard, buildEventRow } from './Components/EventsCards.js';

function runningJobKey(job) {
  return `${job.type ?? 'run'}__${job.agentId ?? job.automationId ?? ''}__${job.jobId ?? ''}`;
}

function eventSourceKey(event) {
  switch (event.type) {
    case 'agent':
      return `agent:${event.agentId ?? event.source ?? event.id}`;
    case 'automation':
      return `automation:${event.autoId ?? event.source ?? event.id}`;
    case 'channel':
      return `channel:${event.channel ?? event.source ?? event.id}`;
    default:
      return `${event.type ?? 'event'}:${event.id ?? event.source ?? 'unknown'}`;
  }
}

function runningSourceKey(job) {
  return 'automation' === job.type
    ? `automation:${job.automationId ?? job.automationName ?? job.jobId ?? 'running'}`
    : `agent:${job.agentId ?? job.agentName ?? job.jobId ?? 'running'}`;
}

function hasDetailValue(value) {
  return !(null == value || '' === String(value).trim());
}

function buildDetailInfoItem(label, value) {
  if (!hasDetailValue(value)) return '';
  return `<div class="detail-info-card">
    <div class="detail-info-label">${esc(label)}</div>
    <div class="detail-info-value">${esc(value)}</div>
  </div>`;
}

function openModal(backdrop) {
  backdrop?.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeModal(backdrop) {
  backdrop?.classList.remove('open');
  document.body.classList.remove('modal-open');
}

export function mount(outlet) {
  outlet.innerHTML = getEventsHTML();
  // Move modals to body so position:fixed covers full viewport incl. titlebar
  document.getElementById('event-detail-backdrop') &&
    document.body.appendChild(document.getElementById('event-detail-backdrop'));
  document.getElementById('events-confirm-backdrop') &&
    document.body.appendChild(document.getElementById('events-confirm-backdrop'));

  const feedEl = document.getElementById('events-feed'),
    emptyEl = document.getElementById('events-empty'),
    loadingEl = document.getElementById('events-loading'),
    liveBadge = document.getElementById('events-live-badge'),
    statTotal = document.getElementById('stat-total'),
    statSuccess = document.getElementById('stat-success'),
    statSkipped = document.getElementById('stat-skipped'),
    statErrors = document.getElementById('stat-errors'),
    statAgents = document.getElementById('stat-agents'),
    filterBtns = document.querySelectorAll('.events-filter-btn'),
    clearBtn = document.getElementById('events-clear-btn'),
    detailBackdrop = document.getElementById('event-detail-backdrop'),
    detailClose = document.getElementById('event-detail-close'),
    detailEyebrow = document.getElementById('detail-eyebrow'),
    detailTitle = document.getElementById('detail-title'),
    detailMeta = document.getElementById('detail-meta'),
    detailBody = document.getElementById('detail-body'),
    confirmBackdrop = document.getElementById('events-confirm-backdrop'),
    confirmCancel = document.getElementById('events-confirm-cancel'),
    confirmOk = document.getElementById('events-confirm-ok');

  let historyEvents = [],
    runningJobs = [],
    seenHistoryIds = new Set(),
    filter = 'all',
    pollTimer = null,
    firstLoad = !0,
    clearing = !1;

  function show(element) {
    element && (element.hidden = false);
  }

  function hide(element) {
    element && (element.hidden = true);
  }

  function applyFilter(events) {
    switch (filter) {
      case 'agents':
        return events.filter((event) => 'agent' === event.type);
      case 'automations':
        return events.filter((event) => 'automation' === event.type);
      case 'channels':
        return events.filter((event) => 'channel' === event.type);
      case 'errors':
        return events.filter((event) => 'error' === event.status);
      default:
        return events;
    }
  }

  function renderHistory(nextHistory, newIds = new Set()) {
    feedEl
      .querySelectorAll('.event-date-header, .event-row:not(.event-row--running)')
      .forEach((el) => el.remove());

    const filtered = applyFilter(nextHistory);
    if (!filtered.length) return;

    const today = new Date().toDateString(),
      yesterday = new Date(Date.now() - 864e5).toDateString(),
      groups = new Map();

    for (const event of filtered) {
      const day = new Date(event.timestamp).toDateString();
      (groups.has(day) || groups.set(day, []), groups.get(day).push(event));
    }

    for (const [day, events] of groups) {
      const header = document.createElement('div');
      header.className = 'event-date-header';
      header.textContent =
        day === today
          ? 'Today'
          : day === yesterday
            ? 'Yesterday'
            : new Date(day).toLocaleDateString([], {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              });
      feedEl.appendChild(header);

      for (const event of events) {
        feedEl.appendChild(buildEventRow(event, newIds.has(event.id), openDetail));
      }
    }
  }

  function render(nextHistory, nextRunning, newHistoryIds = new Set()) {
    const filteredHistory = applyFilter(nextHistory);
    if (!(nextRunning.length > 0 || filteredHistory.length > 0)) {
      hide(loadingEl);
      hide(feedEl);
      show(emptyEl);
      return;
    }

    hide(loadingEl);
    hide(emptyEl);
    show(feedEl);

    const existingRunKeys = new Set(
        Array.from(feedEl.querySelectorAll('.event-row--running')).map((el) => el.dataset.runKey),
      ),
      nextRunKeys = new Set(nextRunning.map(runningJobKey));

    feedEl.querySelectorAll('.event-row--running').forEach((el) => {
      nextRunKeys.has(el.dataset.runKey) ||
        (el.classList.add('event-row--finishing'), setTimeout(() => el.remove(), 400));
    });

    for (const job of nextRunning) {
      const key = runningJobKey(job);
      if (!existingRunKeys.has(key)) {
        const card = buildRunningCard(job),
          firstHeader = feedEl.querySelector('.event-date-header');
        firstHeader ? feedEl.insertBefore(card, firstHeader) : feedEl.prepend(card);
      }
    }

    feedEl.querySelectorAll('.elapsed-value').forEach((el) => {
      const started = el.closest('.event-row--running')?.querySelector('.running-duration')
        ?.dataset?.started;
      started && (el.textContent = runningDuration(started));
    });

    renderHistory(nextHistory, newHistoryIds);
  }

  function openDetail(event) {
    if ('channel' === event.type) {
      detailEyebrow.textContent = 'Channel Message';
      detailTitle.textContent = event.jobName ? `${event.source} > ${event.jobName}` : event.source;
      detailMeta.textContent = fullDateTime(event.receivedAt || event.timestamp);

      const detailItems = [
          buildDetailInfoItem('Channel', event.source),
          buildDetailInfoItem('From', event.channelFrom || event.jobName),
          buildDetailInfoItem('Received', fullDateTime(event.receivedAt || event.timestamp)),
          event.repliedAt && event.repliedAt !== event.receivedAt
            ? buildDetailInfoItem('Replied', fullDateTime(event.repliedAt))
            : '',
          buildDetailInfoItem('Model', event.model),
          buildDetailInfoItem('Conversation', event.conversationId),
          event.targetId && event.targetId !== event.conversationId
            ? buildDetailInfoItem('Target', event.targetId)
            : '',
          buildDetailInfoItem('Message ID', event.externalId),
        ]
          .filter(Boolean)
          .join(''),
        sections = [];

      detailItems &&
        sections.push(`<div class="detail-section">
          <div class="detail-section-label">Message Details</div>
          <div class="detail-info-grid">${detailItems}</div>
        </div>`);

      event.inboundMessage &&
        sections.push(`<div class="detail-section">
          <div class="detail-section-label">Inbound Message</div>
          <div class="detail-response">${esc(event.inboundMessage)}</div>
        </div>`);

      event.fullResponse &&
        sections.push(`<div class="detail-section">
          <div class="detail-section-label">AI Response</div>
          <div class="detail-response">${esc(event.fullResponse)}</div>
        </div>`);

      event.error &&
        sections.push(`<div class="detail-section detail-section--error">
          <div class="detail-section-label">Processing Error</div>
          <div class="detail-error-text">${esc(event.error)}</div>
        </div>`);

      detailBody.innerHTML =
        sections.join('') || '<div class="detail-no-content">No additional detail available.</div>';
      openModal(detailBackdrop);
      return;
    }

    detailEyebrow.textContent = 'agent' === event.type ? 'Agent Output' : 'Automation Run';
    detailTitle.textContent = event.jobName ? `${event.source} > ${event.jobName}` : event.source;
    detailMeta.textContent = fullDateTime(event.timestamp);

    let html = '';

    'error' === event.status &&
      (html += `<div class="detail-section detail-section--error">
        <div class="detail-section-label">Error</div>
        <div class="detail-error-text">${esc(event.error)}</div>
      </div>`);

    'skipped' === event.status &&
      (html += `<div class="detail-section">
        <div class="detail-section-label">Why was this skipped?</div>
        <div class="detail-skipped-note">
          <svg class="detail-skipped-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" stroke-linecap="round"/>
          </svg>
          ${esc(event.skipReason || 'Data source returned nothing to act on.')}
        </div>
      </div>`);

    if (event.fullResponse) {
      html += `<div class="detail-section">
        <div class="detail-section-label">AI Output</div>
        <div class="detail-response">${esc(event.fullResponse)}</div>
      </div>`;
    } else if (event.summary && 'success' === event.status) {
      html += `<div class="detail-section">
        <div class="detail-section-label">Summary</div>
        <div class="detail-response">${esc(event.summary)}</div>
      </div>`;
    }

    event.trigger &&
      (html += `<div class="detail-section">
        <div class="detail-section-label">Trigger</div>
        <div class="detail-meta-pill">${esc(triggerLabel(event.trigger))}</div>
      </div>`);

    detailBody.innerHTML =
      html || '<div class="detail-no-content">No additional detail available.</div>';
    openModal(detailBackdrop);
  }

  function closeDetail() {
    closeModal(detailBackdrop);
  }

  function closeConfirmClear() {
    closeModal(confirmBackdrop);
  }

  function updateStats(nextHistory, nextRunning) {
    statTotal.textContent = String(nextHistory.length);
    statSuccess.textContent = String(
      nextHistory.filter((event) => 'success' === event.status).length,
    );
    statSkipped.textContent = String(
      nextHistory.filter((event) => 'skipped' === event.status).length,
    );
    statErrors.textContent = String(nextHistory.filter((event) => 'error' === event.status).length);

    const sources = new Set(nextHistory.map(eventSourceKey));
    nextRunning.forEach((job) => sources.add(runningSourceKey(job)));
    statAgents.textContent = String(sources.size);
  }

  async function poll() {
    if (clearing) return;

    try {
      const [nextHistory, nextRunning] = await Promise.all([fetchHistory(), fetchRunning()]),
        newIds = new Set();

      for (const event of nextHistory) {
        seenHistoryIds.has(event.id) || (newIds.add(event.id), seenHistoryIds.add(event.id));
      }

      const historyChanged = firstLoad || newIds.size > 0,
        runningChanged =
          runningJobs.map(runningJobKey).join(',') !== nextRunning.map(runningJobKey).join(',');

      historyEvents = nextHistory;
      runningJobs = nextRunning;

      if (historyChanged || runningChanged) {
        updateStats(nextHistory, nextRunning);
        render(nextHistory, nextRunning, firstLoad ? new Set() : newIds);
        !firstLoad &&
          (newIds.size > 0 || runningChanged) &&
          (liveBadge.classList.add('pulse'),
          setTimeout(() => liveBadge.classList.remove('pulse'), 1200));
      } else if (nextRunning.length > 0) {
        feedEl.querySelectorAll('.elapsed-value').forEach((el) => {
          const started = el.closest('.event-row--running')?.querySelector('.running-duration')
            ?.dataset?.started;
          started && (el.textContent = runningDuration(started));
        });
      }

      firstLoad && (hide(loadingEl), (firstLoad = !1));
    } catch (error) {
      console.error('[Events] poll error:', error);
      firstLoad && (hide(loadingEl), (firstLoad = !1));
    }
  }

  const onVisibility = () => {
      clearInterval(pollTimer);
      document.hidden || (poll(), (pollTimer = setInterval(poll, 1500)));
    },
    onKeydown = (event) => {
      'Escape' === event.key && (closeDetail(), closeConfirmClear());
    };

  detailClose?.addEventListener('click', closeDetail);
  detailBackdrop?.addEventListener('click', (event) => {
    event.target === detailBackdrop && closeDetail();
  });

  clearBtn?.addEventListener('click', () => {
    openModal(confirmBackdrop);
  });

  confirmCancel?.addEventListener('click', closeConfirmClear);
  confirmOk?.addEventListener('click', async () => {
    closeConfirmClear();
    clearing = !0;

    try {
      await Promise.all([
        window.electronAPI?.invoke?.('clear-events-history'),
        window.electronAPI?.invoke?.('clear-channel-messages'),
      ]);
    } catch (error) {
      console.error('[Events] clear history failed:', error);
    }

    historyEvents = [];
    seenHistoryIds = new Set();
    feedEl
      .querySelectorAll('.event-date-header, .event-row:not(.event-row--running)')
      .forEach((el) => el.remove());

    if (0 === runningJobs.length) {
      hide(feedEl);
      show(emptyEl);
    }

    statTotal.textContent =
      statSuccess.textContent =
      statSkipped.textContent =
      statErrors.textContent =
      statAgents.textContent =
        '0';

    setTimeout(() => {
      clearing = !1;
    }, 800);
  });

  confirmBackdrop?.addEventListener('click', (event) => {
    event.target === confirmBackdrop && closeConfirmClear();
  });

  filterBtns.forEach((button) => {
    button.addEventListener('click', () => {
      filterBtns.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      filter = button.dataset.filter;
      render(historyEvents, runningJobs);
    });
  });

  document.addEventListener('keydown', onKeydown);
  document.addEventListener('visibilitychange', onVisibility);

  (async () => {
    show(loadingEl);
    hide(emptyEl);
    hide(feedEl);
    await poll();
    pollTimer = setInterval(poll, 1500);
  })();

  return function () {
    clearInterval(pollTimer);
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('visibilitychange', onVisibility);
    detailBackdrop?.classList.remove('open');
    confirmBackdrop?.classList.remove('open');
    detailBackdrop?.remove();
    confirmBackdrop?.remove();
    document.body.classList.remove('modal-open');
  };
}
