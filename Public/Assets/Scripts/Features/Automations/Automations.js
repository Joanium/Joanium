// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Automations.js
//  Renderer-side logic for the Automations page.
//  Now includes Gmail and GitHub action types.
// ─────────────────────────────────────────────

/* ══════════════════════════════════════════
   THEME
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
    o.classList.toggle('active', o.dataset.theme === theme),
  );
}

const styleEl = document.createElement('style');
styleEl.textContent = '@keyframes themeFlash { 0%{opacity:.3} 100%{opacity:0} }';
document.head.appendChild(styleEl);
applyTheme(localStorage.getItem('ow-theme') || 'dark', false);

const themeBtn   = document.getElementById('theme-toggle-btn');
const themePanel = document.getElementById('theme-panel');
themeBtn?.addEventListener('click', e => { e.stopPropagation(); themePanel?.classList.toggle('open'); });
document.querySelectorAll('.theme-option').forEach(opt => {
  opt.addEventListener('click', () => { applyTheme(opt.dataset.theme); themePanel?.classList.remove('open'); });
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
    if (view === 'chat' || view === 'library') window.electronAPI?.launchMain();
  });
});

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

(async () => {
  try {
    const user = await window.electronAPI?.getUser?.();
    const name  = String(user?.name ?? '').trim() || 'User';
    const parts = name.split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
    const avatarBtn2 = document.getElementById('sidebar-avatar-btn');
    if (avatarBtn2) { avatarBtn2.textContent = initials; avatarBtn2.title = name; }
    const badge     = document.getElementById('avatar-panel-badge');
    const panelName = document.getElementById('avatar-panel-name');
    if (badge)     badge.textContent    = initials;
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
      case 'open_site':            return 'open site';
      case 'open_folder':          return 'open folder' + (a.openTerminal ? ' + terminal' : '');
      case 'run_command':          return 'run command';
      case 'open_app':             return 'open app';
      case 'send_notification':    return 'notification';
      case 'copy_to_clipboard':    return 'copy to clipboard';
      case 'write_file':           return 'write file';
      // Gmail
      case 'gmail_send_email':     return '📧 send email';
      case 'gmail_get_brief':      return '📧 email brief';
      // GitHub
      case 'github_open_repo':     return '🐙 open repo';
      case 'github_check_prs':     return '🐙 check PRs';
      case 'github_check_issues':  return '🐙 check issues';
      case 'github_check_notifs':  return '🐙 notifications';
      default:                     return a.type;
    }
  }))];
  return `${label}: ${types.join(', ')}`;
}

function formatLastRun(lastRun) {
  if (!lastRun) return '';
  const d    = new Date(lastRun);
  const now  = new Date();
  const diff = now - d;
  const min  = 60_000, hour = 3_600_000, day = 86_400_000;
  if (diff < min)  return 'Last run: just now';
  if (diff < hour) return `Last run: ${Math.floor(diff / min)}m ago`;
  if (diff < day)  return `Last run: ${Math.floor(diff / hour)}h ago`;
  return `Last run: ${d.toLocaleDateString()}`;
}

/* ══════════════════════════════════════════
   ACTION META
   Defines every action type the UI can build.
══════════════════════════════════════════ */
const ACTION_META = {
  /* ── System ── */
  open_site:           { label: '🌐 Open website',            fields: ['url'],                  group: 'System'  },
  open_folder:         { label: '📁 Open folder',              fields: ['path'],  hasSub: true,  group: 'System'  },
  run_command:         { label: '⚡ Run command',               fields: ['command'],              group: 'System'  },
  open_app:            { label: '🚀 Open app',                  fields: ['appPath'],              group: 'System'  },
  send_notification:   { label: '🔔 Send notification',        fields: ['title', 'body'],        group: 'System'  },
  copy_to_clipboard:   { label: '📋 Copy to clipboard',        fields: ['text'],                 group: 'System'  },
  write_file:          { label: '📝 Write to file',             fields: ['filePath', 'content'], group: 'System'  },
  /* ── Gmail ── */
  gmail_send_email:    { label: '📧 Gmail — Send email',       fields: ['to', 'subject', 'gmailBody'],  group: 'Gmail'   },
  gmail_get_brief:     { label: '📧 Gmail — Email brief notif',fields: ['maxResults'],           group: 'Gmail'   },
  /* ── GitHub ── */
  github_open_repo:    { label: '🐙 GitHub — Open repo',       fields: ['owner', 'repo'],        group: 'GitHub'  },
  github_check_prs:    { label: '🐙 GitHub — Check PRs',       fields: ['owner', 'repo'],        group: 'GitHub'  },
  github_check_issues: { label: '🐙 GitHub — Check issues',    fields: ['owner', 'repo'],        group: 'GitHub'  },
  github_check_notifs: { label: '🐙 GitHub — Notifications',   fields: [],                       group: 'GitHub'  },
};

const FIELD_META = {
  url:        { placeholder: 'https://example.com',                       textarea: false },
  path:       { placeholder: '/Users/you/Documents or C:\\Users\\you',    textarea: false },
  command:    { placeholder: 'npm run build',                             textarea: false },
  appPath:    { placeholder: '/Applications/VS Code.app',                 textarea: false },
  title:      { placeholder: 'Notification title',                        textarea: false },
  body:       { placeholder: 'Notification body (optional)',              textarea: false },
  text:       { placeholder: 'Text to copy to clipboard…',               textarea: false },
  filePath:   { placeholder: '/Users/you/Desktop/output.txt',            textarea: false },
  content:    { placeholder: 'File content…',                            textarea: true  },
  terminalCommand: { placeholder: 'npm run dev  (leave empty to just open terminal)', textarea: false },
  // Gmail
  to:         { placeholder: 'recipient@gmail.com',                       textarea: false },
  subject:    { placeholder: 'Email subject',                             textarea: false },
  gmailBody:  { placeholder: 'Email body…',                              textarea: true  },
  maxResults: { placeholder: '10',                                        textarea: false },
  // GitHub
  owner:      { placeholder: 'github-username or org',                   textarea: false },
  repo:       { placeholder: 'repository-name',                          textarea: false },
};

const FIELD_LABELS = {
  url: 'URL', path: 'Folder path', command: 'Command', appPath: 'App path',
  title: 'Title', body: 'Body', text: 'Text', filePath: 'File path', content: 'Content',
  to: 'To (email)', subject: 'Subject', gmailBody: 'Body', maxResults: 'Max results',
  owner: 'Owner / org', repo: 'Repository',
};

function makeField(fieldKey, value = '') {
  const meta = FIELD_META[fieldKey] ?? { placeholder: '', textarea: false };
  let el;
  if (meta.textarea) {
    el = document.createElement('textarea');
    el.className = 'action-value-textarea';
    el.rows = 3;
  } else {
    el = document.createElement('input');
    el.type = 'text';
    el.className = 'action-value-input';
  }
  el.placeholder = meta.placeholder;
  el.value = value;
  el.dataset.field = fieldKey;
  return el;
}

function renderActionFields(fieldsEl, type, data = {}) {
  fieldsEl.innerHTML = '';
  const meta = ACTION_META[type];
  if (!meta) return;

  // Show connector-required warning
  if (meta.group === 'Gmail' || meta.group === 'GitHub') {
    const warn      = document.createElement('div');
    warn.className  = 'action-connector-note';
    warn.textContent =
      meta.group === 'Gmail'
        ? '⚠ Requires Gmail connected in Settings → Connectors'
        : '⚠ Requires GitHub connected in Settings → Connectors';
    fieldsEl.appendChild(warn);
  }

  for (const fieldKey of meta.fields) {
    const wrapper = document.createElement('div');
    wrapper.className = 'action-field-row';
    if (meta.fields.length > 1 || meta.group !== 'System') {
      const lbl       = document.createElement('label');
      lbl.className   = 'action-field-label';
      lbl.textContent = FIELD_LABELS[fieldKey] ?? fieldKey;
      wrapper.appendChild(lbl);
    }
    wrapper.appendChild(makeField(fieldKey, data[fieldKey] ?? ''));
    fieldsEl.appendChild(wrapper);
  }

  // Sub-event: open_folder → open terminal
  if (type === 'open_folder') {
    const sub = document.createElement('div');
    sub.className = 'action-sub-event';
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'action-sub-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'action-sub-check';
    if (data.openTerminal) checkbox.checked = true;
    const toggleText = document.createElement('span');
    toggleText.className = 'action-sub-toggle-text';
    toggleText.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M7 8l3 3-3 3M12 14h5" stroke-linecap="round" stroke-linejoin="round"/></svg>Open terminal here`;
    toggleLabel.append(checkbox, toggleText);
    const cmdWrapper = document.createElement('div');
    cmdWrapper.className = 'action-sub-cmd-wrap';
    if (!data.openTerminal) cmdWrapper.classList.add('hidden');
    const cmdLbl = document.createElement('label');
    cmdLbl.className = 'action-field-label';
    cmdLbl.textContent = 'Then run (optional)';
    cmdWrapper.appendChild(cmdLbl);
    cmdWrapper.appendChild(makeField('terminalCommand', data.terminalCommand ?? ''));
    checkbox.addEventListener('change', () => cmdWrapper.classList.toggle('hidden', !checkbox.checked));
    sub.append(toggleLabel, cmdWrapper);
    fieldsEl.appendChild(sub);
  }
}

function createActionRow(action = { type: 'open_site' }) {
  const row    = document.createElement('div');
  row.className = 'action-row';

  const topBar = document.createElement('div');
  topBar.className = 'action-row-top';

  const typeSelect = document.createElement('select');
  typeSelect.className = 'action-type-select';

  // Group options by group
  const groups = {};
  for (const [value, meta] of Object.entries(ACTION_META)) {
    if (!groups[meta.group]) groups[meta.group] = [];
    groups[meta.group].push({ value, label: meta.label });
  }

  for (const [groupName, items] of Object.entries(groups)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = groupName;
    for (const { value, label } of items) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (value === action.type) opt.selected = true;
      optgroup.appendChild(opt);
    }
    typeSelect.appendChild(optgroup);
  }

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'action-remove-btn';
  removeBtn.title = 'Remove action';
  removeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>`;
  removeBtn.addEventListener('click', () => row.remove());
  topBar.append(typeSelect, removeBtn);

  const fieldsArea = document.createElement('div');
  fieldsArea.className = 'action-fields';
  renderActionFields(fieldsArea, action.type, action);
  typeSelect.addEventListener('change', () => renderActionFields(fieldsArea, typeSelect.value, {}));

  row.append(topBar, fieldsArea);
  return row;
}

function collectActionFromRow(row) {
  const type = row.querySelector('.action-type-select')?.value;
  if (!type) return null;
  const get = (field) => row.querySelector(`[data-field="${field}"]`)?.value?.trim() ?? '';
  const action = { type };

  switch (type) {
    case 'open_site':           action.url     = get('url');     if (!action.url)     return null; break;
    case 'open_folder': {
      action.path = get('path'); if (!action.path) return null;
      const cb = row.querySelector('.action-sub-check');
      action.openTerminal    = cb?.checked ?? false;
      action.terminalCommand = get('terminalCommand');
      break;
    }
    case 'run_command':         action.command  = get('command');  if (!action.command)  return null; break;
    case 'open_app':            action.appPath  = get('appPath');  if (!action.appPath)  return null; break;
    case 'send_notification':   action.title    = get('title');    if (!action.title)    return null; action.body = get('body'); break;
    case 'copy_to_clipboard':   action.text     = get('text');     if (!action.text)     return null; break;
    case 'write_file':          action.filePath = get('filePath'); if (!action.filePath) return null; action.content = row.querySelector('[data-field="content"]')?.value ?? ''; break;
    // Gmail
    case 'gmail_send_email':    action.to = get('to'); action.subject = get('subject'); action.body = row.querySelector('[data-field="gmailBody"]')?.value ?? ''; if (!action.to || !action.subject) return null; break;
    case 'gmail_get_brief':     action.maxResults = parseInt(get('maxResults'), 10) || 10; break;
    // GitHub
    case 'github_open_repo':    action.owner = get('owner'); action.repo = get('repo'); if (!action.owner || !action.repo) return null; break;
    case 'github_check_prs':    action.owner = get('owner'); action.repo = get('repo'); if (!action.owner || !action.repo) return null; break;
    case 'github_check_issues': action.owner = get('owner'); action.repo = get('repo'); if (!action.owner || !action.repo) return null; break;
    case 'github_check_notifs': break;
    default: return null;
  }
  return action;
}

/* ══════════════════════════════════════════
   AUTOMATIONS STATE + RENDER
══════════════════════════════════════════ */
let automations = [];

const grid      = document.getElementById('auto-grid');
const emptyView = document.getElementById('auto-empty');

function renderAutomations() {
  if (!automations.length) { emptyView.hidden = false; grid.hidden = true; return; }
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
        <button class="auto-card-btn edit-btn" data-id="${escapeHtml(auto.id)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round"/></svg>
          Edit
        </button>
        <button class="auto-card-btn danger delete-btn" data-id="${escapeHtml(auto.id)}" data-name="${escapeHtml(auto.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Delete
        </button>
      </div>`;

    card.querySelector('.toggle-input').addEventListener('change', async e => {
      const enabled = e.target.checked;
      await window.electronAPI?.toggleAutomation?.(auto.id, enabled);
      auto.enabled = enabled;
      card.classList.toggle('is-disabled', !enabled);
    });
    card.querySelector('.edit-btn').addEventListener('click', () => openModal(auto));
    card.querySelector('.delete-btn').addEventListener('click', () => openConfirm(auto.id, auto.name));

    grid.appendChild(card);
  });
}

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
const confirmOverlay        = document.getElementById('confirm-overlay');
const confirmCancelBtn      = document.getElementById('confirm-cancel');
const confirmDeleteBtn      = document.getElementById('confirm-delete');
const confirmAutomationName = document.getElementById('confirm-automation-name');
let pendingDeleteId = null;

function openConfirm(id, name) { pendingDeleteId = id; if (confirmAutomationName) confirmAutomationName.textContent = name; confirmOverlay?.classList.add('open'); }
function closeConfirm()        { confirmOverlay?.classList.remove('open'); pendingDeleteId = null; }

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
const triggerOptions  = document.querySelectorAll('.trigger-option');
const dailyTimeInput  = document.getElementById('daily-time');
const weeklyTimeInput = document.getElementById('weekly-time');
const weeklyDaySelect = document.getElementById('weekly-day');
const dailySubInputs  = document.getElementById('daily-sub-inputs');
const weeklySubInputs = document.getElementById('weekly-sub-inputs');

let editingId = null;

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
  triggerOptions.forEach(o => o.classList.toggle('selected', o.dataset.trigger === type));
  updateSubInputVisibility();
}

addActionBtn?.addEventListener('click', () => {
  actionsList?.appendChild(createActionRow({ type: 'open_site' }));
});

function collectFormData() {
  const name = nameInput?.value?.trim();
  if (!name) return null;
  const type = getSelectedTriggerType();
  const trigger = { type };
  if (type === 'daily')  trigger.time = dailyTimeInput?.value  || '09:00';
  if (type === 'weekly') { trigger.time = weeklyTimeInput?.value || '09:00'; trigger.day = weeklyDaySelect?.value || 'monday'; }
  const actions = [];
  actionsList?.querySelectorAll('.action-row').forEach(row => { const a = collectActionFromRow(row); if (a) actions.push(a); });
  return { id: editingId ?? generateId(), name, description: descInput?.value?.trim() || '', enabled: true, trigger, actions, lastRun: null };
}

function openModal(automation = null) {
  editingId = automation?.id ?? null;
  if (modalTitle) modalTitle.textContent = automation ? 'Edit Automation' : 'New Automation';
  if (nameInput) nameInput.value = automation?.name || '';
  if (descInput) descInput.value = automation?.description || '';
  setTriggerOption(automation?.trigger?.type || 'on_startup');
  if (dailyTimeInput)  dailyTimeInput.value  = automation?.trigger?.time || '09:00';
  if (weeklyTimeInput) weeklyTimeInput.value = automation?.trigger?.time || '09:00';
  if (weeklyDaySelect) weeklyDaySelect.value = automation?.trigger?.day  || 'monday';
  if (actionsList) {
    actionsList.innerHTML = '';
    const acts = automation?.actions?.length ? automation.actions : [{ type: 'open_site' }];
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

saveBtn?.addEventListener('click', async () => {
  const data = collectFormData();
  if (!data) { nameInput?.focus(); nameInput?.animate([{ borderColor: '#f87171' }, { borderColor: 'var(--border)' }], { duration: 1000 }); return; }
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
  try {
    const res = await window.electronAPI?.saveAutomation?.(data);
    if (res?.ok) {
      const idx = automations.findIndex(a => a.id === data.id);
      if (idx >= 0) automations[idx] = res.automation ?? data;
      else          automations.push(res.automation ?? data);
      renderAutomations();
      closeModal();
    } else { console.error('[Automations] Save failed:', res?.error); }
  } finally { saveBtn.disabled = false; saveBtn.textContent = 'Save Automation'; }
});

cancelBtn?.addEventListener('click',    closeModal);
modalCloseBtn?.addEventListener('click', closeModal);
modalBackdrop?.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeConfirm(); } });

document.getElementById('add-automation-header-btn')?.addEventListener('click', () => openModal());
document.getElementById('add-automation-empty-btn')?.addEventListener('click',  () => openModal());
document.getElementById('avatar-settings-btn')?.addEventListener('click', () => window.electronAPI?.launchMain?.());

loadAutomations();
