export function getAgentsHTML() {
  return `
<main id="main" class="agents-main">
  <div class="agents-scroll">

    <div class="agents-page-header">
      <div class="agents-page-header-copy">
        <h2>
          Agents
          <span class="agents-tagline-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path
                d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z"
                stroke-linecap="round" />
              <path
                d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z"
                stroke-linecap="round" />
            </svg>
            Thinks &amp; Reacts
          </span>
        </h2>
        <p>AI-powered employees that monitor, analyze, and act on your behalf - using real intelligence, not just rules.</p>
      </div>
      <div class="agents-header-actions">
        <button class="add-agent-btn" id="add-agent-header-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
          New Agent
        </button>
      </div>
    </div>

    <div id="agents-empty" class="agents-empty" hidden>
      <div class="agents-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="26" height="26">
          <path
            d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z"
            stroke-linecap="round" />
          <path
            d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z"
            stroke-linecap="round" />
        </svg>
      </div>
      <h3>No agents yet</h3>
      <p>Create your first AI agent to start delegating intelligent, scheduled work - like email triage, PR monitoring, or daily news digests.</p>
      <button class="agents-empty-btn" id="add-agent-empty-btn">
        + Create your first Agent
      </button>
    </div>

    <div id="agents-grid" class="agents-grid" hidden></div>
  </div>
</main>

<div id="agent-modal-backdrop">
  <div id="agent-modal">

    <div class="agent-modal-header">
      <div class="agent-modal-title-group">
        <div class="agent-modal-eyebrow">Configure Agent</div>
        <h2 id="agent-modal-title-text">New Agent</h2>
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
              d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z"
              stroke-linecap="round" />
            <path
              d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z"
              stroke-linecap="round" />
          </svg>
          Identity
        </div>
        <div class="agent-field">
          <label class="agent-field-label">Agent Name <span style="color:var(--accent)">*</span></label>
          <input type="text" id="agent-name" class="agent-input"
            placeholder="e.g. Inbox Analyst, PR Watcher, Morning Briefer" maxlength="80" autocomplete="off" />
        </div>
        <div class="agent-field">
          <label class="agent-field-label">Description <span
              style="color:var(--text-muted);font-weight:400">(optional)</span></label>
          <textarea id="agent-desc" class="agent-textarea"
            placeholder="What does this agent do? This becomes part of its personality in every AI call..."></textarea>
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
          <div class="agent-field-hint">This model handles all AI reasoning for this agent's jobs.</div>
        </div>

        <div class="agent-field">
          <label class="agent-field-label">Fallback Models <span
              style="color:var(--text-muted);font-weight:400">(optional)</span></label>
          <div class="agent-fallback-list" id="fallback-models-list">
            <div style="font-size:12px;color:var(--text-muted);padding:4px">Connect a provider in Settings to see available
              models.</div>
          </div>
          <div class="agent-field-hint">If the primary model fails, these are tried in order. Smart failover keeps
            your agent running.</div>
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
          Each job is a scheduled task: collect data -> AI thinks -> take action. Max 5 jobs per agent.
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
      <button type="button" class="agent-btn-save" id="agent-save-btn">Save Agent</button>
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
    <h3>Delete Agent?</h3>
    <p>Delete <strong id="confirm-agent-name"></strong>? This cannot be undone.</p>
    <div class="agent-confirm-actions">
      <button class="agent-confirm-cancel" id="confirm-cancel-btn">Cancel</button>
      <button class="agent-confirm-delete" id="confirm-delete-btn">Delete</button>
    </div>
  </div>
</div>`;
}
