import { escapeHtml, formatTrigger, getJobLabel, getSourceCount, timeAgo } from '../Utils/Utils.js';

export function renderAgentsGrid({
  agents,
  gridEl,
  emptyEl,
  dataSourceTypes,
  resolveModelLabel,
  onToggleAgent,
  onRunAgent,
  onOpenHistory,
  onOpenModal,
  onOpenConfirm,
}) {
  if (!agents.length) {
    emptyEl.hidden = false;
    gridEl.hidden = true;
    return;
  }

  emptyEl.hidden = true;
  gridEl.hidden = false;
  gridEl.innerHTML = '';

  agents.forEach(agent => {
    const card = document.createElement('div');
    card.className = `agent-card${agent.enabled ? '' : ' is-disabled'}`;

    const lastRuns = (agent.jobs ?? []).map(job => job.lastRun).filter(Boolean).sort().reverse();
    const lastRun = lastRuns[0] ? timeAgo(lastRuns[0]) : '';

    const jobRows = (agent.jobs ?? []).slice(0, 3).map(job => {
      const sourceCount = getSourceCount(job);
      const sourceBadge = sourceCount > 1
        ? `<span class="agent-job-sources-badge">${sourceCount} sources</span>`
        : '';

      return `
        <div class="agent-job-row">
          <div class="agent-job-dot"></div>
          <span class="agent-job-trigger">${formatTrigger(job.trigger)}</span>
          <span class="agent-job-label">${escapeHtml(getJobLabel(job, dataSourceTypes))}</span>
          ${sourceBadge}
        </div>`;
    }).join('');

    card.innerHTML = `
      <div class="agent-card-head">
        <div class="agent-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="agent-card-info">
          <div class="agent-name">${escapeHtml(agent.name)}</div>
          ${agent.description ? `<div class="agent-desc">${escapeHtml(agent.description)}</div>` : ''}
        </div>
        <label class="agent-toggle" title="${agent.enabled ? 'Enabled' : 'Disabled'}">
          <input type="checkbox" class="toggle-input" ${agent.enabled ? 'checked' : ''}>
          <div class="agent-toggle-track"></div>
        </label>
      </div>

      <div class="agent-meta">
        <span class="agent-model-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4" stroke-linecap="round"/>
          </svg>
          ${escapeHtml(agent.primaryModel ? resolveModelLabel(agent.primaryModel.provider, agent.primaryModel.modelId) : 'No model')}
        </span>
        <span class="agent-jobs-badge">${(agent.jobs ?? []).length} job${(agent.jobs ?? []).length !== 1 ? 's' : ''}</span>
        ${lastRun ? `<span class="agent-lastrun">${escapeHtml(lastRun)}</span>` : ''}
      </div>

      ${jobRows ? `<div class="agent-jobs-summary">${jobRows}</div>` : ''}

      <div class="agent-card-footer">
        <button class="agent-card-btn run-btn" title="Run all jobs now">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <button class="agent-card-btn history-btn" title="View run history">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v4l3 3" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/></svg>
        </button>
        <button class="agent-card-btn edit-btn" title="Edit agent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round"/></svg>
        </button>
        <button class="agent-card-btn danger delete-btn" title="Delete agent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>`;

    const toggleInput = card.querySelector('.toggle-input');
    const runBtn = card.querySelector('.run-btn');
    const historyBtn = card.querySelector('.history-btn');
    const editBtn = card.querySelector('.edit-btn');
    const deleteBtn = card.querySelector('.delete-btn');

    toggleInput?.addEventListener('change', event => {
      onToggleAgent({ agent, enabled: event.target.checked, card });
    });
    runBtn?.addEventListener('click', () => onRunAgent({ agent, button: runBtn }));
    historyBtn?.addEventListener('click', () => onOpenHistory(agent));
    editBtn?.addEventListener('click', () => onOpenModal(agent));
    deleteBtn?.addEventListener('click', () => onOpenConfirm(agent.id, agent.name));

    gridEl.appendChild(card);
  });
}
