import {
  escapeHtml,
  formatTrigger,
  fullDateTime,
  getJobLabel,
  getSourceCount,
  timeAgo,
} from '../Pages/Agents/UI/Render/Utils/Utils.js';
export function createHistoryModal({
  dataSourceTypes: dataSourceTypes,
  onOpenResponse: onOpenResponse,
}) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML =
    '\n    <div id="agent-history-backdrop">\n      <div id="agent-history-modal">\n        <div class="agent-history-header">\n          <div>\n            <div class="agent-modal-eyebrow">Run History</div>\n            <h2 id="agent-history-title">Agent</h2>\n          </div>\n          <button class="settings-modal-close" id="agent-history-close" type="button" aria-label="Close">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n            </svg>\n          </button>\n        </div>\n        <div id="agent-history-body" class="agent-history-body"></div>\n      </div>\n    </div>';
  const backdropEl = wrapper.firstElementChild;
  document.body.appendChild(backdropEl);
  const titleEl = backdropEl.querySelector('#agent-history-title'),
    bodyEl = backdropEl.querySelector('#agent-history-body'),
    closeBtn = backdropEl.querySelector('#agent-history-close');
  function close() {
    backdropEl.classList.remove('open');
  }
  const onBackdropClick = (event) => {
    event.target === backdropEl && close();
  };
  return (
    closeBtn.addEventListener('click', close),
    backdropEl.addEventListener('click', onBackdropClick),
    {
      open: function (agent) {
        ((titleEl.textContent = agent.name), (bodyEl.innerHTML = ''));
        const jobs = agent.jobs ?? [];
        let hasAnyRun = !1;
        if (
          (jobs.forEach((job) => {
            const history = job.history ?? [];
            history.length && (hasAnyRun = !0);
            const section = document.createElement('div');
            section.className = 'agent-history-job';
            const sourceCount = getSourceCount(job),
              jobLabel = getJobLabel(job, dataSourceTypes);
            if (
              ((section.innerHTML = `\n        <div class="agent-history-job-header">\n          <span class="agent-history-job-name">${escapeHtml(jobLabel)}</span>\n          ${sourceCount > 1 ? `<span class="agent-history-src-count">${sourceCount} sources</span>` : ''}\n          <span class="agent-history-job-trigger">${formatTrigger(job.trigger)}</span>\n          <span class="agent-history-job-count">${history.length} run${1 !== history.length ? 's' : ''}</span>\n        </div>`),
              history.length)
            )
              history.forEach((entry) => {
                const row = document.createElement('div');
                let statusClass, statusLabel;
                entry.error
                  ? ((statusClass = 'error'), (statusLabel = 'Error'))
                  : entry.nothingToReport || entry.skipped
                    ? ((statusClass = 'nothing'), (statusLabel = 'Nothing to report'))
                    : ((statusClass = 'acted'), (statusLabel = 'Acted'));
                const hasContent = entry.acted && !(!entry.fullResponse && !entry.summary);
                ((row.className = `agent-history-entry agent-history-entry--${statusClass}`),
                  (row.innerHTML = `\n            <div class="agent-history-entry-row">\n              <div class="agent-history-entry-left">\n                <span class="agent-history-entry-time">${timeAgo(entry.timestamp)}</span>\n                <span class="agent-history-entry-datetime">${fullDateTime(entry.timestamp)}</span>\n              </div>\n              <div class="agent-history-entry-right">\n                <span class="agent-history-entry-status agent-history-entry-status--${statusClass}">${statusLabel}</span>\n                ${hasContent ? '<button class="agent-history-view-btn" type="button">View</button>' : ''}\n              </div>\n            </div>\n            ${entry.error ? `<div class="agent-history-entry-error">${escapeHtml(entry.error)}</div>` : entry.nothingToReport || entry.skipped ? '<div class="agent-history-entry-nothing">No data to act on - no email or notification was sent.</div>' : ''}`),
                  row
                    .querySelector('.agent-history-view-btn')
                    ?.addEventListener('click', (event) => {
                      (event.stopPropagation(), onOpenResponse(entry, jobLabel));
                    }),
                  section.appendChild(row));
              });
            else {
              const noRunEl = document.createElement('div');
              ((noRunEl.className = 'agent-history-norun'),
                (noRunEl.textContent = 'No runs yet - click the run button to execute this job.'),
                section.appendChild(noRunEl));
            }
            bodyEl.appendChild(section);
          }),
          !hasAnyRun)
        ) {
          const hintEl = document.createElement('div');
          ((hintEl.className = 'agent-history-empty'),
            (hintEl.innerHTML =
              '\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"\n          style="width:28px;height:28px;opacity:0.35">\n          <path d="M12 8v4l3 3" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/>\n        </svg>\n        <p>No runs recorded yet.<br>Click the run button on the card to execute all jobs.</p>'),
            bodyEl.insertBefore(hintEl, bodyEl.firstChild));
        }
        backdropEl.classList.add('open');
      },
      close: close,
      destroy() {
        (closeBtn.removeEventListener('click', close),
          backdropEl.removeEventListener('click', onBackdropClick),
          backdropEl.remove());
      },
    }
  );
}
