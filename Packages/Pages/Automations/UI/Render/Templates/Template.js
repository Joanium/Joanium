export function getAutomationsHTML() {
  return /* html */`
<main id="main" class="automations-main">
  <div class="automations-scroll">

    <div class="auto-page-header">
      <div class="auto-page-header-copy">
        <h2>Automations</h2>
        <p>Schedule actions to run automatically</p>
      </div>
      <button class="add-automation-btn" id="add-automation-header-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        Add Automation
      </button>
    </div>

    <div id="auto-empty" class="auto-empty" hidden>
      <div class="auto-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z" stroke-linejoin="round"/></svg>
      </div>
      <h3>No automations yet</h3>
      <p>Create your first automation to start scheduling tasks.</p>
      <button class="auto-empty-btn" id="add-automation-empty-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:14px;height:14px"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        Create your first automation
      </button>
    </div>

    <div id="auto-grid" class="auto-grid" hidden></div>
  </div>
</main>

<!-- Automation modal -->
<div id="automation-modal-backdrop">
  <div id="automation-modal" role="dialog" aria-modal="true">
    <div class="auto-modal-header">
      <div class="auto-modal-title-group">
        <div class="auto-modal-eyebrow">Automation</div>
        <h2 id="auto-modal-title-text">New Automation</h2>
      </div>
      <button class="settings-modal-close" id="auto-modal-close" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>
      </button>
    </div>
    <div class="auto-modal-body">
      <div class="auto-field">
        <label class="auto-field-label" for="auto-name">Name <span class="field-required">*</span></label>
        <input class="auto-input" id="auto-name" type="text" placeholder="My automation" maxlength="80" autocomplete="off"/>
      </div>
      <div class="auto-field">
        <label class="auto-field-label" for="auto-desc">Description <span class="field-optional">optional</span></label>
        <textarea class="auto-textarea" id="auto-desc" placeholder="What does this automation do?" maxlength="300"></textarea>
      </div>
      <div class="auto-section">
        <div class="auto-section-label">Trigger</div>
        <div class="trigger-options">
          <div class="trigger-option selected" data-trigger="on_startup">
            <div class="trigger-radio"></div>
            <div><div class="trigger-option-text">⚡ On app startup</div><div class="trigger-option-sub">Runs every time Joanium is launched</div></div>
          </div>
          <div class="trigger-option" data-trigger="interval">
            <div class="trigger-radio"></div>
            <div style="flex:1">
              <div class="trigger-option-text">⏱️ Every N minutes</div>
              <div class="trigger-sub-inputs hidden" id="interval-sub-inputs">
                <span class="trigger-sub-label">every</span>
                <input type="number" class="trigger-time-input" id="interval-minutes" value="30" min="1" max="1440" style="width:64px"/>
                <span class="trigger-sub-label">min</span>
              </div>
            </div>
          </div>
          <div class="trigger-option" data-trigger="hourly">
            <div class="trigger-radio"></div>
            <div><div class="trigger-option-text">⏰ Every hour</div><div class="trigger-option-sub">Runs at the top of each hour</div></div>
          </div>
          <div class="trigger-option" data-trigger="daily">
            <div class="trigger-radio"></div>
            <div style="flex:1">
              <div class="trigger-option-text">🌅 Every day at a set time</div>
              <div class="trigger-sub-inputs hidden" id="daily-sub-inputs">
                <span class="trigger-sub-label">at</span>
                <input type="time" class="trigger-time-input" id="daily-time" value="09:00">
              </div>
            </div>
          </div>
          <div class="trigger-option" data-trigger="weekly">
            <div class="trigger-radio"></div>
            <div style="flex:1">
              <div class="trigger-option-text">📅 Every week on a specific day</div>
              <div class="trigger-sub-inputs hidden" id="weekly-sub-inputs">
                <select class="trigger-day-select" id="weekly-day">
                  <option value="monday">Monday</option><option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option><option value="thursday">Thursday</option>
                  <option value="friday">Friday</option><option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
                <span class="trigger-sub-label">at</span>
                <input type="time" class="trigger-time-input" id="weekly-time" value="09:00">
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="auto-section">
        <div class="auto-section-label">Actions</div>
        <div id="actions-list" class="actions-list"></div>
        <button class="add-action-btn" id="add-action-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
          Add another action
        </button>
      </div>
    </div>
    <div class="auto-modal-footer">
      <button class="auto-btn-cancel" id="auto-cancel-btn" type="button">Cancel</button>
      <button class="auto-btn-save" id="auto-save-btn" type="button">Save Automation</button>
    </div>
  </div>
</div>

<!-- Delete confirm -->
<div class="confirm-overlay" id="confirm-overlay">
  <div class="confirm-box">
    <div class="confirm-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <h3>Delete automation?</h3>
    <p>"<strong id="confirm-automation-name"></strong>" will be permanently deleted.</p>
    <div class="confirm-actions">
      <button class="confirm-cancel-btn" id="confirm-cancel">Cancel</button>
      <button class="confirm-delete-btn" id="confirm-delete">Delete</button>
    </div>
  </div>
</div>
`;
}
