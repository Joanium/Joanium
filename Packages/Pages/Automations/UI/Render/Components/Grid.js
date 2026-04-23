import { escapeHtml, formatTrigger, getJobLabel, getSourceCount, timeAgo } from '../Utils/Utils.js';
import { createCardPool } from '../../../../../System/CardPool.js';
import { t } from '../../../../../System/I18n/index.js';
export function createAgentGrid({
  gridEl: gridEl,
  emptyEl: emptyEl,
  dataSourceTypes: dataSourceTypes,
  resolveModelLabel: resolveModelLabel,
  onToggleAgent: onToggleAgent,
  onRunAgent: onRunAgent,
  onOpenHistory: onOpenHistory,
  onOpenModal: onOpenModal,
  onOpenConfirm: onOpenConfirm,
}) {
  const pool = createCardPool({
    container: gridEl,
    createCard: function () {
      const card = document.createElement('div');
      ((card.className = 'agent-card'),
        (card._currentAgent = null),
        (card.innerHTML =
          '\n      <div class="agent-card-head">\n        <div class="agent-avatar">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">\n            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/>\n            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/>\n          </svg>\n        </div>\n        <div class="agent-card-info">\n          <div class="agent-name"></div>\n          <div class="agent-desc" style="display:none"></div>\n        </div>\n        <label class="agent-toggle" title="">\n          <input type="checkbox" class="toggle-input">\n          <div class="agent-toggle-track"></div>\n        </label>\n      </div>\n\n      <div class="agent-meta">\n        <span class="agent-model-badge">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n            <rect x="2" y="3" width="20" height="14" rx="2"/>\n            <path d="M8 21h8M12 17v4" stroke-linecap="round"/>\n          </svg>\n          <span class="agent-model-text"></span>\n        </span>\n        <span class="agent-jobs-badge"></span>\n        <span class="agent-lastrun" style="display:none"></span>\n      </div>\n\n      <div class="agent-jobs-summary"></div>\n\n      <div class="agent-card-footer">\n        <button class="agent-card-btn run-btn" title="Run all jobs now">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>\n        </button>\n        <button class="agent-card-btn history-btn" title="View run history">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v4l3 3" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/></svg>\n        </button>\n        <button class="agent-card-btn edit-btn" title="Edit agent">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round"/></svg>\n        </button>\n        <button class="agent-card-btn danger delete-btn" title="Delete agent">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>\n        </button>\n      </div>'));
      const toggleInput = card.querySelector('.toggle-input'),
        runBtn = card.querySelector('.run-btn'),
        historyBtn = card.querySelector('.history-btn'),
        editBtn = card.querySelector('.edit-btn'),
        deleteBtn = card.querySelector('.delete-btn');
      return (
        toggleInput?.addEventListener('change', (event) => {
          const agent = card._currentAgent;
          agent && onToggleAgent({ agent: agent, enabled: event.target.checked, card: card });
        }),
        runBtn?.addEventListener('click', () => {
          const a = card._currentAgent;
          a && onRunAgent({ agent: a, button: runBtn });
        }),
        historyBtn?.addEventListener('click', () => {
          card._currentAgent && onOpenHistory(card._currentAgent);
        }),
        editBtn?.addEventListener('click', () => {
          card._currentAgent && onOpenModal(card._currentAgent);
        }),
        deleteBtn?.addEventListener('click', () => {
          const a = card._currentAgent;
          a && onOpenConfirm(a.id, a.name);
        }),
        card
      );
    },
    updateCard: function (card, agent) {
      ((card._currentAgent = agent),
        (card.className = 'agent-card' + (agent.enabled ? '' : ' is-disabled')),
        (card.querySelector('.agent-name').textContent = agent.name),
        (card.querySelector('.agent-toggle').title = agent.enabled
          ? t('automations.enabled ?? agents.enabled', {})
          : t('automations.disabled ?? agents.disabled', {})));
      // Use a safe fallback resolution for the toggle title
      card.querySelector('.agent-toggle').title = agent.enabled
        ? t('agents.enabled')
        : t('agents.disabled');
      ((card.querySelector('.toggle-input').checked = agent.enabled),
        (card.querySelector('.agent-model-text').textContent = agent.primaryModel
          ? resolveModelLabel(agent.primaryModel.provider, agent.primaryModel.modelId)
          : t('agents.noModel')));
      const jobs = agent.jobs ?? [];
      card.querySelector('.agent-jobs-badge').textContent =
        `${jobs.length} job${1 !== jobs.length ? 's' : ''}`;
      const descEl = card.querySelector('.agent-desc');
      agent.description
        ? ((descEl.style.display = ''), (descEl.textContent = agent.description))
        : (descEl.style.display = 'none');
      const lastRuns = jobs
          .map((job) => job.lastRun)
          .filter(Boolean)
          .sort()
          .reverse(),
        lastRunEl = card.querySelector('.agent-lastrun');
      lastRuns[0]
        ? ((lastRunEl.style.display = ''), (lastRunEl.textContent = timeAgo(lastRuns[0])))
        : (lastRunEl.style.display = 'none');
      const jobRows = jobs
          .slice(0, 3)
          .map((job) => {
            const sourceCount = getSourceCount(job),
              sourceBadge =
                sourceCount > 1
                  ? `<span class="agent-job-sources-badge">${sourceCount} sources</span>`
                  : '';
            return `\n        <div class="agent-job-row">\n          <div class="agent-job-dot"></div>\n          <span class="agent-job-trigger">${formatTrigger(job.trigger)}</span>\n          <span class="agent-job-label">${escapeHtml(getJobLabel(job, dataSourceTypes))}</span>\n          ${sourceBadge}\n        </div>`;
          })
          .join(''),
        summaryEl = card.querySelector('.agent-jobs-summary');
      ((summaryEl.innerHTML = jobRows), (summaryEl.style.display = jobRows ? '' : 'none'));
    },
    getKey: (agent) => agent.id,
  });
  return {
    render: function (agents) {
      if (!agents.length) return ((emptyEl.hidden = !1), void (gridEl.hidden = !0));
      ((emptyEl.hidden = !0), (gridEl.hidden = !1), pool.render(agents));
    },
    clear: function () {
      pool.clear();
    },
  };
}
