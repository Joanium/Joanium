// openworld — Pages/Automations/grid.js
// Renders the automation card grid and handles toggle interactions.
// Calls onEdit / onConfirmDelete callbacks provided via initGrid().

import { state } from './State.js';
import { escapeHtml, formatTrigger, formatActionsSummary, formatLastRun } from './Utils.js';

const grid = document.getElementById('auto-grid');
const emptyView = document.getElementById('auto-empty');

let _onEdit = () => { };
let _onConfirmDelete = () => { };

/** Wire up the grid with action callbacks before calling renderAutomations(). */
export function initGrid({ onEdit, onConfirmDelete }) {
    _onEdit = onEdit;
    _onConfirmDelete = onConfirmDelete;
}

export function renderAutomations() {
    if (!state.automations.length) {
        emptyView.hidden = false;
        grid.hidden = true;
        return;
    }
    emptyView.hidden = true;
    grid.hidden = false;
    grid.innerHTML = '';

    state.automations.forEach(auto => {
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
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" stroke-linecap="round"/>
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

        card.querySelector('.toggle-input').addEventListener('change', async e => {
            const enabled = e.target.checked;
            await window.electronAPI?.toggleAutomation?.(auto.id, enabled);
            auto.enabled = enabled;
            card.classList.toggle('is-disabled', !enabled);
        });
        card.querySelector('.edit-btn').addEventListener('click', () => _onEdit(auto));
        card.querySelector('.delete-btn').addEventListener('click', () => _onConfirmDelete(auto.id, auto.name));

        grid.appendChild(card);
    });
}

export async function loadAutomations() {
    try {
        const res = await window.electronAPI?.getAutomations?.();
        state.automations = Array.isArray(res?.automations) ? res.automations : [];
    } catch {
        state.automations = [];
    }
    renderAutomations();
}