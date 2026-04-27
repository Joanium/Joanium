import { getTemplatesHTML } from './Templates/TemplatesTemplate.js';
import { openConfirm } from '../../../../System/ConfirmDialog.js';
import { t } from '../../../../System/I18n/index.js';

// ── Built-in IDs that cannot be used as trigger names ─────────────────────
const BUILT_IN_IDS = new Set([
  'new',
  'private',
  'settings',
  'help',
  'close',
  'restart',
  'skills',
  'personas',
  'marketplace',
  'usage',
  'events',
  'chat',
  'library',
  'projects',
  'templates',
  'automations',
  'agents',
  'setup',
]);

// ── Module-level state ─────────────────────────────────────────────────────
let _allTemplates = [];
let _editingId = null; // null = create mode, string = edit mode

// DOM refs
let searchWrapper = null;
let searchInput = null;
let searchClearBtn = null;
let countEl = null;
let grid = null;
let emptyEl = null;
let addBtn = null;
let createFirstBtn = null;
let modalBackdrop = null;
let modalEyebrow = null;
let modalClose = null;
let triggerInput = null;
let triggerHint = null;
let labelInput = null;
let descInput = null;
let promptInput = null;
let cancelBtn = null;
let saveBtn = null;

// ── Helpers ────────────────────────────────────────────────────────────────

function sanitizeId(raw) {
  return raw
    .replace(/^\//, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

function formatRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Validation ─────────────────────────────────────────────────────────────

function validateTrigger(raw, editingId = null) {
  const id = sanitizeId(raw);
  if (!id || id.length < 2) return { ok: false, message: t('templates.triggerTooShort') };
  if (BUILT_IN_IDS.has(id)) return { ok: false, message: t('templates.conflictBuiltIn') };
  const exists = _allTemplates.some((tpl) => tpl.id === id && tpl.id !== editingId);
  if (exists) return { ok: false, message: t('templates.conflictExists') };
  return { ok: true, message: `Available — /${id}` };
}

// ── Render ─────────────────────────────────────────────────────────────────

function render(query = '') {
  const total = _allTemplates.length;

  if (countEl) {
    countEl.textContent =
      total === 1
        ? t('templates.templateCount', { count: total })
        : t('templates.templatesCount', { count: total });
  }

  if (!grid) return;

  if (total === 0) {
    grid.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
    if (searchWrapper) searchWrapper.hidden = true;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  if (searchWrapper) searchWrapper.hidden = false;

  const filtered = query
    ? _allTemplates.filter((tpl) =>
        [tpl.trigger, tpl.label, tpl.description]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : [..._allTemplates];

  grid.hidden = false;
  grid.innerHTML = '';

  // No-match state
  if (filtered.length === 0) {
    const nm = document.createElement('div');
    nm.className = 'templates-no-results';
    nm.textContent = t('templates.noMatch', { query });
    grid.appendChild(nm);
    return;
  }

  for (const tpl of filtered) {
    grid.appendChild(buildCard(tpl));
  }
}

function buildCard(tpl) {
  const card = document.createElement('div');
  card.className = 'templates-card';
  card.dataset.id = tpl.id;

  const promptPreview = tpl.description || ''; // description is in index
  const timeLabel = tpl.updatedAt
    ? `Updated ${formatRelative(tpl.updatedAt)}`
    : tpl.createdAt
      ? `Created ${formatRelative(tpl.createdAt)}`
      : '';

  card.innerHTML = /* html */ `
    <div class="templates-card-trigger">${tpl.trigger}</div>
    <div class="templates-card-label">${escapeHtml(tpl.label || tpl.id)}</div>
    ${tpl.description ? `<div class="templates-card-desc">${escapeHtml(tpl.description)}</div>` : ''}
    <div class="templates-card-meta">${escapeHtml(timeLabel)}</div>
    <div class="templates-card-actions">
      <button class="templates-card-btn templates-card-edit-btn" data-id="${tpl.id}" title="Edit template">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Edit
      </button>
      <button class="templates-card-btn templates-card-delete-btn" data-id="${tpl.id}" title="Delete template">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
        Delete
      </button>
    </div>
  `;

  card
    .querySelector('.templates-card-edit-btn')
    .addEventListener('click', () => openEditModal(tpl));
  card
    .querySelector('.templates-card-delete-btn')
    .addEventListener('click', () => handleDelete(tpl));

  return card;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Modal ──────────────────────────────────────────────────────────────────

function openCreateModal() {
  _editingId = null;
  if (modalEyebrow) modalEyebrow.textContent = 'New Template';
  if (saveBtn) saveBtn.textContent = t('templates.saveTemplate');
  clearModal();
  showModal();
}

function openEditModal(tpl) {
  _editingId = tpl.id;
  if (modalEyebrow) modalEyebrow.textContent = t('templates.editTemplate');
  if (saveBtn) saveBtn.textContent = t('templates.saveTemplate');

  // Fill basic fields from index entry first
  if (triggerInput) triggerInput.value = tpl.id; // shown without leading /
  if (labelInput) labelInput.value = tpl.label || '';
  if (descInput) descInput.value = tpl.description || '';
  if (promptInput) promptInput.value = '';

  // Load full prompt from IPC (wrapRead returns raw object)
  window.electronAPI?.invoke?.('get-template', tpl.id).then((full) => {
    if (promptInput && full?.prompt) promptInput.value = full.prompt;
  });

  // Validate hint for pre-filled trigger
  updateTriggerHint(tpl.id);
  showModal();
}

function clearModal() {
  if (triggerInput) triggerInput.value = '';
  if (labelInput) labelInput.value = '';
  if (descInput) descInput.value = '';
  if (promptInput) promptInput.value = '';
  if (triggerHint) {
    triggerHint.textContent = '';
    triggerHint.className = 'templates-trigger-hint';
  }
}

function showModal() {
  if (!modalBackdrop) return;
  modalBackdrop.classList.add('open');
  document.body.classList.add('modal-open');
  triggerInput?.focus();
}

function closeModal() {
  if (!modalBackdrop) return;
  modalBackdrop.classList.remove('open');
  document.body.classList.remove('modal-open');
  _editingId = null;
}

function updateTriggerHint(raw) {
  if (!triggerHint) return;
  if (!raw) {
    triggerHint.textContent = '';
    triggerHint.className = 'templates-trigger-hint';
    return;
  }
  const result = validateTrigger(raw, _editingId);
  triggerHint.textContent = result.message;
  triggerHint.className = `templates-trigger-hint ${result.ok ? 'templates-trigger-hint--ok' : 'templates-trigger-hint--err'}`;
}

async function handleSave() {
  const rawTrigger = (triggerInput?.value || '').trim();
  const label = (labelInput?.value || '').trim();
  const description = (descInput?.value || '').trim();
  const prompt = (promptInput?.value || '').trim();

  const validation = validateTrigger(rawTrigger, _editingId);
  if (!validation.ok) {
    updateTriggerHint(rawTrigger);
    triggerInput?.focus();
    return;
  }
  if (!label) {
    labelInput?.focus();
    return;
  }
  if (!prompt) {
    promptInput?.focus();
    return;
  }

  if (saveBtn) saveBtn.textContent = t('templates.saving');

  try {
    let result;
    if (_editingId) {
      result = await window.electronAPI?.invoke?.('update-template', {
        id: _editingId,
        label,
        description,
        prompt,
      });
    } else {
      result = await window.electronAPI?.invoke?.('create-template', {
        trigger: rawTrigger,
        label,
        description,
        prompt,
      });
    }

    if (!result?.ok) throw new Error(result?.error || 'Unknown error');

    // Refresh list — wrapRead returns raw array
    const updated = await window.electronAPI?.invoke?.('get-templates');
    _allTemplates = Array.isArray(updated) ? updated : [];
    closeModal();
    render(searchInput?.value?.trim() ?? '');

    // Notify slash commands
    window.dispatchEvent(new Event('jo:templates-changed'));
  } catch (err) {
    console.error('[Templates] Save error:', err);
    updateTriggerHint(rawTrigger);
    if (triggerHint) triggerHint.textContent = err.message;
    if (triggerHint) triggerHint.className = 'templates-trigger-hint templates-trigger-hint--err';
  } finally {
    if (saveBtn) saveBtn.textContent = t('templates.saveTemplate');
  }
}

async function handleDelete(tpl) {
  const confirmed = await openConfirm({
    title: t('templates.deleteTitle', { name: tpl.label || tpl.trigger }),
    body: t('templates.deleteBody'),
    confirmText: t('templates.delete'),
    variant: 'danger',
  });
  if (!confirmed) return;

  try {
    const result = await window.electronAPI?.invoke?.('delete-template', tpl.id);
    if (!result?.ok) throw new Error(result?.error || 'Delete failed');
    _allTemplates = _allTemplates.filter((t) => t.id !== tpl.id);
    render(searchInput?.value?.trim() ?? '');
    window.dispatchEvent(new Event('jo:templates-changed'));
  } catch (err) {
    console.error('[Templates] Delete error:', err);
  }
}

// ── Mount / unmount ────────────────────────────────────────────────────────

export function mount(outlet, { navigate: _navigate }) {
  outlet.innerHTML = getTemplatesHTML();

  // Move modal to <body> for full-viewport z-index coverage
  const backdropEl = document.getElementById('templates-modal-backdrop');
  if (backdropEl) document.body.appendChild(backdropEl);

  // Cache DOM refs
  searchWrapper = document.getElementById('templates-search-wrapper');
  searchInput = document.getElementById('templates-search');
  searchClearBtn = document.getElementById('templates-search-clear');
  countEl = document.getElementById('templates-count');
  grid = document.getElementById('templates-grid');
  emptyEl = document.getElementById('templates-empty');
  addBtn = document.getElementById('templates-add-btn');
  createFirstBtn = document.getElementById('templates-create-first');
  modalBackdrop = document.getElementById('templates-modal-backdrop');
  modalEyebrow = document.getElementById('templates-modal-eyebrow');
  modalClose = document.getElementById('templates-modal-close');
  triggerInput = document.getElementById('templates-trigger-input');
  triggerHint = document.getElementById('templates-trigger-hint');
  labelInput = document.getElementById('templates-label-input');
  descInput = document.getElementById('templates-desc-input');
  promptInput = document.getElementById('templates-prompt-input');
  cancelBtn = document.getElementById('templates-modal-cancel');
  saveBtn = document.getElementById('templates-modal-save');

  // ── Event listeners ──────────────────────────────────────────────────────

  const onSearchInput = () => {
    render(searchInput?.value.trim() ?? '');
    searchClearBtn?.classList.toggle('visible', (searchInput?.value.length ?? 0) > 0);
  };

  const onSearchClear = () => {
    if (searchInput) searchInput.value = '';
    searchClearBtn?.classList.remove('visible');
    render('');
    searchInput?.focus();
  };

  const onTriggerInput = () => updateTriggerHint(triggerInput?.value?.trim() ?? '');

  const onModalBackdropClick = (e) => {
    if (e.target === modalBackdrop) closeModal();
  };

  const onKeydown = (e) => {
    if (e.key === 'Escape') closeModal();
  };

  const onSave = () => handleSave();

  searchInput?.addEventListener('input', onSearchInput);
  searchClearBtn?.addEventListener('click', onSearchClear);
  addBtn?.addEventListener('click', openCreateModal);
  createFirstBtn?.addEventListener('click', openCreateModal);
  modalClose?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  saveBtn?.addEventListener('click', onSave);
  triggerInput?.addEventListener('input', onTriggerInput);
  modalBackdrop?.addEventListener('click', onModalBackdropClick);
  document.addEventListener('keydown', onKeydown);

  // ── Initial load ─────────────────────────────────────────────────────────
  (async () => {
    try {
      // get-templates uses wrapRead — returns raw array directly
      const result = await window.electronAPI?.invoke?.('get-templates');
      _allTemplates = Array.isArray(result) ? result : [];
    } catch (err) {
      console.error('[Templates] Load error:', err);
      _allTemplates = [];
    }
    render('');
  })();

  // ── Cleanup ───────────────────────────────────────────────────────────────
  return function unmount() {
    closeModal();
    backdropEl?.remove();

    searchInput?.removeEventListener('input', onSearchInput);
    searchClearBtn?.removeEventListener('click', onSearchClear);
    addBtn?.removeEventListener('click', openCreateModal);
    createFirstBtn?.removeEventListener('click', openCreateModal);
    modalClose?.removeEventListener('click', closeModal);
    cancelBtn?.removeEventListener('click', closeModal);
    saveBtn?.removeEventListener('click', onSave);
    triggerInput?.removeEventListener('input', onTriggerInput);
    modalBackdrop?.removeEventListener('click', onModalBackdropClick);
    document.removeEventListener('keydown', onKeydown);

    // Null out all refs
    searchWrapper = null;
    searchInput = null;
    searchClearBtn = null;
    countEl = null;
    grid = null;
    emptyEl = null;
    addBtn = null;
    createFirstBtn = null;
    modalBackdrop = null;
    modalEyebrow = null;
    modalClose = null;
    triggerInput = null;
    triggerHint = null;
    labelInput = null;
    descInput = null;
    promptInput = null;
    cancelBtn = null;
    saveBtn = null;
    _allTemplates = [];
    _editingId = null;
  };
}
