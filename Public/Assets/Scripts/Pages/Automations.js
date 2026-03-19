import '../Shared/WindowControls.js';
import { initSidebar } from '../Shared/Sidebar.js';
import { initAboutModal } from '../Shared/Modals/AboutModal.js';
import { initLibraryModal } from '../Shared/Modals/LibraryModal.js';
import { initSettingsModal } from '../Shared/Modals/SettingsModal.js';

import { state } from './Automations/State.js';
import { generateId } from './Automations/Utils.js';
import { createActionRow, collectActionFromRow } from './Automations/ActionRenderer.js';
import { initGrid, loadAutomations, renderAutomations } from './Automations/Grid.js';
import { openConfirm, closeConfirm } from './Automations/ConfirmDialog.js';

/* ══════════════════════════════════════════
   SHARED MODALS
══════════════════════════════════════════ */

const about = initAboutModal();
const settings = initSettingsModal();

const library = initLibraryModal({
  onChatSelect: chatId => {
    if (chatId) localStorage.setItem('ow-pending-chat', chatId);
    window.electronAPI?.launchMain();
  },
});

const sidebar = initSidebar({
  activePage: 'automations',
  onNewChat: () => window.electronAPI?.launchMain(),
  onLibrary: () => library.isOpen() ? library.close() : library.open(),
  onAutomations: () => { /* already here */ },
  onSkills: () => window.electronAPI?.launchSkills?.(),
  onPersonas: () => window.electronAPI?.launchPersonas?.(),
  onUsage: () => window.electronAPI?.launchUsage?.(),
  onSettings: () => settings.open(),
  onAbout: () => about.open(),
});

window.addEventListener('ow:user-profile-updated', e => sidebar.setUser(e.detail?.name ?? ''));
settings.loadUser().then(user => sidebar.setUser(user?.name ?? ''));

/* ══════════════════════════════════════════
   MODAL — DOM REFS
══════════════════════════════════════════ */

const backdrop = document.getElementById('automation-modal-backdrop');
const modalTitle = document.getElementById('auto-modal-title-text');
const nameInput = document.getElementById('auto-name');
const descInput = document.getElementById('auto-desc');
const actionsList = document.getElementById('actions-list');
const addActionBtn = document.getElementById('add-action-btn');
const saveBtn = document.getElementById('auto-save-btn');
const cancelBtn = document.getElementById('auto-cancel-btn');
const modalCloseBtn = document.getElementById('auto-modal-close');

const triggerOptions = document.querySelectorAll('.trigger-option');
const dailyTimeInput = document.getElementById('daily-time');
const weeklyTimeInput = document.getElementById('weekly-time');
const weeklyDaySelect = document.getElementById('weekly-day');
const dailySubInputs = document.getElementById('daily-sub-inputs');
const weeklySubInputs = document.getElementById('weekly-sub-inputs');
const intervalSubInputs = document.getElementById('interval-sub-inputs');
const intervalMinInput = document.getElementById('interval-minutes');

let _editingId = null;

/* ══════════════════════════════════════════
   MODAL — TRIGGER HELPERS
══════════════════════════════════════════ */

function getSelectedTriggerType() {
  return [...triggerOptions].find(o => o.classList.contains('selected'))?.dataset?.trigger ?? 'on_startup';
}

function updateSubInputVisibility() {
  const type = getSelectedTriggerType();
  dailySubInputs?.classList.toggle('hidden', type !== 'daily');
  weeklySubInputs?.classList.toggle('hidden', type !== 'weekly');
  intervalSubInputs?.classList.toggle('hidden', type !== 'interval');
}

function setTriggerOption(type) {
  triggerOptions.forEach(o => o.classList.toggle('selected', o.dataset.trigger === type));
  updateSubInputVisibility();
}

triggerOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    triggerOptions.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    updateSubInputVisibility();
  });
});

addActionBtn?.addEventListener('click', () => {
  actionsList?.appendChild(createActionRow({ type: 'open_site' }));
});

/* ══════════════════════════════════════════
   MODAL — FORM COLLECTION
══════════════════════════════════════════ */

function collectFormData() {
  const name = nameInput?.value?.trim();
  if (!name) return null;

  const type = getSelectedTriggerType();
  const trigger = { type };
  if (type === 'interval') trigger.minutes = parseInt(intervalMinInput?.value, 10) || 30;
  if (type === 'daily') trigger.time = dailyTimeInput?.value || '09:00';
  if (type === 'weekly') {
    trigger.time = weeklyTimeInput?.value || '09:00';
    trigger.day = weeklyDaySelect?.value || 'monday';
  }

  const actions = [];
  actionsList?.querySelectorAll('.action-row').forEach(row => {
    const a = collectActionFromRow(row);
    if (a) actions.push(a);
  });

  return {
    id: _editingId ?? generateId(),
    name,
    description: descInput?.value?.trim() || '',
    enabled: true,
    trigger,
    actions,
    lastRun: null,
  };
}

/* ══════════════════════════════════════════
   MODAL — OPEN / CLOSE
══════════════════════════════════════════ */

export function openModal(automation = null) {
  _editingId = automation?.id ?? null;

  if (modalTitle) modalTitle.textContent = automation ? 'Edit Automation' : 'New Automation';
  if (nameInput) nameInput.value = automation?.name || '';
  if (descInput) descInput.value = automation?.description || '';

  setTriggerOption(automation?.trigger?.type || 'on_startup');

  if (dailyTimeInput) dailyTimeInput.value = automation?.trigger?.time || '09:00';
  if (weeklyTimeInput) weeklyTimeInput.value = automation?.trigger?.time || '09:00';
  if (weeklyDaySelect) weeklyDaySelect.value = automation?.trigger?.day || 'monday';
  if (intervalMinInput) intervalMinInput.value = automation?.trigger?.minutes || 30;

  if (actionsList) {
    actionsList.innerHTML = '';
    const acts = automation?.actions?.length ? automation.actions : [{ type: 'open_site' }];
    acts.forEach(a => actionsList.appendChild(createActionRow(a)));
  }

  backdrop?.classList.add('open');
  document.body.classList.add('modal-open');
  setTimeout(() => nameInput?.focus(), 60);
}

export function closeModal() {
  backdrop?.classList.remove('open');
  document.body.classList.remove('modal-open');
  _editingId = null;
}

/* ══════════════════════════════════════════
   MODAL — SAVE
══════════════════════════════════════════ */

saveBtn?.addEventListener('click', async () => {
  const data = collectFormData();
  if (!data) {
    nameInput?.focus();
    nameInput?.animate(
      [{ borderColor: '#f87171' }, { borderColor: 'var(--border)' }],
      { duration: 1000 },
    );
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const res = await window.electronAPI?.saveAutomation?.(data);
    if (res?.ok) {
      const idx = state.automations.findIndex(a => a.id === data.id);
      if (idx >= 0) state.automations[idx] = res.automation ?? data;
      else state.automations.push(res.automation ?? data);
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

cancelBtn?.addEventListener('click', closeModal);
modalCloseBtn?.addEventListener('click', closeModal);
backdrop?.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

/* ══════════════════════════════════════════
   GRID + CONFIRM WIRING
══════════════════════════════════════════ */

initGrid({
  onEdit: auto => openModal(auto),
  onConfirmDelete: (id, name) => openConfirm(id, name),
});

document.getElementById('add-automation-header-btn')?.addEventListener('click', () => openModal());
document.getElementById('add-automation-empty-btn')?.addEventListener('click', () => openModal());

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeConfirm(); }
});

/* ══════════════════════════════════════════
   BOOT
══════════════════════════════════════════ */

loadAutomations();