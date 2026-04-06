export function getAutomationsHTML() {
  return `
<main id="main" class="agents-main">
  <div class="agents-scroll">

    <div class="agents-page-header">
      <div class="agents-page-header-copy">
        <h2>
          Automations
          <span class="agents-tagline-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path
                d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z"
                stroke-linejoin="round" />
            </svg>
            Monitors &amp; Delivers
          </span>
        </h2>
        <p class="agents-page-header-subtitle--single-line">Scheduled workflows that collect data, reason over it with AI, and send the result wherever it needs to go.</p>
      </div>
      <div class="agents-header-actions">
        <button class="add-agent-btn" id="add-agent-header-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
          New Automation
        </button>
      </div>
    </div>

    <div id="agents-empty" class="agents-empty" hidden>
      <div class="agents-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="26" height="26">
          <path
            d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z"
            stroke-linejoin="round" />
        </svg>
      </div>
      <h3>No automations yet</h3>
      <p>Create your first automation to monitor sources, summarize what matters, and ship the output automatically.</p>
      <button class="agents-empty-btn" id="add-agent-empty-btn">
        + Create your first Automation
      </button>
    </div>

    <div id="agents-grid" class="agents-grid" hidden></div>
  </div>
</main>

<div id="agent-modal-backdrop">
  <div id="agent-modal">

    <div class="agent-modal-header">
      <div class="agent-modal-title-group">
        <div class="agent-modal-eyebrow">Configure Automation</div>
        <h2 id="agent-modal-title-text">New Automation</h2>
      </div>
      <button class="settings-modal-close" id="agent-modal-close" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
        </svg>
      </button>
    </div>

    <div class="agent-modal-body" id="agent-modal-body">

      <div class="agent-section">
        <div class="agent-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13">
            <path
              d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z"
              stroke-linejoin="round" />
          </svg>
          Identity
        </div>
        <div class="agent-field">
          <label class="agent-field-label">Automation Name <span style="color:var(--accent)">*</span></label>
          <input type="text" id="agent-name" class="agent-input"
            placeholder="e.g. Morning Brief, PR Watcher, Inbox Digest" maxlength="80" autocomplete="off" />
        </div>
        <div class="agent-field">
          <label class="agent-field-label">Description <span
              style="color:var(--text-muted);font-weight:400">(optional)</span></label>
          <textarea id="agent-desc" class="agent-textarea"
            placeholder="What should this automation monitor and why?"></textarea>
        </div>
      </div>

      <div class="agent-section">
        <div class="agent-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" stroke-linecap="round" />
          </svg>
          AI Power
        </div>

        <div class="agent-field">
          <label class="agent-field-label">Primary Model <span style="color:var(--accent)">*</span></label>
          <div class="agent-model-select-wrap">
            <button type="button" class="agent-model-dropdown-btn" id="primary-model-btn">
              <span id="primary-model-label">Select a model...</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6" stroke-linecap="round" />
              </svg>
            </button>
            <div class="agent-model-menu" id="primary-model-menu"></div>
          </div>
          <div class="agent-field-hint">This model handles the reasoning for every job in the automation.</div>
        </div>
      </div>

      <div class="agent-section">
        <div class="agent-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13">
            <path d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z" stroke-linejoin="round" />
          </svg>
          Jobs <span id="jobs-count-badge"
            style="font-size:10px;font-weight:500;color:var(--text-muted);letter-spacing:0;text-transform:none;">(0/5)</span>
        </div>
        <div class="agent-field-hint" style="margin-top:-8px;margin-bottom:2px">
          Each job is a full workflow: collect data, have AI reason about it, then deliver the result.
        </div>

        <div id="jobs-list" class="jobs-list"></div>

        <button type="button" class="add-job-btn" id="add-job-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
          Add a Job
        </button>
      </div>

    </div>

    <div class="agent-modal-footer">
      <button type="button" class="agent-btn-cancel" id="agent-cancel-btn">Cancel</button>
      <button type="button" class="agent-btn-save" id="agent-save-btn">Save Automation</button>
    </div>

  </div>
</div>

<div class="agent-confirm-overlay" id="agent-confirm-overlay">
  <div class="agent-confirm-box">
    <div class="agent-confirm-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <h3>Delete Automation?</h3>
    <p>Delete <strong id="confirm-agent-name"></strong>? This cannot be undone.</p>
    <div class="agent-confirm-actions">
      <button class="agent-confirm-cancel" id="confirm-cancel-btn">Cancel</button>
      <button class="agent-confirm-delete" id="confirm-delete-btn">Delete</button>
    </div>
  </div>
</div>`;
}
