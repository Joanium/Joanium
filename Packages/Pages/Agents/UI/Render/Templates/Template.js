export function getAgentsHTML() {
  return /* html */ `
<main id="main" class="automations-main">
  <div class="automations-scroll">

    <div class="auto-page-header">
      <div class="auto-page-header-copy">
        <h2>
          Agents
          <span class="agents-tagline-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path
                d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z"
                stroke-linecap="round"
              />
              <path
                d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z"
                stroke-linecap="round"
              />
            </svg>
            Thinks &amp; Reacts
          </span>
        </h2>
        <p>Autonomous AI workers that wake up on a schedule, receive your prompt, and use the full chat tool stack to get work done.</p>
      </div>
      <button class="add-automation-btn" id="add-agent-header-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        New Agent
      </button>
    </div>

    <div id="auto-empty" class="auto-empty" hidden>
      <div class="auto-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/></svg>
      </div>
      <h3>No agents yet</h3>
      <p>Create a scheduled agent, give it a prompt, and it will run with the same tools, connectors, and capabilities available in chat.</p>
      <button class="auto-empty-btn" id="add-agent-empty-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:14px;height:14px"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        Create your first agent
      </button>
    </div>

    <div id="auto-grid" class="auto-grid" hidden></div>
  </div>
</main>

<div id="automation-modal-backdrop">
  <div id="automation-modal" role="dialog" aria-modal="true">
    <div class="auto-modal-header">
      <div class="auto-modal-title-group">
        <div class="auto-modal-eyebrow">Autonomous Agent</div>
        <h2 id="agent-modal-title-text">New Agent</h2>
      </div>
      <button class="settings-modal-close" id="auto-modal-close" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>
      </button>
    </div>
    <div class="auto-modal-body">
      <div class="agent-field">
        <label class="agent-field-label" for="agent-name">Agent Name <span class="field-required">*</span></label>
        <input class="agent-input" id="agent-name" type="text" placeholder="PR reviewer, Daily researcher, Inbox closer..." maxlength="80" autocomplete="off"/>
      </div>
      <div class="agent-field">
        <label class="agent-field-label" for="agent-desc">Description <span class="field-optional">optional</span></label>
        <textarea class="agent-textarea" id="agent-desc" placeholder="What is this agent responsible for?"></textarea>
      </div>
      <div class="agent-field">
        <label class="agent-field-label" for="agent-prompt">Prompt <span class="field-required">*</span></label>
        <textarea class="agent-textarea agent-textarea--prompt" id="agent-prompt" placeholder="Tell the agent exactly what to do on every run. Example: Check my GitHub PRs, review anything waiting on me, leave comments if needed, and summarize the result."></textarea>
        <div class="agent-field-hint">This prompt is sent to the AI on every scheduled run. The agent can then use tools, connectors, and MCP capabilities just like chat.</div>
      </div>

      <div class="auto-section">
        <div class="auto-section-label">Schedule</div>
        <div class="agent-field">
          <label class="agent-field-label" for="agent-schedule-select">Run interval</label>
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
        <div class="auto-section-label">Workspace</div>
        <div class="agent-field">
          <label class="agent-field-label">Run inside folder <span class="field-optional">optional</span></label>
          <div class="agent-workspace-panel is-empty" id="agent-workspace-panel">
            <div class="agent-workspace-title" id="agent-workspace-title">No workspace selected</div>
            <div class="agent-workspace-path" id="agent-workspace-path">This agent will run without a default workspace. It will not inherit the folder or project currently open in chat.</div>
          </div>
          <div class="agent-workspace-actions">
            <button type="button" class="agent-workspace-btn" id="agent-workspace-pick-btn">Choose Folder</button>
            <button type="button" class="agent-workspace-btn" id="agent-workspace-current-btn">Use Current Workspace</button>
            <button type="button" class="agent-workspace-btn danger" id="agent-workspace-clear-btn">Clear</button>
          </div>
          <div class="agent-field-hint">Leave this empty if the agent should run without a workspace. In that case it will not fall back to the currently open folder or project.</div>
        </div>
      </div>

      <div class="auto-section">
        <div class="auto-section-label">Models</div>
        <div class="agent-field">
          <label class="agent-field-label">Main model <span class="field-required">*</span></label>
          <div class="agent-model-select-wrap">
            <button type="button" class="agent-model-dropdown-btn" id="primary-model-btn">
              <span id="primary-model-label">Select a model...</span>
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
      <button class="auto-btn-cancel" id="auto-cancel-btn" type="button">Cancel</button>
      <button class="auto-btn-save" id="auto-save-btn" type="button">Save Agent</button>
    </div>
  </div>
</div>

<div class="confirm-overlay" id="confirm-overlay">
  <div class="confirm-box">
    <div class="confirm-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <h3>Delete agent?</h3>
    <p>"<strong id="confirm-automation-name"></strong>" will be permanently deleted.</p>
    <div class="confirm-actions">
      <button class="confirm-cancel-btn" id="confirm-cancel">Cancel</button>
      <button class="confirm-delete-btn" id="confirm-delete">Delete</button>
    </div>
  </div>
</div>
`;
}
