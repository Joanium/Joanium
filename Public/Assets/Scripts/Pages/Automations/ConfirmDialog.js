// Romelson — Pages/Automations/confirmDialog.js
// Delete-confirmation overlay. Imports renderAutomations from grid.js (one-way dep).

import { state } from './State.js';
import { renderAutomations } from './Grid.js';

const overlay = document.getElementById('confirm-overlay');
const cancelBtn = document.getElementById('confirm-cancel');
const deleteBtn = document.getElementById('confirm-delete');
const nameEl = document.getElementById('confirm-automation-name');

let _pendingId = null;

export function openConfirm(id, name) {
    _pendingId = id;
    if (nameEl) nameEl.textContent = name;
    overlay?.classList.add('open');
}

export function closeConfirm() {
    overlay?.classList.remove('open');
    _pendingId = null;
}

cancelBtn?.addEventListener('click', closeConfirm);
overlay?.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });

deleteBtn?.addEventListener('click', async () => {
    if (!_pendingId) return;
    await window.electronAPI?.deleteAutomation?.(_pendingId);
    state.automations = state.automations.filter(a => a.id !== _pendingId);
    closeConfirm();
    renderAutomations();
});