export function getAgentsHTML() {
  return /* html */ `
<div class="agents-page">
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

    <div class="agents-toolbar">
      <div class="agents-search-wrapper" id="agents-search-wrapper" hidden>
        <svg class="agents-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
        </svg>
        <input id="agents-search" class="agents-search-input" type="text" placeholder="Search agents, slash commands, workspaces..." autocomplete="off" spellcheck="false" />
        <button id="agents-search-clear" class="agents-search-clear" type="button" aria-label="Clear search">×</button>
      </div>
      <div class="agents-stats" id="agents-stats">
        <div class="agents-stat"><span class="agents-stat-value" id="agents-total-count">0</span><span class="agents-stat-label">Total</span></div>
        <div class="agents-stat"><span class="agents-stat-value" id="agents-enabled-count">0</span><span class="agents-stat-label">Enabled</span></div>
        <div class="agents-stat"><span class="agents-stat-value" id="agents-scheduled-count">0</span><span class="agents-stat-label">Scheduled</span></div>
      </div>
    </div>

    <div class="agents-grid" id="agents-grid" hidden></div>

    <div class="agents-empty" id="agents-empty" hidden>
      <div class="shared-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" width="40" height="40">
          <rect x="4" y="4" width="16" height="16" rx="4"/>
          <path d="M9 9h6v6H9z"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke-linecap="round"/>
        </svg>
      </div>
      <h2>No agents yet</h2>
      <p>Start with one useful repeatable task and give it a simple schedule.</p>
      <button class="shared-empty-cta" id="agents-create-first" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:14px;height:14px"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        Create your first agent
      </button>
    </div>
  </div>

  <div class="agents-modal-backdrop" id="agents-modal-backdrop">
    <div class="agents-modal" role="dialog" aria-modal="true" aria-labelledby="agents-modal-eyebrow">
      <div class="agents-modal-header">
        <div>
          <div class="agents-modal-eyebrow" id="agents-modal-eyebrow">New Agent</div>
          <h2 class="agents-modal-title" id="agents-modal-title">Saved agent</h2>
        </div>
        <button id="agents-modal-close" class="agents-modal-close" type="button" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="agents-modal-status" id="agents-modal-status" hidden></div>

      <div class="agents-modal-body">
        <div class="agents-modal-topline">
          <div class="agents-avatar-preview">
            <img id="agents-avatar-preview" alt="Agent avatar preview" />
          </div>
          <div class="agents-topline-fields">
            <div>
              <label class="agents-label" for="agents-name-input">Agent name</label>
              <input id="agents-name-input" class="agents-field" type="text" placeholder="daily_standup" autocomplete="off" spellcheck="false" />
              <div class="agents-input-hint" id="agents-name-hint"></div>
            </div>
            <div>
              <label class="agents-label" for="agents-description-input">Description <span class="agents-optional">(optional)</span></label>
              <input id="agents-description-input" class="agents-field" type="text" placeholder="What this agent is for" autocomplete="off" />
            </div>
          </div>
        </div>

        <div>
          <label class="agents-label" for="agents-prompt-input">Prompt</label>
          <textarea id="agents-prompt-input" class="agents-field agents-textarea" rows="7" placeholder="Write the exact task this agent should do every time it runs."></textarea>
        </div>

        <div class="agents-modal-grid">
          <div class="agents-modal-panel">
            <div class="agents-panel-title">Schedule</div>
            <div class="agents-field-grid">
              <label class="agents-switch-row">
                <span>Enabled</span>
                <input id="agents-enabled-input" type="checkbox" checked />
              </label>
              <div>
                <label class="agents-label" for="agents-trigger-type">Run when</label>
                <select id="agents-trigger-type" class="agents-field">
                  <option value="on_startup">On app startup</option>
                  <option value="cron">On a schedule</option>
                </select>
              </div>
              <div id="agents-schedule-editor" hidden>
                <label class="agents-label" for="agents-schedule-mode">Repeat</label>
                <select id="agents-schedule-mode" class="agents-field">
                  <option value="interval">Every few minutes</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom cron</option>
                </select>

                <div class="agents-schedule-fields" data-mode="interval">
                  <label class="agents-label" for="agents-interval-minutes">Every</label>
                  <div class="agents-inline-fields">
                    <input id="agents-interval-minutes" class="agents-field" type="number" min="1" max="59" value="15" />
                    <span class="agents-inline-copy">minutes</span>
                  </div>
                </div>

                <div class="agents-schedule-fields" data-mode="hourly" hidden>
                  <label class="agents-label" for="agents-hourly-minute">At minute</label>
                  <input id="agents-hourly-minute" class="agents-field" type="number" min="0" max="59" value="0" />
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
                  <div class="agents-inline-fields agents-inline-fields--time">
                    <input id="agents-weekly-hour" class="agents-field" type="number" min="0" max="23" value="9" />
                    <span class="agents-inline-copy">:</span>
                    <input id="agents-weekly-minute" class="agents-field" type="number" min="0" max="59" value="0" />
                  </div>
                </div>

                <div class="agents-schedule-fields" data-mode="custom" hidden>
                  <label class="agents-label" for="agents-custom-cron">Cron expression</label>
                  <input id="agents-custom-cron" class="agents-field agents-field--mono" type="text" placeholder="0 9 * * 1-5" autocomplete="off" spellcheck="false" />
                  <div class="agents-input-hint">Five-part cron only: minute hour day month weekday</div>
                </div>
              </div>
              <div class="agents-schedule-preview">
                <div class="agents-preview-line" id="agents-schedule-preview">On app startup</div>
                <div class="agents-preview-subline" id="agents-cron-preview" hidden></div>
              </div>
            </div>
          </div>

          <div class="agents-modal-panel">
            <div class="agents-panel-title">Model</div>
            <div class="agents-field-grid">
              <div>
                <label class="agents-label" for="agents-primary-model">Primary model</label>
                <select id="agents-primary-model" class="agents-field"></select>
              </div>
              <div>
                <label class="agents-label" for="agents-fallback-model-1">Fallback model 1</label>
                <select id="agents-fallback-model-1" class="agents-field"></select>
              </div>
              <div>
                <label class="agents-label" for="agents-fallback-model-2">Fallback model 2</label>
                <select id="agents-fallback-model-2" class="agents-field"></select>
              </div>
            </div>
          </div>
        </div>

        <div class="agents-modal-panel">
          <div class="agents-panel-title">Workspace</div>
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
