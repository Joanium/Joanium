import { t } from '../../../../../System/I18n/index.js';

export function getAgentsHTML() {
  return /* html */ `
<main id="main" class="automations-main">
  <div class="automations-scroll">

    <div class="auto-page-header">
      <div class="auto-page-header-copy">
        <h2>
          ${t('agents.title')}
          <span class="agents-tagline-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/>
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/>
            </svg>
            ${t('agents.tagline')}
          </span>
        </h2>
        <p>${t('agents.description')}</p>
      </div>
      <button class="add-automation-btn" id="add-agent-header-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        ${t('agents.newAgent')}
      </button>
    </div>

    <div id="auto-empty" class="auto-empty" hidden>
      <div class="auto-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/></svg>
      </div>
      <h3>${t('agents.noAgentsYet')}</h3>
      <p>${t('agents.noAgentsDesc')}</p>
      <button class="auto-empty-btn" id="add-agent-empty-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:14px;height:14px"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        ${t('agents.createFirst')}
      </button>
    </div>

    <div id="auto-grid" class="auto-grid" hidden></div>
  </div>
</main>

<div id="automation-modal-backdrop">
  <div id="automation-modal" role="dialog" aria-modal="true">
    <div class="auto-modal-header">
      <div class="auto-modal-title-group">
        <div class="auto-modal-eyebrow">${t('agents.eyebrow')}</div>
        <h2 id="agent-modal-title-text">${t('agents.newAgent')}</h2>
      </div>
      <button class="settings-modal-close" id="auto-modal-close" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>
      </button>
    </div>
    <div class="auto-modal-body">
      <div class="agent-field">
        <label class="agent-field-label" for="agent-name">${t('agents.agentName')} <span class="field-required">*</span></label>
        <input class="agent-input" id="agent-name" type="text" placeholder="PR reviewer, Daily researcher, Inbox closer..." maxlength="80" autocomplete="off"/>
      </div>
      <div class="agent-field">
        <label class="agent-field-label" for="agent-desc">${t('agents.descriptionLabel')} <span class="field-optional">${t('agents.optional')}</span></label>
        <textarea class="agent-textarea" id="agent-desc" placeholder="What is this agent responsible for?"></textarea>
      </div>
      <div class="agent-field">
        <label class="agent-field-label" for="agent-prompt">${t('agents.promptLabel')} <span class="field-required">*</span></label>
        <textarea class="agent-textarea agent-textarea--prompt" id="agent-prompt" placeholder="Tell the agent exactly what to do on every run..."></textarea>
        <div class="agent-field-hint">${t('agents.workspaceHint')}</div>
      </div>

      <div class="auto-section">
        <div class="auto-section-label">${t('agents.schedule')}</div>
        <div class="agent-field">
          <label class="agent-field-label" for="agent-schedule-select">${t('agents.runInterval')}</label>
          <select class="job-param-select" id="agent-schedule-select">
            <option value="1">Every 1 minute</option>
            <option value="5">Every 5 minutes</option>
            <option value="15">Every 15 minutes</option>
            <option value="30" selected>Every 30 minutes</option>
            <option value="60">Every 1 hour</option>
            <option value="120">Every 2 hours</option>
            <option value="240">Every 4 hours</option>
            <option value="480">Every 8 hours</option>
            <option value="1440">Every 24 hours</option>
          </select>
        </div>
      </div>

      <div class="auto-section">
        <div class="auto-section-label">${t('agents.workspace')}</div>
        <div class="agent-field">
          <label class="agent-field-label">${t('agents.runInsideFolder')} <span class="field-optional">${t('agents.optional')}</span></label>
          <div class="agent-workspace-panel is-empty" id="agent-workspace-panel">
            <div class="agent-workspace-title" id="agent-workspace-title">${t('agents.noWorkspaceTitle')}</div>
            <div class="agent-workspace-path" id="agent-workspace-path">${t('agents.noWorkspaceDesc')}</div>
          </div>
          <div class="agent-workspace-actions">
            <button type="button" class="agent-workspace-btn" id="agent-workspace-pick-btn">${t('agents.chooseFolder')}</button>
            <button type="button" class="agent-workspace-btn" id="agent-workspace-current-btn">${t('agents.useCurrentWorkspace')}</button>
            <button type="button" class="agent-workspace-btn danger" id="agent-workspace-clear-btn">${t('agents.clear')}</button>
          </div>
        </div>
      </div>

      <div class="auto-section">
        <div class="auto-section-label">${t('agents.models')}</div>
        <div class="agent-field">
          <label class="agent-field-label">${t('agents.mainModel')} <span class="field-required">*</span></label>
          <div class="agent-model-select-wrap">
            <button type="button" class="agent-model-dropdown-btn" id="primary-model-btn">
              <span id="primary-model-label">${t('agents.selectModel')}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6" stroke-linecap="round" />
              </svg>
            </button>
            <div class="agent-model-menu" id="primary-model-menu"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="auto-modal-footer">
      <button class="auto-btn-cancel" id="auto-cancel-btn" type="button">${t('agents.cancel')}</button>
      <button class="auto-btn-save" id="auto-save-btn" type="button">${t('agents.saveAgent')}</button>
    </div>
  </div>
</div>

<div class="confirm-overlay" id="confirm-overlay">
  <div class="confirm-box">
    <div class="confirm-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <h3>${t('agents.deleteTitle')}</h3>
    <p>"<strong id="confirm-automation-name"></strong>" ${t('agents.deletePermanent')}</p>
    <div class="confirm-actions">
      <button class="confirm-cancel-btn" id="confirm-cancel">${t('agents.cancel')}</button>
      <button class="confirm-delete-btn" id="confirm-delete">${t('agents.delete')}</button>
    </div>
  </div>
</div>
`;
}
