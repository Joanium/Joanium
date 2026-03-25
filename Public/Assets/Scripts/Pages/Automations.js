import { escapeHtml, formatActionsSummary, formatLastRun, formatTrigger, generateId } from './Automations/Utils.js';
import { createActionRow, collectActionFromRow } from './Automations/ActionRenderer.js';

// ── HTML template ────────────────────────────────────────────────────────────
function getHTML() {
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
            <div><div class="trigger-option-text">⚡ On app startup</div><div class="trigger-option-sub">Runs every time Evelina is launched</div></div>
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

// ── mount ────────────────────────────────────────────────────────────────────
export function mount(outlet) {
  outlet.innerHTML = getHTML();

  // ── Local state ────────────────────────────────────────────────────────────
  const pageState = { automations: [] };
  let _editingId  = null;

  // ── DOM refs (looked up lazily inside functions) ───────────────────────────
  const $ = id => document.getElementById(id);

  // ── Grid rendering ─────────────────────────────────────────────────────────
  function renderAutomations() {
    const grid  = $('auto-grid');
    const empty = $('auto-empty');
    if (!pageState.automations.length) { empty.hidden = false; grid.hidden = true; return; }
    empty.hidden = true; grid.hidden = false; grid.innerHTML = '';

    pageState.automations.forEach(auto => {
      const card = document.createElement('div');
      card.className = `auto-card${auto.enabled ? '' : ' is-disabled'}`;
      card.dataset.id = escapeHtml(auto.id);
      card.innerHTML = `
        <div class="auto-card-head">
          <div class="auto-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z" stroke-linejoin="round" stroke-width="1.6"/></svg></div>
          <div class="auto-card-info">
            <div class="auto-card-name">${escapeHtml(auto.name)}</div>
            ${auto.description ? `<div class="auto-card-desc">${escapeHtml(auto.description)}</div>` : ''}
          </div>
          <label class="auto-toggle" title="${auto.enabled ? 'Enabled' : 'Disabled'}">
            <input type="checkbox" class="toggle-input" ${auto.enabled ? 'checked' : ''}><div class="auto-toggle-track"></div>
          </label>
        </div>
        <div class="auto-card-meta">
          <span class="auto-card-tag trigger-tag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" stroke-linecap="round"/></svg>
            ${escapeHtml(formatTrigger(auto.trigger))}
          </span>
          <div class="auto-card-actions-summary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 6h11M9 12h11M9 18h11M5 6v.01M5 12v.01M5 18v.01" stroke-linecap="round"/></svg>
            ${escapeHtml(formatActionsSummary(auto.actions))}
          </div>
          ${auto.lastRun ? `<div class="auto-card-lastrun">${escapeHtml(formatLastRun(auto.lastRun))}</div>` : ''}
        </div>
        <div class="auto-card-footer">
          <button class="auto-card-btn edit-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round"/></svg>
            Edit
          </button>
          <button class="auto-card-btn danger delete-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Delete
          </button>
        </div>`;

      card.querySelector('.toggle-input').addEventListener('change', async e => {
        auto.enabled = e.target.checked;
        card.classList.toggle('is-disabled', !auto.enabled);
        await window.electronAPI?.toggleAutomation?.(auto.id, auto.enabled);
      });
      card.querySelector('.edit-btn').addEventListener('click',   () => openModal(auto));
      card.querySelector('.delete-btn').addEventListener('click', () => openConfirm(auto.id, auto.name));
      grid.appendChild(card);
    });
  }

  async function loadAutomations() {
    try {
      const res = await window.electronAPI?.getAutomations?.();
      pageState.automations = Array.isArray(res?.automations) ? res.automations : [];
    } catch { pageState.automations = []; }
    renderAutomations();
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  function getSelectedTriggerType() {
    return [...document.querySelectorAll('.trigger-option')].find(o => o.classList.contains('selected'))?.dataset?.trigger ?? 'on_startup';
  }

  function updateSubInputVisibility() {
    const type = getSelectedTriggerType();
    $('interval-sub-inputs')?.classList.toggle('hidden', type !== 'interval');
    $('daily-sub-inputs')?.classList.toggle('hidden', type !== 'daily');
    $('weekly-sub-inputs')?.classList.toggle('hidden', type !== 'weekly');
  }

  function setTriggerOption(type) {
    document.querySelectorAll('.trigger-option').forEach(o => o.classList.toggle('selected', o.dataset.trigger === type));
    updateSubInputVisibility();
  }

  function openModal(auto = null) {
    _editingId = auto?.id ?? null;
    const titleEl = $('auto-modal-title-text');
    if (titleEl) titleEl.textContent = auto ? 'Edit Automation' : 'New Automation';
    const nameInput = $('auto-name');   if (nameInput) nameInput.value = auto?.name ?? '';
    const descInput = $('auto-desc');   if (descInput) descInput.value = auto?.description ?? '';
    setTriggerOption(auto?.trigger?.type ?? 'on_startup');
    const dt = $('daily-time');   if (dt) dt.value = auto?.trigger?.time ?? '09:00';
    const wt = $('weekly-time');  if (wt) wt.value = auto?.trigger?.time ?? '09:00';
    const wd = $('weekly-day');   if (wd) wd.value = auto?.trigger?.day  ?? 'monday';
    const im = $('interval-minutes'); if (im) im.value = auto?.trigger?.minutes ?? 30;
    const list = $('actions-list');
    if (list) {
      list.innerHTML = '';
      const acts = auto?.actions?.length ? auto.actions : [{ type: 'open_site' }];
      acts.forEach(a => list.appendChild(createActionRow(a)));
    }
    $('automation-modal-backdrop')?.classList.add('open');
    document.body.classList.add('modal-open');
    setTimeout(() => nameInput?.focus(), 60);
  }

  function closeModal() {
    $('automation-modal-backdrop')?.classList.remove('open');
    document.body.classList.remove('modal-open');
    _editingId = null;
  }

  // ── Confirm delete ────────────────────────────────────────────────────────
  let _deletingId = null;
  function openConfirm(id, name) {
    _deletingId = id;
    const el = $('confirm-automation-name'); if (el) el.textContent = name;
    $('confirm-overlay')?.classList.add('open');
  }
  function closeConfirm() {
    $('confirm-overlay')?.classList.remove('open');
    _deletingId = null;
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function saveModal() {
    const name = $('auto-name')?.value?.trim();
    if (!name) { $('auto-name')?.focus(); return; }

    const type = getSelectedTriggerType();
    const trigger = { type };
    if (type === 'interval') trigger.minutes = parseInt($('interval-minutes')?.value, 10) || 30;
    if (type === 'daily')    trigger.time    = $('daily-time')?.value || '09:00';
    if (type === 'weekly')   { trigger.time  = $('weekly-time')?.value || '09:00'; trigger.day = $('weekly-day')?.value || 'monday'; }

    const actions = [];
    document.querySelectorAll('#actions-list .action-row').forEach(row => {
      const a = collectActionFromRow(row); if (a) actions.push(a);
    });

    const data = { id: _editingId ?? generateId(), name, description: $('auto-desc')?.value?.trim() ?? '', enabled: true, trigger, actions, lastRun: null };
    const saveBtn = $('auto-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    try {
      const res = await window.electronAPI?.saveAutomation?.(data);
      if (res?.ok) {
        const idx = pageState.automations.findIndex(a => a.id === data.id);
        if (idx >= 0) pageState.automations[idx] = res.automation ?? data;
        else pageState.automations.push(res.automation ?? data);
        renderAutomations();
        closeModal();
      }
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Automation'; }
    }
  }

  // ── Event wiring ──────────────────────────────────────────────────────────
  $('add-automation-header-btn')?.addEventListener('click', () => openModal());
  $('add-automation-empty-btn')?.addEventListener('click', () => openModal());
  $('add-action-btn')?.addEventListener('click', () => {
    $('actions-list')?.appendChild(createActionRow({ type: 'open_site' }));
  });
  $('auto-save-btn')?.addEventListener('click', saveModal);
  $('auto-cancel-btn')?.addEventListener('click', closeModal);
  $('auto-modal-close')?.addEventListener('click', closeModal);
  $('automation-modal-backdrop')?.addEventListener('click', e => { if (e.target.id === 'automation-modal-backdrop') closeModal(); });

  document.querySelectorAll('.trigger-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.trigger-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      updateSubInputVisibility();
    });
  });

  $('confirm-cancel')?.addEventListener('click', closeConfirm);
  $('confirm-overlay')?.addEventListener('click', e => { if (e.target.id === 'confirm-overlay') closeConfirm(); });
  $('confirm-delete')?.addEventListener('click', async () => {
    if (!_deletingId) return;
    await window.electronAPI?.deleteAutomation?.(_deletingId);
    pageState.automations = pageState.automations.filter(a => a.id !== _deletingId);
    closeConfirm();
    renderAutomations();
  });

  const onKeydown = e => {
    if (e.key === 'Escape') { closeModal(); closeConfirm(); }
  };
  document.addEventListener('keydown', onKeydown);

  // ── Load data ─────────────────────────────────────────────────────────────
  loadAutomations();

  // ── Return cleanup ─────────────────────────────────────────────────────────
  return function unmount() {
    document.removeEventListener('keydown', onKeydown);
  };
}
