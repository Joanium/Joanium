import { t } from '../../../../../System/I18n/index.js';

export function getAutomationsHTML() {
  return /* html */ `
<main id="main" class="automations-main">
  <div class="automations-scroll">

    <div class="auto-page-header">
      <div class="auto-page-header-copy">
        <h2>
          ${t('automations.title')}
          <span class="agents-tagline-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z" stroke-linejoin="round" />
            </svg>
            ${t('automations.tagline')}
          </span>
        </h2>
        <p>${t('automations.description')}</p>
      </div>
      <button class="add-automation-btn" id="add-agent-header-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        ${t('automations.newAutomation')}
      </button>
    </div>

    <div id="agents-empty" class="auto-empty" hidden>
      <div class="auto-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z" stroke-linejoin="round" />
        </svg>
      </div>
      <h3>${t('automations.noAutomationsYet')}</h3>
      <p>${t('automations.noAutomationsDesc')}</p>
      <button class="auto-empty-btn" id="add-agent-empty-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:14px;height:14px"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        ${t('automations.createFirst')}
      </button>
    </div>

    <div id="agents-grid" class="auto-grid" hidden></div>
  </div>
</main>

<div id="agent-modal-backdrop">
  <div id="agent-modal" role="dialog" aria-modal="true">
    <div class="auto-modal-header">
      <div class="auto-modal-title-group">
        <div class="auto-modal-eyebrow">${t('automations.eyebrow')}</div>
        <h2 id="agent-modal-title-text">${t('automations.titleNew')}</h2>
      </div>
      <button class="settings-modal-close" id="agent-modal-close" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>
      </button>
    </div>

    <div class="auto-modal-body" id="agent-modal-body">

      <div class="agent-field">
        <label class="agent-field-label" for="agent-name">${t('automations.automationName')} <span class="field-required">*</span></label>
        <input class="agent-input" id="agent-name" type="text" placeholder="Morning Brief, PR Watcher, Inbox Digest..." maxlength="80" autocomplete="off"/>
      </div>
      <div class="agent-field">
        <label class="agent-field-label" for="agent-desc">${t('automations.descriptionLabel')} <span class="field-optional">${t('automations.optional')}</span></label>
        <textarea class="agent-textarea" id="agent-desc" placeholder="What should this automation monitor and why?"></textarea>
      </div>

      <div class="auto-section">
        <div class="auto-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4" stroke-linecap="round"/>
          </svg>
          ${t('automations.aiPower')}
        </div>
        <div class="agent-field">
          <label class="agent-field-label" for="primary-model-btn">${t('automations.primaryModel')} <span class="field-required">*</span></label>
          <div class="agent-model-select-wrap">
            <button type="button" class="agent-model-dropdown-btn" id="primary-model-btn">
              <span id="primary-model-label">${t('automations.selectModel')}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" stroke-linecap="round"/></svg>
            </button>
            <div class="agent-model-menu" id="primary-model-menu"></div>
          </div>
          <div class="agent-field-hint">${t('automations.modelHint')}</div>
        </div>
      </div>

      <div class="auto-section">
        <div class="auto-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13">
            <path d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z" stroke-linejoin="round"/>
          </svg>
          ${t('automations.jobs')}
          <span id="jobs-count-badge" style="font-size:10px;font-weight:500;color:var(--text-muted);letter-spacing:0;text-transform:none;">(0/5)</span>
        </div>
        <div class="agent-field-hint" style="margin-top:-8px;margin-bottom:2px">${t('automations.jobsHint')}</div>
        <div id="jobs-list" class="jobs-list"></div>
        <button type="button" class="add-job-btn" id="add-job-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
          ${t('automations.addJob')}
        </button>
      </div>

    </div>

    <div class="auto-modal-footer">
      <button class="auto-btn-cancel" id="agent-cancel-btn" type="button">${t('automations.cancel')}</button>
      <button class="auto-btn-save" id="agent-save-btn" type="button">${t('automations.saveAutomation')}</button>
    </div>
  </div>
</div>

<div class="confirm-overlay" id="agent-confirm-overlay">
  <div class="confirm-box">
    <div class="confirm-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <h3>${t('automations.deleteTitle')}</h3>
    <p>"<strong id="confirm-agent-name"></strong>" ${t('automations.deletePermanent')}</p>
    <div class="confirm-actions">
      <button class="confirm-cancel-btn" id="confirm-cancel-btn">${t('automations.cancel')}</button>
      <button class="confirm-delete-btn" id="confirm-delete-btn">${t('automations.delete')}</button>
    </div>
  </div>
</div>
`;
}
