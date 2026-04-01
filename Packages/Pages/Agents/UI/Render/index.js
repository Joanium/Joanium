import { DATA_SOURCE_TYPES, loadAgentsFeatureRegistry } from './Config/Constants.js';
import { createConfirmDialog } from './Components/ConfirmDialog.js';
import { renderAgentsGrid } from './Components/Grid.js';
import { createHistoryModal } from './Components/HistoryModal.js';
import { createJobsController } from './Builders/JobBuilder.js';
import { createModelPicker } from './Components/ModelPicker.js';
import { createResponseViewer } from './Components/ResponseViewer.js';
import { createAgentsPageState } from './State/State.js';
import { getAgentsHTML } from './Templates/Template.js';
import { cloneJobsForEditing, generateAgentId, resolveModelLabel } from './Utils/Utils.js';

export function mount(outlet) {
  outlet.innerHTML = getAgentsHTML();

  const state = createAgentsPageState();
  const elements = {
    gridEl: document.getElementById('agents-grid'),
    emptyEl: document.getElementById('agents-empty'),
    addAgentHeaderBtn: document.getElementById('add-agent-header-btn'),
    addAgentEmptyBtn: document.getElementById('add-agent-empty-btn'),
    modalBackdrop: document.getElementById('agent-modal-backdrop'),
    modalTitleEl: document.getElementById('agent-modal-title-text'),
    modalCloseBtn: document.getElementById('agent-modal-close'),
    modalBodyEl: document.getElementById('agent-modal-body'),
    cancelBtn: document.getElementById('agent-cancel-btn'),
    saveBtn: document.getElementById('agent-save-btn'),
    nameInput: document.getElementById('agent-name'),
    descInput: document.getElementById('agent-desc'),
    primaryModelBtn: document.getElementById('primary-model-btn'),
    primaryModelLabel: document.getElementById('primary-model-label'),
    primaryModelMenu: document.getElementById('primary-model-menu'),
    fallbackListEl: document.getElementById('fallback-models-list'),
    jobsListEl: document.getElementById('jobs-list'),
    addJobBtn: document.getElementById('add-job-btn'),
    jobsBadge: document.getElementById('jobs-count-badge'),
    confirmOverlay: document.getElementById('agent-confirm-overlay'),
    confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
    confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
    confirmNameEl: document.getElementById('confirm-agent-name'),
  };

  const responseViewer = createResponseViewer();
  const historyModal = createHistoryModal({
    dataSourceTypes: DATA_SOURCE_TYPES,
    onOpenResponse: responseViewer.open,
  });
  const modelPicker = createModelPicker({
    state,
    primaryModelBtn: elements.primaryModelBtn,
    primaryModelLabel: elements.primaryModelLabel,
    primaryModelMenu: elements.primaryModelMenu,
    fallbackListEl: elements.fallbackListEl,
  });
  const jobsController = createJobsController({
    state,
    jobsListEl: elements.jobsListEl,
    addJobBtn: elements.addJobBtn,
    jobsBadge: elements.jobsBadge,
    modalBodyEl: elements.modalBodyEl,
  });

  async function fetchAgents() {
    const response = await window.electronAPI?.getAgents?.().catch(() => null);
    return Array.isArray(response?.agents) ? response.agents : [];
  }

  async function loadModels() {
    try {
      const providers = await window.electronAPI?.getModels?.() ?? [];
      state.allModels = [];

      providers.forEach(provider => {
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

  function renderGrid() {
    renderAgentsGrid({
      agents: state.agents,
      gridEl: elements.gridEl,
      emptyEl: elements.emptyEl,
      dataSourceTypes: DATA_SOURCE_TYPES,
      resolveModelLabel: (providerId, modelId) => resolveModelLabel(state.allModels, providerId, modelId),
      onToggleAgent: async ({ agent, enabled, card }) => {
        agent.enabled = enabled;
        card.classList.toggle('is-disabled', !enabled);
        await window.electronAPI?.toggleAgent?.(agent.id, enabled);
      },
      onRunAgent: async ({ agent, button }) => {
        button.classList.add('is-running');
        button.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite">
            <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/>
          </svg>`;
        await window.electronAPI?.runAgentNow?.(agent.id);
        state.agents = await fetchAgents();
        renderGrid();
      },
      onOpenHistory: async agent => {
        state.agents = await fetchAgents();
        historyModal.open(state.agents.find(item => item.id === agent.id) ?? agent);
      },
      onOpenModal: openModal,
      onOpenConfirm: confirmDialog.open,
    });
  }

  const confirmDialog = createConfirmDialog({
    state,
    overlayEl: elements.confirmOverlay,
    cancelBtn: elements.confirmCancelBtn,
    deleteBtn: elements.confirmDeleteBtn,
    nameEl: elements.confirmNameEl,
    onDelete: async agentId => {
      await window.electronAPI?.deleteAgent?.(agentId);
      state.agents = state.agents.filter(agent => agent.id !== agentId);
      renderGrid();
    },
  });

  async function openModal(agent = null) {
    state.editingId = agent?.id ?? null;
    state.editingEnabled = agent?.enabled ?? true;
    state.primaryModel = agent?.primaryModel ? { ...agent.primaryModel } : null;
    state.fallbackModels = agent?.fallbackModels ? [...agent.fallbackModels] : [];
    state.jobs = cloneJobsForEditing(agent);

    if (elements.modalTitleEl) elements.modalTitleEl.textContent = agent ? 'Edit Agent' : 'New Agent';
    if (elements.nameInput) elements.nameInput.value = agent?.name ?? '';
    if (elements.descInput) elements.descInput.value = agent?.description ?? '';

    modelPicker.syncPrimaryModelLabel();
    modelPicker.renderFallbackList();
    jobsController.renderJobsList();

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

  const onModalBackdropClick = event => {
    if (event.target === elements.modalBackdrop) closeModal();
  };

  const onSaveClick = async () => {
    const name = elements.nameInput?.value.trim();
    if (!name) {
      elements.nameInput?.animate(
        [{ borderColor: '#f87171' }, { borderColor: 'var(--border)' }],
        { duration: 900 },
      );
      elements.nameInput?.focus();
      return;
    }

    const payload = {
      id: state.editingId ?? generateAgentId(),
      name,
      description: elements.descInput?.value.trim() ?? '',
      enabled: state.editingEnabled,
      primaryModel: state.primaryModel ? { ...state.primaryModel } : null,
      fallbackModels: state.fallbackModels.map(model => ({ ...model })),
      jobs: state.jobs.filter(job => job.dataSources?.some(source => source.type) && job.output?.type),
    };

    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = 'Saving...';

    try {
      const response = await window.electronAPI?.saveAgent?.(payload);
      if (response?.ok) {
        const nextAgent = response.agent ?? payload;
        const existingIndex = state.agents.findIndex(agent => agent.id === payload.id);

        if (existingIndex >= 0) {
          state.agents[existingIndex] = nextAgent;
        } else {
          state.agents.push(nextAgent);
        }

        renderGrid();
        closeModal();
      }
    } finally {
      elements.saveBtn.disabled = false;
      elements.saveBtn.textContent = 'Save Agent';
    }
  };

  const onEscapeKey = event => {
    if (event.key !== 'Escape') return;
    closeModal();
    confirmDialog.close();
    historyModal.close();
    responseViewer.close();
  };

  const onCreateAgentClick = () => openModal();

  elements.addAgentHeaderBtn?.addEventListener('click', onCreateAgentClick);
  elements.addAgentEmptyBtn?.addEventListener('click', onCreateAgentClick);
  elements.modalCloseBtn?.addEventListener('click', closeModal);
  elements.cancelBtn?.addEventListener('click', closeModal);
  elements.modalBackdrop?.addEventListener('click', onModalBackdropClick);
  elements.saveBtn?.addEventListener('click', onSaveClick);
  document.addEventListener('keydown', onEscapeKey);

  async function load() {
    await loadAgentsFeatureRegistry();
    await loadModels();
    state.agents = await fetchAgents();
    renderGrid();
  }

  load().catch(error => {
    console.error('[Agents] Failed to load page data:', error);
  });

  return function cleanup() {
    document.removeEventListener('keydown', onEscapeKey);
    elements.addAgentHeaderBtn?.removeEventListener('click', onCreateAgentClick);
    elements.addAgentEmptyBtn?.removeEventListener('click', onCreateAgentClick);
    elements.modalCloseBtn?.removeEventListener('click', closeModal);
    elements.cancelBtn?.removeEventListener('click', closeModal);
    elements.modalBackdrop?.removeEventListener('click', onModalBackdropClick);
    elements.saveBtn?.removeEventListener('click', onSaveClick);

    jobsController.cleanup();
    modelPicker.cleanup();
    confirmDialog.cleanup();

    closeModal();
    confirmDialog.close();
    historyModal.close();
    responseViewer.close();
    historyModal.destroy();
    responseViewer.destroy();
  };
}

