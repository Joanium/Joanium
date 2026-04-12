import { getEventsHTML } from './Templates/EventsTemplate.js';
import { esc, runningDuration, fullDateTime, triggerLabel } from './Utils/EventsUtils.js';
import { fetchHistory, fetchRunning } from './Data/EventsFetcher.js';
import { buildRunningCard, buildEventRow } from './Components/EventsCards.js';
export function mount(outlet) {
  outlet.innerHTML = getEventsHTML();
  const feedEl = outlet.querySelector('#events-feed'),
    emptyEl = outlet.querySelector('#events-empty'),
    loadingEl = outlet.querySelector('#events-loading'),
    liveBadge = outlet.querySelector('#events-live-badge'),
    statTotal = outlet.querySelector('#stat-total'),
    statSuccess = outlet.querySelector('#stat-success'),
    statSkipped = outlet.querySelector('#stat-skipped'),
    statErrors = outlet.querySelector('#stat-errors'),
    statAgents = outlet.querySelector('#stat-agents'),
    filterBtns = outlet.querySelectorAll('.events-filter-btn'),
    clearBtn = outlet.querySelector('#events-clear-btn'),
    detailBackdrop = outlet.querySelector('#event-detail-backdrop'),
    detailClose = outlet.querySelector('#event-detail-close'),
    detailEyebrow = outlet.querySelector('#detail-eyebrow'),
    detailTitle = outlet.querySelector('#detail-title'),
    detailMeta = outlet.querySelector('#detail-meta'),
    detailBody = outlet.querySelector('#detail-body'),
    confirmBackdrop = outlet.querySelector('#events-confirm-backdrop'),
    confirmCancel = outlet.querySelector('#events-confirm-cancel'),
    confirmOk = outlet.querySelector('#events-confirm-ok');
  let historyEvents = [],
    runningJobs = [],
    seenHistoryIds = new Set(),
    filter = 'all',
    pollTimer = null,
    firstLoad = !0,
    clearing = !1;
  function show(element) {
    element && (element.style.display = '');
  }
  function hide(element) {
    element && (element.style.display = 'none');
  }
  function applyFilter(events) {
    switch (filter) {
      case 'agents':
        return events.filter((e) => 'agent' === e.type);
      case 'automations':
        return events.filter((e) => 'automation' === e.type);
      case 'errors':
        return events.filter((e) => 'error' === e.status);
      default:
        return events;
    }
  }
  function render(nextHistory, nextRunning, newHistoryIds = new Set()) {
    if ((hide(loadingEl), !(nextRunning.length > 0 || applyFilter(nextHistory).length > 0)))
      return (hide(feedEl), void show(emptyEl));
    (hide(emptyEl), show(feedEl));
    const existingRunKeys = new Set(
        Array.from(feedEl.querySelectorAll('.event-row--running')).map((el) => el.dataset.runKey),
      ),
      nextRunKeys = new Set(nextRunning.map((j) => `${j.agentId}__${j.jobId}`));
    feedEl.querySelectorAll('.event-row--running').forEach((el) => {
      nextRunKeys.has(el.dataset.runKey) ||
        (el.classList.add('event-row--finishing'), setTimeout(() => el.remove(), 400));
    });
    for (const job of nextRunning) {
      const key = `${job.agentId}__${job.jobId}`;
      if (!existingRunKeys.has(key)) {
        const card = buildRunningCard(job),
          firstHeader = feedEl.querySelector('.event-date-header');
        firstHeader ? feedEl.insertBefore(card, firstHeader) : feedEl.prepend(card);
      }
    }
    (feedEl.querySelectorAll('.elapsed-value').forEach((el) => {
      const started = el.closest('.event-row--running')?.querySelector('.running-duration')
        ?.dataset?.started;
      started && (el.textContent = runningDuration(started));
    }),
      (function (nextHistory, newIds = new Set()) {
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
          ((header.className = 'event-date-header'),
            (header.textContent =
              day === today
                ? 'Today'
                : day === yesterday
                  ? 'Yesterday'
                  : new Date(day).toLocaleDateString([], {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })),
            feedEl.appendChild(header));
          for (const event of events)
            feedEl.appendChild(buildEventRow(event, newIds.has(event.id), openDetail));
        }
      })(nextHistory, newHistoryIds));
  }
  function openDetail(event) {
    ((detailEyebrow.textContent = 'agent' === event.type ? 'Agent Output' : 'Automation Run'),
      (detailTitle.textContent = event.jobName
        ? `${event.source} > ${event.jobName}`
        : event.source),
      (detailMeta.textContent = fullDateTime(event.timestamp)));
    let html = '';
    ('error' === event.status &&
      (html += `<div class="detail-section detail-section--error">\n        <div class="detail-section-label">Error</div>\n        <div class="detail-error-text">${esc(event.error)}</div>\n      </div>`),
      'skipped' === event.status &&
        (html += `<div class="detail-section">\n        <div class="detail-section-label">Why was this skipped?</div>\n        <div class="detail-skipped-note">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16" style="flex-shrink:0">\n            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" stroke-linecap="round"/>\n          </svg>\n          ${esc(event.skipReason || 'Data source returned nothing to act on.')}\n        </div>\n      </div>`),
      event.fullResponse
        ? (html += `<div class="detail-section">\n        <div class="detail-section-label">AI Output</div>\n        <div class="detail-response">${esc(event.fullResponse)}</div>\n      </div>`)
        : event.summary &&
          'success' === event.status &&
          (html += `<div class="detail-section">\n        <div class="detail-section-label">Summary</div>\n        <div class="detail-response">${esc(event.summary)}</div>\n      </div>`),
      event.trigger &&
        (html += `<div class="detail-section">\n        <div class="detail-section-label">Trigger</div>\n        <div class="detail-meta-pill">${esc(triggerLabel(event.trigger))}</div>\n      </div>`),
      (detailBody.innerHTML =
        html || '<div class="detail-no-content">No additional detail available.</div>'),
      detailBackdrop.classList.add('open'),
      document.body.classList.add('modal-open'));
  }
  function closeDetail() {
    (detailBackdrop.classList.remove('open'), document.body.classList.remove('modal-open'));
  }
  function closeConfirmClear() {
    (confirmBackdrop.classList.remove('open'), document.body.classList.remove('modal-open'));
  }
  async function poll() {
    if (!clearing)
      try {
        const [nextHistory, nextRunning] = await Promise.all([fetchHistory(), fetchRunning()]),
          newIds = new Set();
        for (const event of nextHistory)
          seenHistoryIds.has(event.id) || (newIds.add(event.id), seenHistoryIds.add(event.id));
        const historyChanged = firstLoad || newIds.size > 0,
          runningChanged =
            runningJobs.map((j) => `${j.agentId}__${j.jobId}`).join(',') !==
            nextRunning.map((j) => `${j.agentId}__${j.jobId}`).join(',');
        ((historyEvents = nextHistory),
          (runningJobs = nextRunning),
          historyChanged || runningChanged
            ? ((function (nextHistory, nextRunning) {
                ((statTotal.textContent = String(nextHistory.length)),
                  (statSuccess.textContent = String(
                    nextHistory.filter((e) => 'success' === e.status).length,
                  )),
                  (statSkipped.textContent = String(
                    nextHistory.filter((e) => 'skipped' === e.status).length,
                  )),
                  (statErrors.textContent = String(
                    nextHistory.filter((e) => 'error' === e.status).length,
                  )));
                const historicIds = new Set(
                    nextHistory.filter((e) => 'agent' === e.type).map((e) => e.agentId),
                  ),
                  runningIds = new Set(nextRunning.map((j) => j.agentId));
                statAgents.textContent = String(new Set([...historicIds, ...runningIds]).size);
              })(nextHistory, nextRunning),
              render(nextHistory, nextRunning, firstLoad ? new Set() : newIds),
              !firstLoad &&
                (newIds.size > 0 || runningChanged) &&
                (liveBadge.classList.add('pulse'),
                setTimeout(() => liveBadge.classList.remove('pulse'), 1200)))
            : nextRunning.length > 0 &&
              feedEl.querySelectorAll('.elapsed-value').forEach((el) => {
                const started = el
                  .closest('.event-row--running')
                  ?.querySelector('.running-duration')?.dataset?.started;
                started && (el.textContent = runningDuration(started));
              }),
          firstLoad && (hide(loadingEl), (firstLoad = !1)));
      } catch (error) {
        (console.error('[Events] poll error:', error),
          firstLoad && (hide(loadingEl), (firstLoad = !1)));
      }
  }
  const onVisibility = () => {
      (clearInterval(pollTimer),
        document.hidden || (poll(), (pollTimer = setInterval(poll, 1500))));
    },
    onKeydown = (event) => {
      'Escape' === event.key && (closeDetail(), closeConfirmClear());
    };
  return (
    detailClose?.addEventListener('click', closeDetail),
    detailBackdrop?.addEventListener('click', (event) => {
      event.target === detailBackdrop && closeDetail();
    }),
    clearBtn?.addEventListener('click', function () {
      (confirmBackdrop.classList.add('open'), document.body.classList.add('modal-open'));
    }),
    confirmCancel?.addEventListener('click', closeConfirmClear),
    confirmOk?.addEventListener('click', async function () {
      (closeConfirmClear(), (clearing = !0));
      try {
        await window.electronAPI?.invoke?.('clear-events-history');
      } catch (error) {
        console.error('[Events] clearEventsHistory IPC failed:', error);
      }
      ((historyEvents = []),
        (seenHistoryIds = new Set()),
        feedEl
          .querySelectorAll('.event-date-header, .event-row:not(.event-row--running)')
          .forEach((el) => el.remove()),
        0 === runningJobs.length && (hide(feedEl), show(emptyEl)),
        (statTotal.textContent =
          statSuccess.textContent =
          statSkipped.textContent =
          statErrors.textContent =
          statAgents.textContent =
            '0'),
        setTimeout(() => {
          clearing = !1;
        }, 800));
    }),
    confirmBackdrop?.addEventListener('click', (event) => {
      event.target === confirmBackdrop && closeConfirmClear();
    }),
    filterBtns.forEach((button) => {
      button.addEventListener('click', () => {
        (filterBtns.forEach((btn) => btn.classList.remove('active')),
          button.classList.add('active'),
          (filter = button.dataset.filter),
          render(historyEvents, runningJobs));
      });
    }),
    document.addEventListener('keydown', onKeydown),
    document.addEventListener('visibilitychange', onVisibility),
    (async function () {
      (show(loadingEl),
        hide(emptyEl),
        hide(feedEl),
        await poll(),
        (pollTimer = setInterval(poll, 1500)));
    })(),
    function () {
      (clearInterval(pollTimer),
        document.removeEventListener('keydown', onKeydown),
        document.removeEventListener('visibilitychange', onVisibility),
        detailBackdrop?.classList.remove('open'),
        confirmBackdrop?.classList.remove('open'),
        document.body.classList.remove('modal-open'));
    }
  );
}
