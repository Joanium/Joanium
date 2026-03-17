// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Automations.js
//  Renderer-side logic for the Automations page.
// ─────────────────────────────────────────────

/* ══════════════════════════════════════════
   THEME (self-contained — no Root.js import)
══════════════════════════════════════════ */
const THEMES = ['dark', 'light', 'midnight', 'forest', 'pinky'];

function applyTheme(theme, animate = true) {
  if (!THEMES.includes(theme)) theme = 'dark';

  if (animate) {
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--accent-glow);pointer-events:none;animation:themeFlash .35s ease forwards;';
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
  }

  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ow-theme', theme);

  document.querySelectorAll('.theme-option').forEach(o =>
    o.classList.toggle('active', o.dataset.theme === theme)
  );
}

const styleEl = document.createElement('style');
styleEl.textContent = '@keyframes themeFlash { 0%{opacity:.3} 100%{opacity:0} }';
document.head.appendChild(styleEl);

applyTheme(localStorage.getItem('ow-theme') || 'dark', false);

/* ── Theme panel ── */
const themeBtn   = document.getElementById('theme-toggle-btn');
const themePanel = document.getElementById('theme-panel');

themeBtn?.addEventListener('click', e => {
  e.stopPropagation();
  themePanel?.classList.toggle('open');
});

document.querySelectorAll('.theme-option').forEach(opt => {
  opt.addEventListener('click', () => {
    applyTheme(opt.dataset.theme);
    themePanel?.classList.remove('open');
  });
});

/* ══════════════════════════════════════════
   WINDOW CONTROLS
══════════════════════════════════════════ */
document.getElementById('btn-minimize')?.addEventListener('click', () => window.electronAPI?.minimize());
document.getElementById('btn-maximize')?.addEventListener('click', () => window.electronAPI?.maximize());
document.getElementById('btn-close')?.addEventListener('click',    () => window.electronAPI?.close());

/* ══════════════════════════════════════════
   SIDEBAR NAVIGATION
══════════════════════════════════════════ */
document.querySelectorAll('.sidebar-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    if (view === 'chat' || view === 'library') {
      window.electronAPI?.launchMain();
    }
    // 'automations' = current page, do nothing
  });
});

/* ── Avatar ── */
const avatarBtn   = document.getElementById('sidebar-avatar-btn');
const avatarPanel = document.getElementById('avatar-panel');

avatarBtn?.addEventListener('click', e => {
  e.stopPropagation();
  avatarPanel?.classList.toggle('open');
  themePanel?.classList.remove('open');
});

document.addEventListener('click', e => {
  if (!avatarPanel?.contains(e.target) && e.target !== avatarBtn)
    avatarPanel?.classList.remove('open');
  if (!themePanel?.contains(e.target) && e.target !== themeBtn)
    themePanel?.classList.remove('open');
});

/* ── Load user name into avatar ── */
(async () => {
  try {
    const user = await window.electronAPI?.getUser?.();
    const name  = String(user?.name ?? '').trim() || 'User';
    const parts = name.split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();

    if (avatarBtn) { avatarBtn.textContent = initials; avatarBtn.title = name; }

    const badge = document.getElementById('avatar-panel-badge');
    const panelName = document.getElementById('avatar-panel-name');
    if (badge) badge.textContent = initials;
    if (panelName) panelName.textContent = name;
  } catch {/* ignore */}
})();

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateId() {
  return `auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatTrigger(trigger) {
  if (!trigger) return 'Unknown trigger';
  switch (trigger.type) {
    case 'on_startup': return '⚡ On app startup';
    case 'hourly':     return '⏰ Every hour';
    case 'daily':      return `🌅 Every day at ${trigger.time || '09:00'}`;
    case 'weekly':     return `📅 Every ${capitalize(trigger.day || 'monday')} at ${trigger.time || '09:00'}`;
    default:           return trigger.type;
  }
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

function formatActionsSummary(actions = []) {
  if (!actions.length) return 'No actions configured';
  const label = actions.length === 1 ? '1 action' : `${actions.length} actions`;
  const types = [...new Set(actions.map(a => {
    switch (a.type) {
      case 'open_site':    return 'open site';
      case 'open_folder':  return 'open folder';
      case 'run_command':  return 'run command';
      default:             return a.type;
    }
  }))];
  return `${label}: ${types.join(', ')}`;
}

function formatLastRun(lastRun) {
  if (!lastRun) return '';
  const d = new Date(lastRun);
  const now = new Date();
  const diff = now - d;
  const min  = 60_000;
  const hour = 3_600_000;
  const day  = 86_400_000;
  if (diff < min)  return 'Last run: just now';
  if (diff < hour) return `Last run: ${Math.floor(diff / min)}m ago`;
  if (diff < day)  return `Last run: ${Math.floor(diff / hour)}h ago`;
  return `Last run: ${d.toLocaleDateString()}`;
}

/* ══════════════════════════════════════════
   AUTOMATIONS STATE
══════════════════════════════════════════ */
let automations = [];

/* ══════════════════════════════════════════
   RENDER
══════════════════════════════════════════ */
const grid      = document.getElementById('auto-grid');
const emptyView = document.getElementById('auto-empty');

function renderAutomations() {
  if (!automations.length) {
    emptyView.hidden  = false;
    grid.hidden       = true;
    return;
  }
  emptyView.hidden = true;
  grid.hidden      = false;
  grid.innerHTML   = '';

  automations.forEach(auto => {
    const card = document.createElement('div');
    card.className = `auto-card${auto.enabled ? '' : ' is-disabled'}`;
    card.dataset.id = auto.id;

    card.innerHTML = `
      <div class="auto-card-head">
        <div class="auto-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z" stroke-linejoin="round" stroke-width="1.6"/>
          </svg>
        </div>
        <div class="auto-card-info">
          <div class="auto-card-name">${escapeHtml(auto.name)}</div>
          ${auto.description ? `<div class="auto-card-desc">${escapeHtml(auto.description)}</div>` : ''}
        </div>
        <label class="auto-toggle" title="${auto.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}">
          <input type="checkbox" class="toggle-input" ${auto.enabled ? 'checked' : ''}>
          <div class="auto-toggle-track"></div>
        </label>
      </div>

      <div class="auto-card-meta">
        <span class="auto-card-tag trigger-tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 7v5l3 3" stroke-linecap="round"/>
          </svg>
          ${escapeHtml(formatTrigger(auto.trigger))}
        </span>
        <div class="auto-card-actions-summary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M9 6h11M9 12h11M9 18h11M5 6v.01M5 12v.01M5 18v.01" stroke-linecap="round"/>
          </svg>
          ${escapeHtml(formatActionsSummary(auto.actions))}
        </div>
        ${auto.lastRun ? `<div class="auto-card-lastrun">${escapeHtml(formatLastRun(auto.lastRun))}</div>` : ''}
      </div>

      <div class="auto-card-footer">
        <button class="auto-card-btn edit-btn" data-id="${escapeHtml(auto.id)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round"/>
          </svg>
          Edit
        </button>
        <button class="auto-card-btn danger delete-btn" data-id="${escapeHtml(auto.id)}" data-name="${escapeHtml(auto.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Delete
        </button>
      </div>`;

    /* Toggle enabled */
    card.querySelector('.toggle-input').addEventListener('change', async e => {
      const enabled = e.target.checked;
      await window.electronAPI?.toggleAutomation?.(auto.id, enabled);
      auto.enabled = enabled;
      card.classList.toggle('is-disabled', !enabled);
    });

    /* Edit */
    card.querySelector('.edit-btn').addEventListener('click', () => openModal(auto));

    /* Delete */
    card.querySelector('.delete-btn').addEventListener('click', () => openConfirm(auto.id, auto.name));

    grid.appendChild(card);
  });
}

/* ══════════════════════════════════════════
   LOAD
══════════════════════════════════════════ */
async function loadAutomations() {
  try {
    const res = await window.electronAPI?.getAutomations?.();
    automations = Array.isArray(res?.automations) ? res.automations : [];
  } catch { automations = []; }
  renderAutomations();
}

/* ══════════════════════════════════════════
   CONFIRM DELETE
══════════════════════════════════════════ */
const confirmOverlay     = document.getElementById('confirm-overlay');
const confirmCancelBtn   = document.getElementById('confirm-cancel');
const confirmDeleteBtn   = document.getElementById('confirm-delete');
const confirmAutomationName = document.getElementById('confirm-automation-name');

let pendingDeleteId = null;

function openConfirm(id, name) {
  pendingDeleteId = id;
  if (confirmAutomationName) confirmAutomationName.textContent = name;
  confirmOverlay?.classList.add('open');
}

function closeConfirm() {
  confirmOverlay?.classList.remove('open');
  pendingDeleteId = null;
}

confirmCancelBtn?.addEventListener('click', closeConfirm);

confirmDeleteBtn?.addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  await window.electronAPI?.deleteAutomation?.(pendingDeleteId);
  automations = automations.filter(a => a.id !== pendingDeleteId);
  closeConfirm();
  renderAutomations();
});

confirmOverlay?.addEventListener('click', e => { if (e.target === confirmOverlay) closeConfirm(); });

/* ══════════════════════════════════════════
   MODAL — ADD / EDIT
══════════════════════════════════════════ */
const modalBackdrop  = document.getElementById('automation-modal-backdrop');
const modalTitle     = document.getElementById('auto-modal-title-text');
const nameInput      = document.getElementById('auto-name');
const descInput      = document.getElementById('auto-desc');
const actionsList    = document.getElementById('actions-list');
const addActionBtn   = document.getElementById('add-action-btn');
const saveBtn        = document.getElementById('auto-save-btn');
const cancelBtn      = document.getElementById('auto-cancel-btn');
const modalCloseBtn  = document.getElementById('auto-modal-close');

/* Trigger option elements */
const triggerOptions      = document.querySelectorAll('.trigger-option');
const dailyTimeInput      = document.getElementById('daily-time');
const weeklyTimeInput     = document.getElementById('weekly-time');
const weeklyDaySelect     = document.getElementById('weekly-day');
const dailySubInputs      = document.getElementById('daily-sub-inputs');
const weeklySubInputs     = document.getElementById('weekly-sub-inputs');

let editingId    = null;  // null = new, string = editing existing

/* ── Trigger radio logic ── */
function getSelectedTriggerType() {
  return [...triggerOptions].find(o => o.classList.contains('selected'))?.dataset?.trigger ?? 'on_startup';
}

triggerOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    triggerOptions.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    updateSubInputVisibility();
  });
});

function updateSubInputVisibility() {
  const type = getSelectedTriggerType();
  dailySubInputs?.classList.toggle('hidden',  type !== 'daily');
  weeklySubInputs?.classList.toggle('hidden', type !== 'weekly');
}

function setTriggerOption(type) {
  triggerOptions.forEach(o => {
    o.classList.toggle('selected', o.dataset.trigger === type);
  });
  updateSubInputVisibility();
}

/* ── Actions ── */
const ACTION_PLACEHOLDERS = {
  open_site:   'https://example.com',
  open_folder: '/Users/you/Documents',
  run_command: 'npm run build',
};

function createActionRow(action = { type: 'open_site', value: '' }) {
  const row = document.createElement('div');
  row.className = 'action-row';

  const typeSelect = document.createElement('select');
  typeSelect.className = 'action-type-select';
  typeSelect.innerHTML = `
    <option value="open_site"   ${action.type === 'open_site'   ? 'selected' : ''}>🌐 Open a website</option>
    <option value="open_folder" ${action.type === 'open_folder' ? 'selected' : ''}>📁 Open a folder</option>
    <option value="run_command" ${action.type === 'run_command' ? 'selected' : ''}>⚡ Run a command</option>`;

  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.className = 'action-value-input';
  valueInput.placeholder = ACTION_PLACEHOLDERS[action.type] || '';
  valueInput.value = action.value || action.url || action.path || action.command || '';

  typeSelect.addEventListener('change', () => {
    valueInput.placeholder = ACTION_PLACEHOLDERS[typeSelect.value] || '';
    valueInput.value = '';
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'action-remove-btn';
  removeBtn.title = 'Remove action';
  removeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
  </svg>`;
  removeBtn.addEventListener('click', () => row.remove());

  row.append(typeSelect, valueInput, removeBtn);
  return row;
}

addActionBtn?.addEventListener('click', () => {
  actionsList?.appendChild(createActionRow());
});

/* ── Collect form data ── */
function collectFormData() {
  const name = nameInput?.value?.trim();
  if (!name) return null;

  const type = getSelectedTriggerType();
  const trigger = { type };
  if (type === 'daily')  trigger.time = dailyTimeInput?.value  || '09:00';
  if (type === 'weekly') { trigger.time = weeklyTimeInput?.value || '09:00'; trigger.day = weeklyDaySelect?.value || 'monday'; }

  const actions = [];
  actionsList?.querySelectorAll('.action-row').forEach(row => {
    const t = row.querySelector('.action-type-select')?.value;
    const v = row.querySelector('.action-value-input')?.value?.trim();
    if (!t || !v) return;
    const a = { type: t };
    if (t === 'open_site')   a.url     = v;
    if (t === 'open_folder') a.path    = v;
    if (t === 'run_command') a.command = v;
    a.value = v; // convenience field for the UI
    actions.push(a);
  });

  return {
    id:          editingId ?? generateId(),
    name,
    description: descInput?.value?.trim() || '',
    enabled:     true,
    trigger,
    actions,
    createdAt:   editingId ? undefined : new Date().toISOString(),
    lastRun:     null,
  };
}

/* ── Open / close modal ── */
function openModal(automation = null) {
  editingId = automation?.id ?? null;

  if (modalTitle) modalTitle.textContent = automation ? 'Edit Automation' : 'New Automation';

  /* Reset form */
  if (nameInput) nameInput.value = automation?.name || '';
  if (descInput) descInput.value = automation?.description || '';

  /* Trigger */
  setTriggerOption(automation?.trigger?.type || 'on_startup');
  if (dailyTimeInput)  dailyTimeInput.value  = automation?.trigger?.time || '09:00';
  if (weeklyTimeInput) weeklyTimeInput.value = automation?.trigger?.time || '09:00';
  if (weeklyDaySelect) weeklyDaySelect.value = automation?.trigger?.day  || 'monday';

  /* Actions */
  if (actionsList) {
    actionsList.innerHTML = '';
    const acts = automation?.actions?.length ? automation.actions : [{ type: 'open_site', value: '' }];
    acts.forEach(a => actionsList.appendChild(createActionRow(a)));
  }

  modalBackdrop?.classList.add('open');
  document.body.classList.add('modal-open');
  setTimeout(() => nameInput?.focus(), 60);
}

function closeModal() {
  modalBackdrop?.classList.remove('open');
  document.body.classList.remove('modal-open');
  editingId = null;
}

/* ── Save ── */
saveBtn?.addEventListener('click', async () => {
  const data = collectFormData();
  if (!data) {
    nameInput?.focus();
    nameInput?.animate([{ borderColor: '#f87171' }, { borderColor: 'var(--border)' }], { duration: 1000 });
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const res = await window.electronAPI?.saveAutomation?.(data);
    if (res?.ok) {
      const idx = automations.findIndex(a => a.id === data.id);
      if (idx >= 0) automations[idx] = res.automation ?? data;
      else          automations.push(res.automation ?? data);
      renderAutomations();
      closeModal();
    } else {
      console.error('[Automations] Save failed:', res?.error);
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Automation';
  }
});

cancelBtn?.addEventListener('click',    closeModal);
modalCloseBtn?.addEventListener('click', closeModal);

modalBackdrop?.addEventListener('click', e => {
  if (e.target === modalBackdrop) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closeConfirm();
  }
});

/* ── Add automation buttons ── */
document.getElementById('add-automation-header-btn')
  ?.addEventListener('click', () => openModal());

document.getElementById('add-automation-empty-btn')
  ?.addEventListener('click', () => openModal());

/* ── Avatar settings → go to main page settings ── */
document.getElementById('avatar-settings-btn')
  ?.addEventListener('click', () => window.electronAPI?.launchMain?.());

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
loadAutomations();
