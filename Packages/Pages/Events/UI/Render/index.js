import { getEventsHTML } from './Templates/EventsTemplate.js';
import { esc, timeAgo, runningDuration, fullDateTime, triggerLabel } from './Utils/EventsUtils.js';
import { fetchHistory, fetchRunning } from './Data/EventsFetcher.js';
import { buildRunningCard, buildEventRow } from './Components/EventsCards.js';

const POLL_MS = 1_500;

export function mount(outlet) {
  outlet.innerHTML = getEventsHTML();

  const feedEl          = outlet.querySelector('#events-feed');
  const emptyEl         = outlet.querySelector('#events-empty');
  const loadingEl       = outlet.querySelector('#events-loading');
  const liveBadge       = outlet.querySelector('#events-live-badge');
  const statTotal       = outlet.querySelector('#stat-total');
  const statSuccess     = outlet.querySelector('#stat-success');
  const statSkipped     = outlet.querySelector('#stat-skipped');
  const statErrors      = outlet.querySelector('#stat-errors');
  const statAgents      = outlet.querySelector('#stat-agents');
  const filterBtns      = outlet.querySelectorAll('.events-filter-btn');
  const clearBtn        = outlet.querySelector('#events-clear-btn');
  const detailBackdrop  = outlet.querySelector('#event-detail-backdrop');
  const detailClose     = outlet.querySelector('#event-detail-close');
  const detailEyebrow   = outlet.querySelector('#detail-eyebrow');
  const detailTitle     = outlet.querySelector('#detail-title');
  const detailMeta      = outlet.querySelector('#detail-meta');
  const detailBody      = outlet.querySelector('#detail-body');
  const confirmBackdrop = outlet.querySelector('#events-confirm-backdrop');
  const confirmCancel   = outlet.querySelector('#events-confirm-cancel');
  const confirmOk       = outlet.querySelector('#events-confirm-ok');

  let historyEvents  = [];
  let runningJobs    = [];
  let seenHistoryIds = new Set();
  let filter         = 'all';
  let pollTimer      = null;
  let firstLoad      = true;
  let clearing       = false;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function show(element) { if (element) element.style.display = ''; }
  function hide(element) { if (element) element.style.display = 'none'; }

  function applyFilter(events) {
    switch (filter) {
      case 'agents':      return events.filter((e) => e.type === 'agent');
      case 'automations': return events.filter((e) => e.type === 'automation');
      case 'errors':      return events.filter((e) => e.status === 'error');
      default:            return events;
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  function updateStats(nextHistory, nextRunning) {
    statTotal.textContent   = String(nextHistory.length);
    statSuccess.textContent = String(nextHistory.filter((e) => e.status === 'success').length);
    statSkipped.textContent = String(nextHistory.filter((e) => e.status === 'skipped').length);
    statErrors.textContent  = String(nextHistory.filter((e) => e.status === 'error').length);

    const historicIds = new Set(nextHistory.filter((e) => e.type === 'agent').map((e) => e.agentId));
    const runningIds  = new Set(nextRunning.map((j) => j.agentId));
    statAgents.textContent  = String(new Set([...historicIds, ...runningIds]).size);
  }

  function zeroStats() {
    statTotal.textContent = statSuccess.textContent =
      statSkipped.textContent = statErrors.textContent =
      statAgents.textContent = '0';
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  function renderHistory(nextHistory, newIds = new Set()) {
    feedEl.querySelectorAll('.event-date-header, .event-row:not(.event-row--running)').forEach((el) => el.remove());

    const filtered = applyFilter(nextHistory);
    if (!filtered.length) return;

    const today     = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    const groups    = new Map();

    for (const event of filtered) {
      const day = new Date(event.timestamp).toDateString();
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day).push(event);
    }

    for (const [day, events] of groups) {
      const header = document.createElement('div');
      header.className = 'event-date-header';
      header.textContent = day === today
        ? 'Today'
        : day === yesterday
          ? 'Yesterday'
          : new Date(day).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
      feedEl.appendChild(header);
      for (const event of events) {
        feedEl.appendChild(buildEventRow(event, newIds.has(event.id), openDetail));
      }
    }
  }

  function render(nextHistory, nextRunning, newHistoryIds = new Set()) {
    hide(loadingEl);

    const hasAnything = nextRunning.length > 0 || applyFilter(nextHistory).length > 0;
    if (!hasAnything) { hide(feedEl); show(emptyEl); return; }

    hide(emptyEl);
    show(feedEl);

    // Reconcile running cards
    const existingRunKeys = new Set(
      Array.from(feedEl.querySelectorAll('.event-row--running')).map((el) => el.dataset.runKey)
    );
    const nextRunKeys = new Set(nextRunning.map((j) => `${j.agentId}__${j.jobId}`));

    feedEl.querySelectorAll('.event-row--running').forEach((el) => {
      if (!nextRunKeys.has(el.dataset.runKey)) {
        el.classList.add('event-row--finishing');
        setTimeout(() => el.remove(), 400);
      }
    });

    for (const job of nextRunning) {
      const key = `${job.agentId}__${job.jobId}`;
      if (!existingRunKeys.has(key)) {
        const card = buildRunningCard(job);
        const firstHeader = feedEl.querySelector('.event-date-header');
        if (firstHeader) feedEl.insertBefore(card, firstHeader);
        else feedEl.prepend(card);
      }
    }

    // Tick elapsed timers
    feedEl.querySelectorAll('.elapsed-value').forEach((el) => {
      const started = el.closest('.event-row--running')
        ?.querySelector('.running-duration')
        ?.dataset?.started;
      if (started) el.textContent = runningDuration(started);
    });

    renderHistory(nextHistory, newHistoryIds);
  }

  // ── Detail modal ───────────────────────────────────────────────────────────

  function openDetail(event) {
    detailEyebrow.textContent = event.type === 'agent' ? 'Agent Output' : 'Automation Run';
    detailTitle.textContent   = event.jobName ? `${event.source} > ${event.jobName}` : event.source;
    detailMeta.textContent    = fullDateTime(event.timestamp);

    let html = '';
    if (event.status === 'error') {
      html += `<div class="detail-section detail-section--error">
        <div class="detail-section-label">Error</div>
        <div class="detail-error-text">${esc(event.error)}</div>
      </div>`;
    }
    if (event.status === 'skipped') {
      html += `<div class="detail-section">
        <div class="detail-section-label">Why was this skipped?</div>
        <div class="detail-skipped-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16" style="flex-shrink:0">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" stroke-linecap="round"/>
          </svg>
          ${esc(event.skipReason || 'Data source returned nothing to act on.')}
        </div>
      </div>`;
    }
    if (event.fullResponse) {
      html += `<div class="detail-section">
        <div class="detail-section-label">AI Output</div>
        <div class="detail-response">${esc(event.fullResponse)}</div>
      </div>`;
    } else if (event.summary && event.status === 'success') {
      html += `<div class="detail-section">
        <div class="detail-section-label">Summary</div>
        <div class="detail-response">${esc(event.summary)}</div>
      </div>`;
    }
    if (event.trigger) {
      html += `<div class="detail-section">
        <div class="detail-section-label">Trigger</div>
        <div class="detail-meta-pill">${esc(triggerLabel(event.trigger))}</div>
      </div>`;
    }

    detailBody.innerHTML = html || '<div class="detail-no-content">No additional detail available.</div>';
    detailBackdrop.classList.add('open');
    document.body.classList.add('modal-open');
  }

  function closeDetail() {
    detailBackdrop.classList.remove('open');
    document.body.classList.remove('modal-open');
  }

  // ── Confirm clear ──────────────────────────────────────────────────────────

  function openConfirmClear() {
    confirmBackdrop.classList.add('open');
    document.body.classList.add('modal-open');
  }

  function closeConfirmClear() {
    confirmBackdrop.classList.remove('open');
    document.body.classList.remove('modal-open');
  }

  async function executeClear() {
    closeConfirmClear();
    clearing = true;

    try {
      await window.electronAPI?.clearEventsHistory?.();
    } catch (error) {
      console.error('[Events] clearEventsHistory IPC failed:', error);
    }

    historyEvents  = [];
    seenHistoryIds = new Set();
    feedEl.querySelectorAll('.event-date-header, .event-row:not(.event-row--running)').forEach((el) => el.remove());

    if (runningJobs.length === 0) { hide(feedEl); show(emptyEl); }

    zeroStats();
    setTimeout(() => { clearing = false; }, 800);
  }

  // ── Polling ────────────────────────────────────────────────────────────────

  async function poll() {
    if (clearing) return;

    try {
      const [nextHistory, nextRunning] = await Promise.all([fetchHistory(), fetchRunning()]);

      const newIds = new Set();
      for (const event of nextHistory) {
        if (!seenHistoryIds.has(event.id)) {
          newIds.add(event.id);
          seenHistoryIds.add(event.id);
        }
      }

      const historyChanged = firstLoad || newIds.size > 0;
      const prevRunKeys    = runningJobs.map((j) => `${j.agentId}__${j.jobId}`).join(',');
      const nextRunKeys    = nextRunning.map((j) => `${j.agentId}__${j.jobId}`).join(',');
      const runningChanged = prevRunKeys !== nextRunKeys;

      historyEvents = nextHistory;
      runningJobs   = nextRunning;

      if (historyChanged || runningChanged) {
        updateStats(nextHistory, nextRunning);
        render(nextHistory, nextRunning, firstLoad ? new Set() : newIds);

        if (!firstLoad && (newIds.size > 0 || runningChanged)) {
          liveBadge.classList.add('pulse');
          setTimeout(() => liveBadge.classList.remove('pulse'), 1_200);
        }
      } else if (nextRunning.length > 0) {
        feedEl.querySelectorAll('.elapsed-value').forEach((el) => {
          const started = el.closest('.event-row--running')
            ?.querySelector('.running-duration')
            ?.dataset?.started;
          if (started) el.textContent = runningDuration(started);
        });
      }

      if (firstLoad) { hide(loadingEl); firstLoad = false; }
    } catch (error) {
      console.error('[Events] poll error:', error);
      if (firstLoad) { hide(loadingEl); firstLoad = false; }
    }
  }

  async function start() {
    show(loadingEl); hide(emptyEl); hide(feedEl);
    await poll();
    pollTimer = setInterval(poll, POLL_MS);
  }

  // ── Event wiring ───────────────────────────────────────────────────────────

  const onVisibility = () => {
    clearInterval(pollTimer);
    if (!document.hidden) { poll(); pollTimer = setInterval(poll, POLL_MS); }
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape') { closeDetail(); closeConfirmClear(); }
  };

  detailClose?.addEventListener('click', closeDetail);
  detailBackdrop?.addEventListener('click', (event) => {
    if (event.target === detailBackdrop) closeDetail();
  });
  clearBtn?.addEventListener('click', openConfirmClear);
  confirmCancel?.addEventListener('click', closeConfirmClear);
  confirmOk?.addEventListener('click', executeClear);
  confirmBackdrop?.addEventListener('click', (event) => {
    if (event.target === confirmBackdrop) closeConfirmClear();
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

  start();

  // ── Cleanup ────────────────────────────────────────────────────────────────

  return function cleanup() {
    clearInterval(pollTimer);
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('visibilitychange', onVisibility);
    detailBackdrop?.classList.remove('open');
    confirmBackdrop?.classList.remove('open');
    document.body.classList.remove('modal-open');
  };
}
