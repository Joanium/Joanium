export function getAgentsHTML() {
  return /* html */ `
<main id="main" class="agents-main">
  <div class="agents-scroll">
    <div class="page-tagline-header">
      <div class="page-tagline-left">
        <h1 class="page-tagline-title">
          Agents
          <span class="page-tagline-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="12" height="12">
              <rect x="4" y="4" width="16" height="16" rx="4"/>
              <path d="M9 9h6v6H9z"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke-linecap="round"/>
            </svg>
            Prompt + schedule + model
          </span>
        </h1>
        <p class="page-tagline-desc">Create small scheduled agents that run on startup, on a recurring schedule, or from chat with a slash command.</p>
      </div>
      <div class="page-tagline-right">
        <button class="agents-add-btn" id="agents-add-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
          </svg>
          New Agent
        </button>
      </div>
    </div>

    <div class="agents-warning" id="agents-warning" hidden></div>

    <div class="agents-tab-bar">
      <button class="agents-tab is-active" id="agents-tab-agents" data-tab="agents" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14">
          <rect x="4" y="4" width="16" height="16" rx="4"/>
          <path d="M9 9h6v6H9z"/>
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke-linecap="round"/>
        </svg>
        Agents
      </button>
      <button class="agents-tab" id="agents-tab-history" data-tab="history" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 7v5l3 3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        History
      </button>
    </div>

    <!-- Agents view -->
    <div id="agents-view-agents">
      <div class="agents-toolbar">
        <div id="agents-search-wrapper" class="page-search-wrapper" hidden>
          <div class="page-search-box">
            <svg class="page-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="7"/>
              <path d="M16.5 16.5L21 21" stroke-linecap="round"/>
            </svg>
            <input id="agents-search" class="page-search-input" type="text" placeholder="Search agents, slash commands, workspaces..." autocomplete="off" spellcheck="false" />
            <button id="agents-search-clear" class="page-search-clear" type="button" aria-label="Clear search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="agents-grid" id="agents-grid" hidden></div>

      <div class="page-empty" id="agents-empty" hidden>
        <div class="page-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
            <rect x="4" y="4" width="16" height="16" rx="4"/>
            <path d="M9 9h6v6H9z"/>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke-linecap="round"/>
          </svg>
        </div>
        <h3>No agents yet</h3>
        <p>Start with one useful repeatable task and give it a simple schedule.</p>
        <button class="page-empty-cta" id="agents-create-first" type="button">
          Create your first agent
        </button>
      </div>
    </div>

    <!-- History view -->
    <div id="agents-view-history" hidden>
      <div class="agents-history-view-toolbar">
        <select id="agents-history-filter" class="agents-history-filter-select">
          <option value="">All agents</option>
        </select>
      </div>
      <div class="agents-history-view-loading" id="agents-history-view-loading" hidden>
        <svg class="agents-history-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-linecap="round"/>
        </svg>
        Loading history&hellip;
      </div>
      <div id="agents-history-all-body" class="agents-history-all-body"></div>
    </div>

  </div>
</main>

<div class="agents-modal-backdrop" id="agents-modal-backdrop">
    <div class="agents-modal" role="dialog" aria-modal="true" aria-labelledby="agents-modal-title">

      <div class="agents-modal-header">
        <div class="agents-modal-header-copy">
          <div class="agents-modal-eyebrow" id="agents-modal-eyebrow">New Agent</div>
          <h2 class="agents-modal-title" id="agents-modal-title">New Agent</h2>
        </div>
        <button id="agents-modal-close" class="agents-modal-close" type="button" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="agents-modal-status" id="agents-modal-status" hidden></div>

      <div class="agents-modal-body">

        <!-- Identity row -->
        <div class="agents-modal-topline">
          <div class="agents-avatar-preview">
            <img id="agents-avatar-preview" alt="Agent avatar" />
          </div>
          <div class="agents-topline-fields">
            <div>
              <label class="agents-label" for="agents-name-input">Agent name</label>
              <input id="agents-name-input" class="agents-field" type="text" placeholder="daily_standup" autocomplete="off" spellcheck="false" />
              <div class="agents-input-hint" id="agents-name-hint"></div>
            </div>
            <div>
              <label class="agents-label" for="agents-description-input">
                Description <span class="agents-optional">(optional)</span>
              </label>
              <input id="agents-description-input" class="agents-field" type="text" placeholder="What this agent does" autocomplete="off" />
            </div>
          </div>
        </div>

        <!-- Prompt -->
        <div>
          <label class="agents-label" for="agents-prompt-input">Prompt</label>
          <textarea id="agents-prompt-input" class="agents-field agents-textarea" rows="6"
            placeholder="Write the exact task this agent should do every time it runs."></textarea>
        </div>

        <!-- Schedule + Model side by side -->
        <div class="agents-modal-grid">

          <!-- Schedule panel -->
          <div class="agents-modal-panel">
            <div class="agents-panel-title">Schedule</div>
            <div class="agents-field-grid">

              <!-- Enabled toggle -->
              <label class="agents-switch-row" for="agents-enabled-input">
                <span class="agents-switch-label">Enabled</span>
                <span class="agents-toggle-wrap">
                  <input id="agents-enabled-input" class="agents-toggle-input" type="checkbox" checked />
                  <span class="agents-toggle-track"><span class="agents-toggle-thumb"></span></span>
                </span>
              </label>

              <!-- Trigger type -->
              <div>
                <label class="agents-label" for="agents-trigger-type">Run when</label>
                <select id="agents-trigger-type" class="agents-field">
                  <option value="on_startup">On app startup</option>
                  <option value="cron">On a schedule</option>
                </select>
              </div>

              <!-- Schedule sub-editor (shown when "On a schedule" chosen) -->
              <div id="agents-schedule-editor" hidden>
                <label class="agents-label" for="agents-schedule-mode">Repeat</label>
                <select id="agents-schedule-mode" class="agents-field">
                  <option value="interval">Every few minutes</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>

                <div class="agents-schedule-fields" data-mode="interval">
                  <label class="agents-label" for="agents-interval-minutes">Every</label>
                  <div class="agents-inline-fields">
                    <input id="agents-interval-minutes" class="agents-field agents-field--narrow" type="number" min="1" max="59" value="15" />
                    <span class="agents-inline-copy">minutes</span>
                  </div>
                </div>

                <div class="agents-schedule-fields" data-mode="hourly" hidden>
                  <label class="agents-label" for="agents-hourly-minute">At minute</label>
                  <input id="agents-hourly-minute" class="agents-field agents-field--narrow" type="number" min="0" max="59" value="0" />
                </div>

                <div class="agents-schedule-fields" data-mode="daily" hidden>
                  <label class="agents-label">At time</label>
                  <div class="agents-inline-fields agents-inline-fields--time">
                    <input id="agents-daily-hour" class="agents-field" type="number" min="0" max="23" value="9" />
                    <span class="agents-inline-copy">:</span>
                    <input id="agents-daily-minute" class="agents-field" type="number" min="0" max="59" value="0" />
                  </div>
                </div>

                <div class="agents-schedule-fields" data-mode="weekly" hidden>
                  <label class="agents-label" for="agents-weekly-day">Every</label>
                  <select id="agents-weekly-day" class="agents-field">
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                    <option value="0">Sunday</option>
                  </select>
                  <div class="agents-inline-fields agents-inline-fields--time" style="margin-top:10px">
                    <input id="agents-weekly-hour" class="agents-field" type="number" min="0" max="23" value="9" />
                    <span class="agents-inline-copy">:</span>
                    <input id="agents-weekly-minute" class="agents-field" type="number" min="0" max="59" value="0" />
                  </div>
                </div>

                <!-- Hidden: kept for JS compatibility, never surfaced to the user -->
                <input id="agents-custom-cron" type="hidden" value="" />
              </div>

              <!-- Human-readable preview -->
              <div class="agents-schedule-preview">
                <div class="agents-preview-line" id="agents-schedule-preview">On app startup</div>
              </div>
              <div id="agents-cron-preview" hidden></div>

            </div>
          </div>

          <!-- Model panel -->
          <div class="agents-modal-panel">
            <div class="agents-panel-title">Model</div>
            <div class="agents-field-grid">
              <div>
                <label class="agents-label" for="agents-primary-model">Primary model</label>
                <select id="agents-primary-model" class="agents-field"></select>
              </div>
              <div>
                <label class="agents-label" for="agents-fallback-model-1">
                  Fallback 1 <span class="agents-optional">(optional)</span>
                </label>
                <select id="agents-fallback-model-1" class="agents-field"></select>
              </div>
              <div>
                <label class="agents-label" for="agents-fallback-model-2">
                  Fallback 2 <span class="agents-optional">(optional)</span>
                </label>
                <select id="agents-fallback-model-2" class="agents-field"></select>
              </div>
            </div>
          </div>

        </div>

        <!-- Workspace panel — full width -->
        <div class="agents-modal-panel">
          <div class="agents-panel-title">
            Workspace <span class="agents-panel-optional">(optional)</span>
          </div>
          <div class="agents-field-grid">
            <div>
              <label class="agents-label" for="agents-workspace-select">Project workspace</label>
              <select id="agents-workspace-select" class="agents-field"></select>
            </div>
            <div class="agents-input-hint" id="agents-workspace-hint">By default the agent runs without a workspace. If you choose one, tool access is fenced to that project root.</div>
          </div>
        </div>

      </div>

      <div class="agents-modal-footer">
        <button id="agents-modal-cancel" class="agents-modal-cancel-btn" type="button">Cancel</button>
        <button id="agents-modal-save" class="agents-modal-save-btn" type="button">Save agent</button>
      </div>

    </div>
  </div>
</div>
`;
}
