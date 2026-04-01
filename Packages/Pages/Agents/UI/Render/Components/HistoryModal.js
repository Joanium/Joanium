import { escapeHtml, formatTrigger, fullDateTime, getJobLabel, getSourceCount, timeAgo } from '../Utils/Utils.js';

export function createHistoryModal({ dataSourceTypes, onOpenResponse }) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="agent-history-backdrop">
      <div id="agent-history-modal">
        <div class="agent-history-header">
          <div>
            <div class="agent-modal-eyebrow">Run History</div>
            <h2 id="agent-history-title">Agent</h2>
          </div>
          <button class="settings-modal-close" id="agent-history-close" type="button" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>
        <div id="agent-history-body" class="agent-history-body"></div>
      </div>
    </div>`;

  const backdropEl = wrapper.firstElementChild;
  document.body.appendChild(backdropEl);

  const titleEl = backdropEl.querySelector('#agent-history-title');
  const bodyEl = backdropEl.querySelector('#agent-history-body');
  const closeBtn = backdropEl.querySelector('#agent-history-close');

  function close() {
    backdropEl.classList.remove('open');
  }

  function open(agent) {
    titleEl.textContent = agent.name;
    bodyEl.innerHTML = '';

    const jobs = agent.jobs ?? [];
    let hasAnyRun = false;

    jobs.forEach(job => {
      const history = job.history ?? [];
      if (history.length) hasAnyRun = true;

      const section = document.createElement('div');
      section.className = 'agent-history-job';

      const sourceCount = getSourceCount(job);
      const jobLabel = getJobLabel(job, dataSourceTypes);

      section.innerHTML = `
        <div class="agent-history-job-header">
          <span class="agent-history-job-name">${escapeHtml(jobLabel)}</span>
          ${sourceCount > 1 ? `<span class="agent-history-src-count">${sourceCount} sources</span>` : ''}
          <span class="agent-history-job-trigger">${formatTrigger(job.trigger)}</span>
          <span class="agent-history-job-count">${history.length} run${history.length !== 1 ? 's' : ''}</span>
        </div>`;

      if (!history.length) {
        const noRunEl = document.createElement('div');
        noRunEl.className = 'agent-history-norun';
        noRunEl.textContent = 'No runs yet - click the run button to execute this job.';
        section.appendChild(noRunEl);
      } else {
        history.forEach(entry => {
          const row = document.createElement('div');

          let statusClass;
          let statusLabel;
          if (entry.error) {
            statusClass = 'error';
            statusLabel = 'Error';
          } else if (entry.nothingToReport || entry.skipped) {
            statusClass = 'nothing';
            statusLabel = 'Nothing to report';
          } else {
            statusClass = 'acted';
            statusLabel = 'Acted';
          }

          const hasContent = entry.acted && !!(entry.fullResponse || entry.summary);

          row.className = `agent-history-entry agent-history-entry--${statusClass}`;
          row.innerHTML = `
            <div class="agent-history-entry-row">
              <div class="agent-history-entry-left">
                <span class="agent-history-entry-time">${timeAgo(entry.timestamp)}</span>
                <span class="agent-history-entry-datetime">${fullDateTime(entry.timestamp)}</span>
              </div>
              <div class="agent-history-entry-right">
                <span class="agent-history-entry-status agent-history-entry-status--${statusClass}">${statusLabel}</span>
                ${hasContent ? '<button class="agent-history-view-btn" type="button">View</button>' : ''}
              </div>
            </div>
            ${entry.error
              ? `<div class="agent-history-entry-error">${escapeHtml(entry.error)}</div>`
              : (entry.nothingToReport || entry.skipped)
                ? '<div class="agent-history-entry-nothing">No data to act on - no email or notification was sent.</div>'
                : ''}`;

          row.querySelector('.agent-history-view-btn')?.addEventListener('click', event => {
            event.stopPropagation();
            onOpenResponse(entry, jobLabel);
          });

          section.appendChild(row);
        });
      }

      bodyEl.appendChild(section);
    });

    if (!hasAnyRun) {
      const hintEl = document.createElement('div');
      hintEl.className = 'agent-history-empty';
      hintEl.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
          style="width:28px;height:28px;opacity:0.35">
          <path d="M12 8v4l3 3" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/>
        </svg>
        <p>No runs recorded yet.<br>Click the run button on the card to execute all jobs.</p>`;
      bodyEl.insertBefore(hintEl, bodyEl.firstChild);
    }

    backdropEl.classList.add('open');
  }

  const onBackdropClick = event => {
    if (event.target === backdropEl) close();
  };

  closeBtn.addEventListener('click', close);
  backdropEl.addEventListener('click', onBackdropClick);

  return {
    open,
    close,
    destroy() {
      closeBtn.removeEventListener('click', close);
      backdropEl.removeEventListener('click', onBackdropClick);
      backdropEl.remove();
    },
  };
}
