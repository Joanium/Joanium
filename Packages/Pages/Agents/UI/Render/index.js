import { createConfirmDialog } from './Components/ConfirmDialog.js';
import { createModelPicker } from './Components/ModelPicker.js';
import { createResponseViewer } from './Components/ResponseViewer.js';
import { generateAgentId, resolveModelLabel } from './Utils/Utils.js';
import { getAgentsHTML } from './Templates/Template.js';
import { createCardPool } from '../../../../System/CardPool.js';
import { state as appState } from '../../../../System/State.js';

const SCHEDULE_OPTIONS = [
  { minutes: 1, label: 'Every 1 minute' },
  { minutes: 5, label: 'Every 5 minutes' },
  { minutes: 15, label: 'Every 15 minutes' },
  { minutes: 30, label: 'Every 30 minutes' },
  { minutes: 60, label: 'Every 1 hour' },
  { minutes: 120, label: 'Every 2 hours' },
  { minutes: 240, label: 'Every 4 hours' },
  { minutes: 480, label: 'Every 8 hours' },
  { minutes: 1440, label: 'Every 24 hours' },
];

function formatSchedule(trigger = {}) {
  const minutes = Math.max(1, parseInt(trigger.minutes, 10) || 30);
  const preset = SCHEDULE_OPTIONS.find((option) => option.minutes === minutes);
  if (preset) return preset.label;
  return minutes < 60 ? `Every ${minutes} minutes` : `Every ${minutes / 60} hours`;
}

function truncate(text, limit = 180) {
  const normalized = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3)}...`;
}

function normalizeWorkspacePath(workspacePath) {
  const value = String(workspacePath ?? '').trim();
  return value || null;
}

function cloneProjectSnapshot(project) {
  if (!project?.rootPath) return null;
  return {
    id: project.id ?? null,
    name: project.name ?? 'Workspace',
    rootPath: project.rootPath,
    context: project.context ?? '',
  };
}

function formatWorkspaceLabel(workspacePath) {
  if (!workspacePath) return '';
  return workspacePath.length > 64 ? `...${workspacePath.slice(-61)}` : workspacePath;
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso);
  const second = 1_000;
  const minute = 60 * second;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < 30 * second) return 'just now';
  if (diff < 2 * minute) return `${Math.floor(diff / second)}s ago`;
  if (diff < 2 * hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < 2 * day) return `${Math.floor(diff / hour)}h ago`;
  return new Date(iso).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildHistoryModal({ onOpenResponse }) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="agent-history-backdrop">
      <div id="agent-history-modal">
        <div class="agent-history-header">
          <div>
            <div class="agent-modal-eyebrow">Run History</div>
            <h2 id="agent-history-title">Agent</h2>
          </div>
          <button class="settings-modal-close" id="agent-history-close" type="button" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>
        <div id="agent-history-body" class="agent-history-body"></div>
      </div>
    </div>`;

  const backdropEl = wrapper.firstElementChild;
  document.body.appendChild(backdropEl);

  const titleEl = backdropEl.querySelector('#agent-history-title');
  const bodyEl = backdropEl.querySelector('#agent-history-body');
  const closeBtn = backdropEl.querySelector('#agent-history-close');

  function close() {
    backdropEl.classList.remove('open');
  }

  function open(agent) {
    titleEl.textContent = agent.name;
    bodyEl.innerHTML = '';

    const history = Array.isArray(agent.history) ? agent.history : [];
    if (!history.length) {
      const hintEl = document.createElement('div');
      hintEl.className = 'agent-history-empty';
      hintEl.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
          style="width:28px;height:28px;opacity:0.35">
          <path d="M12 8v4l3 3" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/>
        </svg>
        <p>No runs recorded yet.<br>Use Run Now to execute this agent immediately.</p>`;
      bodyEl.appendChild(hintEl);
      backdropEl.classList.add('open');
      return;
    }

    const section = document.createElement('div');
    section.className = 'agent-history-job';
    section.innerHTML = `
      <div class="agent-history-job-header">
        <span class="agent-history-job-name">Scheduled runs</span>
        <span class="agent-history-job-trigger">${formatSchedule(agent.trigger)}</span>
        <span class="agent-history-job-count">${history.length} run${history.length !== 1 ? 's' : ''}</span>
      </div>`;

    history.forEach((entry) => {
      const statusClass = entry.error ? 'error' : 'acted';
      const statusLabel = entry.error ? 'Error' : 'Completed';
      const row = document.createElement('div');
      row.className = `agent-history-entry agent-history-entry--${statusClass}`;
      row.innerHTML = `
        <div class="agent-history-entry-row">
          <div class="agent-history-entry-left">
            <span class="agent-history-entry-time">${timeAgo(entry.timestamp)}</span>
            <span class="agent-history-entry-datetime">${new Date(entry.timestamp).toLocaleString()}</span>
          </div>
          <div class="agent-history-entry-right">
            <span class="agent-history-entry-status agent-history-entry-status--${statusClass}">${statusLabel}</span>
            ${entry.fullResponse || entry.summary ? '<button class="agent-history-view-btn" type="button">View</button>' : ''}
          </div>
        </div>
        ${
          entry.error
            ? `<div class="agent-history-entry-error">${entry.error}</div>`
            : entry.summary
              ? `<div class="agent-history-entry-nothing">${truncate(entry.summary, 220)}</div>`
              : ''
        }`;

      row.querySelector('.agent-history-view-btn')?.addEventListener('click', (event) => {
        event.stopPropagation();
        onOpenResponse(entry, agent.name);
      });

      section.appendChild(row);
    });

    bodyEl.appendChild(section);
    backdropEl.classList.add('open');
  }

  const onBackdropClick = (event) => {
    if (event.target === backdropEl) close();
  };

  closeBtn.addEventListener('click', close);
  backdropEl.addEventListener('click', onBackdropClick);

  return {
    open,
    close,
    destroy() {
      closeBtn.removeEventListener('click', close);
      backdropEl.removeEventListener('click', onBackdropClick);
      backdropEl.remove();
    },
  };
}

function createAgentsGrid({
  gridEl,
  emptyEl,
  resolveModelName,
  onToggle,
  onRun,
  onHistory,
  onEdit,
  onDelete,
}) {
  function createCard() {
    const card = document.createElement('div');
    card.className = 'auto-card';
    card._currentAgent = null;

    card.innerHTML = `
      <div class="auto-card-head">
        <div class="auto-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/></svg></div>
        <div class="auto-card-info">
          <div class="auto-card-name"></div>
          <div class="auto-card-desc" style="display:none"></div>
        </div>
        <label class="auto-toggle" title="">
          <input type="checkbox" class="toggle-input"><div class="auto-toggle-track"></div>
        </label>
      </div>
      <div class="auto-card-meta">
        <span class="auto-card-tag trigger-tag">
          <span class="auto-trigger-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 8v4l3 3" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/></svg>
          </span>
          <span class="auto-trigger-text"></span>
        </span>
        <div class="auto-card-actions-summary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4" stroke-linecap="round"/></svg>
          <span class="auto-actions-text"></span>
        </div>
        <div class="agentic-prompt-preview"></div>
        <div class="auto-card-lastrun" style="display:none"></div>
      </div>
      <div class="auto-card-footer">
        <button class="auto-card-btn run-btn" title="Run now">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Run
        </button>
        <button class="auto-card-btn history-btn" title="View history">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v4l3 3" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/></svg>
          History
        </button>
        <button class="auto-card-btn edit-btn" title="Edit agent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round"/></svg>
          Edit
        </button>
        <button class="auto-card-btn danger delete-btn" title="Delete agent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Delete
        </button>
      </div>`;

    card.querySelector('.toggle-input')?.addEventListener('change', (event) => {
      if (card._currentAgent) onToggle(card._currentAgent, event.target.checked, card);
    });
    card.querySelector('.run-btn')?.addEventListener('click', () => {
      if (card._currentAgent) onRun(card._currentAgent, card.querySelector('.run-btn'));
    });
    card.querySelector('.history-btn')?.addEventListener('click', () => {
      if (card._currentAgent) onHistory(card._currentAgent);
    });
    card.querySelector('.edit-btn')?.addEventListener('click', () => {
      if (card._currentAgent) onEdit(card._currentAgent);
    });
    card.querySelector('.delete-btn')?.addEventListener('click', () => {
      if (card._currentAgent) onDelete(card._currentAgent.id, card._currentAgent.name);
    });

    return card;
  }

  function updateCard(card, agent) {
    card._currentAgent = agent;
    card.className = `auto-card${agent.enabled ? '' : ' is-disabled'}`;
    card.querySelector('.auto-card-name').textContent = agent.name;
    card.querySelector('.toggle-input').checked = agent.enabled;
    card.querySelector('.auto-toggle').title = agent.enabled ? 'Enabled' : 'Disabled';
    card.querySelector('.auto-trigger-text').textContent = formatSchedule(agent.trigger);
    card.querySelector('.auto-actions-text').textContent =
      resolveModelName(agent.primaryModel?.provider, agent.primaryModel?.modelId) || 'No model';
    card.querySelector('.agentic-prompt-preview').textContent =
      truncate(agent.prompt, 200) || 'No prompt set.';

    const descEl = card.querySelector('.auto-card-desc');
    if (agent.description) {
      descEl.style.display = '';
      descEl.textContent = agent.description;
    } else {
      descEl.style.display = 'none';
    }

    const lastRunEl = card.querySelector('.auto-card-lastrun');
    if (agent.lastRun) {
      lastRunEl.style.display = '';
      lastRunEl.textContent = `Last run ${timeAgo(agent.lastRun)}`;
    } else {
      lastRunEl.style.display = 'none';
    }
  }

  const pool = createCardPool({
    container: gridEl,
    createCard,
    updateCard,
    getKey: (agent) => agent.id,
  });

  function render(agents) {
    if (!agents.length) {
      emptyEl.hidden = false;
      gridEl.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    gridEl.hidden = false;
    pool.render(agents);
  }

  return {
    render,
    clear() {
      pool.clear();
    },
  };
}

export function mount(outlet) {
  outlet.innerHTML = getAgentsHTML();

  const state = {
    agents: [],
    allModels: [],
    editingId: null,
    deletingId: null,
    editingEnabled: true,
    primaryModel: null,
    boundWorkspacePath: null,
    boundProject: null,
  };

  const elements = {
    gridEl: document.getElementById('auto-grid'),
    emptyEl: document.getElementById('auto-empty'),
    addHeaderBtn: document.getElementById('add-agent-header-btn'),
    addEmptyBtn: document.getElementById('add-agent-empty-btn'),
    modalBackdrop: document.getElementById('automation-modal-backdrop'),
    modalTitleEl: document.getElementById('agent-modal-title-text'),
    modalCloseBtn: document.getElementById('auto-modal-close'),
    cancelBtn: document.getElementById('auto-cancel-btn'),
    saveBtn: document.getElementById('auto-save-btn'),
    nameInput: document.getElementById('agent-name'),
    descInput: document.getElementById('agent-desc'),
    promptInput: document.getElementById('agent-prompt'),
    scheduleSelect: document.getElementById('agent-schedule-select'),
    workspacePanel: document.getElementById('agent-workspace-panel'),
    workspaceTitle: document.getElementById('agent-workspace-title'),
    workspacePath: document.getElementById('agent-workspace-path'),
    workspacePickBtn: document.getElementById('agent-workspace-pick-btn'),
    workspaceCurrentBtn: document.getElementById('agent-workspace-current-btn'),
    workspaceClearBtn: document.getElementById('agent-workspace-clear-btn'),
    primaryModelBtn: document.getElementById('primary-model-btn'),
    primaryModelLabel: document.getElementById('primary-model-label'),
    primaryModelMenu: document.getElementById('primary-model-menu'),
    confirmOverlay: document.getElementById('confirm-overlay'),
    confirmCancelBtn: document.getElementById('confirm-cancel'),
    confirmDeleteBtn: document.getElementById('confirm-delete'),
    confirmNameEl: document.getElementById('confirm-automation-name'),
  };

  const responseViewer = createResponseViewer();
  const historyModal = buildHistoryModal({
    onOpenResponse: responseViewer.open,
  });
  const modelPicker = createModelPicker({
    state,
    primaryModelBtn: elements.primaryModelBtn,
    primaryModelLabel: elements.primaryModelLabel,
    primaryModelMenu: elements.primaryModelMenu,
  });

  function getCurrentWorkspaceBinding() {
    const activeProject = cloneProjectSnapshot(appState.activeProject);
    const workspacePath = normalizeWorkspacePath(activeProject?.rootPath ?? appState.workspacePath);
    return {
      workspacePath,
      project: activeProject && activeProject.rootPath === workspacePath ? activeProject : null,
    };
  }

  function applyWorkspaceBinding(workspacePath, project = undefined) {
    state.boundWorkspacePath = normalizeWorkspacePath(workspacePath);

    if (!state.boundWorkspacePath) {
      state.boundProject = null;
      return;
    }

    if (project !== undefined) {
      state.boundProject = cloneProjectSnapshot(project);
      return;
    }

    if (state.boundProject?.rootPath === state.boundWorkspacePath) {
      state.boundProject = cloneProjectSnapshot(state.boundProject);
      return;
    }

    const current = getCurrentWorkspaceBinding();
    state.boundProject =
      current.project?.rootPath === state.boundWorkspacePath ? current.project : null;
  }

  function syncWorkspaceBindingUI() {
    const current = getCurrentWorkspaceBinding();
    const hasBoundWorkspace = Boolean(state.boundWorkspacePath);
    const hasCurrentWorkspace = Boolean(current.workspacePath);

    if (elements.workspacePanel) {
      elements.workspacePanel.classList.toggle('is-empty', !hasBoundWorkspace);
    }

    if (elements.workspaceTitle) {
      elements.workspaceTitle.textContent = hasBoundWorkspace
        ? state.boundProject
          ? state.boundProject.name || 'Bound project'
          : 'Bound folder'
        : 'No workspace selected';
    }

    if (elements.workspacePath) {
      elements.workspacePath.textContent = hasBoundWorkspace
        ? state.boundWorkspacePath
        : 'This agent will run without a default workspace. It will not inherit the folder or project currently open in chat.';
      elements.workspacePath.title = hasBoundWorkspace ? state.boundWorkspacePath : '';
    }

    if (elements.workspaceCurrentBtn) {
      elements.workspaceCurrentBtn.disabled = !hasCurrentWorkspace;
      elements.workspaceCurrentBtn.textContent = current.project
        ? 'Use Current Project'
        : hasCurrentWorkspace
          ? 'Use Current Folder'
          : 'No Current Workspace';
      elements.workspaceCurrentBtn.title = hasCurrentWorkspace
        ? formatWorkspaceLabel(current.workspacePath)
        : 'Open a folder or project in chat to use it here.';
    }

    if (elements.workspaceClearBtn) {
      elements.workspaceClearBtn.disabled = !hasBoundWorkspace;
    }
  }

  async function fetchAgents() {
    const response = await window.electronAPI?.invoke?.('get-agents').catch(() => null);
    return Array.isArray(response?.agents) ? response.agents : [];
  }

  async function loadModels() {
    try {
      const providers = (await window.electronAPI?.invoke?.('get-models')) ?? [];
      state.allModels = [];

      providers.forEach((provider) => {
        if (!provider.configured) return;
        Object.entries(provider.models ?? {}).forEach(([modelId, info]) => {
          state.allModels.push({
            providerId: provider.provider,
            provider: provider.label ?? provider.provider,
            modelId,
            modelName: info.name ?? modelId,
            description: info.description ?? '',
            rank: info.rank ?? 999,
          });
        });
      });

      state.allModels.sort((left, right) => left.rank - right.rank);
    } catch (error) {
      console.warn('[Agents] Could not load models:', error);
      state.allModels = [];
    }
  }

  const confirmDialog = createConfirmDialog({
    state,
    overlayEl: elements.confirmOverlay,
    cancelBtn: elements.confirmCancelBtn,
    deleteBtn: elements.confirmDeleteBtn,
    nameEl: elements.confirmNameEl,
    onDelete: async (agentId) => {
      const response = await window.electronAPI?.invoke?.('delete-agent', agentId);
      if (!response?.ok) {
        window.alert(response?.error ?? 'Unable to delete this agent right now.');
        return;
      }

      state.agents = state.agents.filter((agent) => agent.id !== agentId);
      grid.render(state.agents);
    },
  });

  const grid = createAgentsGrid({
    gridEl: elements.gridEl,
    emptyEl: elements.emptyEl,
    resolveModelName: (providerId, modelId) =>
      resolveModelLabel(state.allModels, providerId, modelId),
    onToggle: async (agent, enabled, card) => {
      const previousEnabled = agent.enabled;
      agent.enabled = enabled;
      card.classList.toggle('is-disabled', !enabled);
      try {
        const response = await window.electronAPI?.invoke?.('toggle-agent', agent.id, enabled);
        if (!response?.ok) throw new Error(response?.error ?? 'Unable to update this agent.');
      } catch (error) {
        agent.enabled = previousEnabled;
        card.classList.toggle('is-disabled', !previousEnabled);
        const toggleInput = card.querySelector('.toggle-input');
        if (toggleInput) toggleInput.checked = previousEnabled;
        window.alert(error.message ?? 'Unable to update this agent.');
      }
    },
    onRun: async (agent, button) => {
      const originalLabel = button.innerHTML;
      button.disabled = true;
      button.classList.add('is-running');
      button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite">
          <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/>
        </svg>
        Running`;
      try {
        const response = await window.electronAPI?.invoke?.('run-agent-now', agent.id);
        if (!response?.ok)
          throw new Error(response?.error ?? 'Unable to run this agent right now.');
        state.agents = await fetchAgents();
        grid.render(state.agents);
      } catch (error) {
        window.alert(error.message ?? 'Unable to run this agent right now.');
      } finally {
        button.disabled = false;
        button.classList.remove('is-running');
        button.innerHTML = originalLabel;
      }
    },
    onHistory: async (agent) => {
      state.agents = await fetchAgents();
      historyModal.open(state.agents.find((item) => item.id === agent.id) ?? agent);
    },
    onEdit: (agent) => openModal(agent),
    onDelete: (id, name) => confirmDialog.open(id, name),
  });

  function openModal(agent = null) {
    state.editingId = agent?.id ?? null;
    state.editingEnabled = agent?.enabled ?? true;
    state.primaryModel = agent?.primaryModel ? { ...agent.primaryModel } : null;
    applyWorkspaceBinding(agent?.workspacePath ?? agent?.project?.rootPath ?? null, agent?.project);

    if (elements.modalTitleEl) {
      elements.modalTitleEl.textContent = agent ? 'Edit Agent' : 'New Agent';
    }
    if (elements.nameInput) elements.nameInput.value = agent?.name ?? '';
    if (elements.descInput) elements.descInput.value = agent?.description ?? '';
    if (elements.promptInput) elements.promptInput.value = agent?.prompt ?? '';
    if (elements.scheduleSelect) {
      elements.scheduleSelect.value = String(agent?.trigger?.minutes ?? 30);
    }

    modelPicker.syncPrimaryModelLabel();
    syncWorkspaceBindingUI();

    elements.modalBackdrop?.classList.add('open');
    document.body.classList.add('modal-open');
    setTimeout(() => elements.nameInput?.focus(), 60);
  }

  function closeModal() {
    elements.modalBackdrop?.classList.remove('open');
    document.body.classList.remove('modal-open');
    state.editingId = null;
    modelPicker.closeMenu();
  }

  async function saveModal() {
    const name = elements.nameInput?.value.trim();
    const prompt = elements.promptInput?.value.trim();

    if (!name) {
      elements.nameInput?.focus();
      return;
    }

    if (!prompt) {
      elements.promptInput?.focus();
      return;
    }

    if (!state.primaryModel?.provider || !state.primaryModel?.modelId) {
      elements.primaryModelBtn?.focus();
      window.alert('Choose a primary model before saving this agent.');
      return;
    }

    const minutes = Math.max(1, parseInt(elements.scheduleSelect?.value, 10) || 30);
    const payload = {
      id: state.editingId ?? generateAgentId(),
      name,
      description: elements.descInput?.value.trim() ?? '',
      prompt,
      enabled: state.editingEnabled,
      primaryModel: { ...state.primaryModel },
      trigger: {
        type: 'interval',
        minutes,
      },
      workspacePath: state.boundWorkspacePath,
      project:
        state.boundWorkspacePath && state.boundProject
          ? {
              id: state.boundProject.id ?? null,
              name: state.boundProject.name ?? 'Workspace',
              rootPath: state.boundProject.rootPath ?? state.boundWorkspacePath,
              context: state.boundProject.context ?? '',
            }
          : null,
    };

    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = 'Saving...';

    try {
      const response = await window.electronAPI?.invoke?.('save-agent', payload);
      if (!response?.ok) {
        throw new Error(response?.error ?? 'Unable to save this agent right now.');
      }

      const nextAgent = response.agent ?? payload;
      const existingIndex = state.agents.findIndex((agent) => agent.id === nextAgent.id);
      if (existingIndex >= 0) state.agents[existingIndex] = nextAgent;
      else state.agents.push(nextAgent);

      grid.render(state.agents);
      closeModal();
    } catch (error) {
      window.alert(error.message ?? 'Unable to save this agent right now.');
    } finally {
      elements.saveBtn.disabled = false;
      elements.saveBtn.textContent = 'Save Agent';
    }
  }

  const onEscapeKey = (event) => {
    if (event.key !== 'Escape') return;
    closeModal();
    confirmDialog.close();
    historyModal.close();
    responseViewer.close();
  };

  const onBackdropClick = (event) => {
    if (event.target === elements.modalBackdrop) closeModal();
  };

  const onCreateClick = () => openModal();
  const onPickWorkspaceClick = async () => {
    const defaultPath =
      state.boundWorkspacePath ?? getCurrentWorkspaceBinding().workspacePath ?? undefined;
    const response = await window.electronAPI?.invoke?.('select-directory', { defaultPath });
    if (!response?.ok || !response.path) return;

    applyWorkspaceBinding(response.path);
    syncWorkspaceBindingUI();
  };
  const onUseCurrentWorkspaceClick = () => {
    const current = getCurrentWorkspaceBinding();
    if (!current.workspacePath) return;
    applyWorkspaceBinding(current.workspacePath, current.project);
    syncWorkspaceBindingUI();
  };
  const onClearWorkspaceClick = () => {
    applyWorkspaceBinding(null, null);
    syncWorkspaceBindingUI();
  };
  const onWorkspaceChanged = () => syncWorkspaceBindingUI();

  elements.addHeaderBtn?.addEventListener('click', onCreateClick);
  elements.addEmptyBtn?.addEventListener('click', onCreateClick);
  elements.modalCloseBtn?.addEventListener('click', closeModal);
  elements.cancelBtn?.addEventListener('click', closeModal);
  elements.workspacePickBtn?.addEventListener('click', onPickWorkspaceClick);
  elements.workspaceCurrentBtn?.addEventListener('click', onUseCurrentWorkspaceClick);
  elements.workspaceClearBtn?.addEventListener('click', onClearWorkspaceClick);
  elements.saveBtn?.addEventListener('click', saveModal);
  elements.modalBackdrop?.addEventListener('click', onBackdropClick);
  document.addEventListener('keydown', onEscapeKey);
  window.addEventListener('ow:workspace-changed', onWorkspaceChanged);
  window.addEventListener('ow:project-changed', onWorkspaceChanged);

  async function load() {
    await loadModels();
    state.agents = await fetchAgents();
    grid.render(state.agents);
  }

  load().catch((error) => {
    console.error('[Agents] Failed to load page data:', error);
  });

  return function cleanup() {
    document.removeEventListener('keydown', onEscapeKey);
    elements.addHeaderBtn?.removeEventListener('click', onCreateClick);
    elements.addEmptyBtn?.removeEventListener('click', onCreateClick);
    elements.modalCloseBtn?.removeEventListener('click', closeModal);
    elements.cancelBtn?.removeEventListener('click', closeModal);
    elements.workspacePickBtn?.removeEventListener('click', onPickWorkspaceClick);
    elements.workspaceCurrentBtn?.removeEventListener('click', onUseCurrentWorkspaceClick);
    elements.workspaceClearBtn?.removeEventListener('click', onClearWorkspaceClick);
    elements.saveBtn?.removeEventListener('click', saveModal);
    elements.modalBackdrop?.removeEventListener('click', onBackdropClick);
    window.removeEventListener('ow:workspace-changed', onWorkspaceChanged);
    window.removeEventListener('ow:project-changed', onWorkspaceChanged);

    grid.clear();
    modelPicker.cleanup();
    confirmDialog.cleanup();
    closeModal();
    confirmDialog.close();
    historyModal.close();
    historyModal.destroy();
    responseViewer.close();
    responseViewer.destroy();
  };
}
