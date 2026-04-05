import { DATA_SOURCE_TYPES, OUTPUT_TYPES, loadAgentsFeatureRegistry } from './Config/Constants.js';
import { createConfirmDialog } from './Components/ConfirmDialog.js';
import { createAgentGrid } from './Components/Grid.js';
import { createHistoryModal } from '../../../../Modals/HistoryModal.js';
import { createJobsController } from './Builders/JobBuilder.js';
import { createModelPicker } from './Components/ModelPicker.js';
import { createResponseViewer } from './Components/ResponseViewer.js';
import { createAgentsPageState } from './State/State.js';
import { getAgentsHTML } from './Templates/Template.js';
import { cloneJobsForEditing, generateAgentId, resolveModelLabel } from './Utils/Utils.js';

const BUILTIN_REQUIRED_DATA_SOURCE_FIELDS = {
  rss_feed: ['url'],
  reddit_posts: ['subreddit'],
  weather: ['location'],
  read_file: ['filePath'],
  fetch_url: ['url'],
};

const BUILTIN_REQUIRED_OUTPUT_FIELDS = {
  send_email: ['to'],
  write_file: ['filePath'],
  http_webhook: ['url'],
};

const BUILTIN_FIELD_LABELS = {
  filePath: 'file path',
  location: 'location',
  repo: 'repository',
  subreddit: 'subreddit',
  to: 'recipient email',
  url: 'URL',
};

function hasConfiguredValue(value) {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return String(value ?? '').trim().length > 0;
}

function getJobSources(job = {}) {
  if (Array.isArray(job.dataSources)) return job.dataSources.filter(Boolean);
  if (job.dataSource?.type) return [job.dataSource];
  return [];
}

function isMeaningfulSource(source = {}) {
  if (source.type) return true;
  return Object.entries(source).some(([key, value]) => key !== 'type' && hasConfiguredValue(value));
}

function isMeaningfulOutput(output = {}) {
  if (output.type) return true;
  return Object.entries(output).some(([key, value]) => key !== 'type' && hasConfiguredValue(value));
}

function isBlankJobDraft(job = {}) {
  return (
    !String(job.name ?? '').trim() &&
    !String(job.instruction ?? '').trim() &&
    !getJobSources(job).some(isMeaningfulSource) &&
    !isMeaningfulOutput(job.output ?? {})
  );
}

function collectMissingFields(definition, values = {}, builtinRequired = []) {
  const missing = [];
  const requiredParams = (definition?.params ?? []).filter((param) => param.required);

  requiredParams.forEach((param) => {
    if (!hasConfiguredValue(values?.[param.key])) {
      missing.push((param.label ?? param.key).toLowerCase());
    }
  });

  builtinRequired.forEach((key) => {
    if (!hasConfiguredValue(values?.[key])) {
      missing.push(BUILTIN_FIELD_LABELS[key] ?? key);
    }
  });

  return missing;
}

function getJobValidationError(job, index) {
  const jobName = job.name?.trim() || `Job ${index + 1}`;
  const sources = getJobSources(job);

  if (!sources.length || !sources.some((source) => source?.type)) {
    return `${jobName}: choose at least one data source.`;
  }

  for (const source of sources) {
    if (!source?.type) return `${jobName}: remove the unfinished data source or choose its type.`;

    const definition = DATA_SOURCE_TYPES.find((item) => item.value === source.type);
    const missing = collectMissingFields(
      definition,
      source,
      BUILTIN_REQUIRED_DATA_SOURCE_FIELDS[source.type] ?? [],
    );

    if (missing.length) {
      return `${jobName}: ${definition?.label ?? source.type} is missing ${missing.join(', ')}.`;
    }
  }

  if (!job.output?.type) {
    return `${jobName}: choose what to do with the result.`;
  }

  const outputDefinition = OUTPUT_TYPES.find((item) => item.value === job.output.type);
  const outputMissing = collectMissingFields(
    outputDefinition,
    job.output,
    BUILTIN_REQUIRED_OUTPUT_FIELDS[job.output.type] ?? [],
  );

  if (outputMissing.length) {
    return `${jobName}: ${outputDefinition?.label ?? job.output.type} is missing ${outputMissing.join(', ')}.`;
  }

  return null;
}

function sanitizeJobForSave(job = {}) {
  return {
    ...job,
    dataSources: getJobSources(job)
      .filter((source) => source?.type)
      .map((source) => ({ ...source })),
    output: { ...(job.output ?? { type: '' }) },
    trigger: { ...(job.trigger ?? { type: 'daily', time: '08:00' }) },
  };
}

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

  function renderGrid() {
    agentGrid.render(state.agents);
  }

  const confirmDialog = createConfirmDialog({
    state,
    overlayEl: elements.confirmOverlay,
    cancelBtn: elements.confirmCancelBtn,
    deleteBtn: elements.confirmDeleteBtn,
    nameEl: elements.confirmNameEl,
    onDelete: async (agentId) => {
      try {
        const response = await window.electronAPI?.invoke?.('delete-agent', agentId);
        if (!response?.ok) {
          window.alert(response?.error ?? 'Unable to delete this agent right now.');
          return;
        }

        state.agents = state.agents.filter((agent) => agent.id !== agentId);
        renderGrid();
      } catch (error) {
        window.alert(error.message ?? 'Unable to delete this agent right now.');
      }
    },
  });

  const agentGrid = createAgentGrid({
    gridEl: elements.gridEl,
    emptyEl: elements.emptyEl,
    dataSourceTypes: DATA_SOURCE_TYPES,
    resolveModelLabel: (providerId, modelId) =>
      resolveModelLabel(state.allModels, providerId, modelId),
    onToggleAgent: async ({ agent, enabled, card }) => {
      const previousEnabled = agent.enabled;
      agent.enabled = enabled;
      card.classList.toggle('is-disabled', !enabled);
      try {
        const response = await window.electronAPI?.invoke?.('toggle-agent', agent.id, enabled);
        if (response?.ok) return;

        throw new Error(response?.error ?? 'Unable to update the agent right now.');
      } catch (error) {
        agent.enabled = previousEnabled;
        card.classList.toggle('is-disabled', !previousEnabled);
        const toggleInput = card.querySelector('.toggle-input');
        if (toggleInput) toggleInput.checked = previousEnabled;
        window.alert(error.message ?? 'Unable to update the agent right now.');
      }
    },
    onRunAgent: async ({ agent, button }) => {
      const originalLabel = button.innerHTML;
      button.classList.add('is-running');
      button.disabled = true;
      button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite">
          <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/>
        </svg>`;
      try {
        const response = await window.electronAPI?.invoke?.('run-agent-now', agent.id);
        if (!response?.ok) {
          throw new Error(response?.error ?? 'Unable to run this agent right now.');
        }

        state.agents = await fetchAgents();
        renderGrid();
      } catch (error) {
        window.alert(error.message ?? 'Unable to run this agent right now.');
      } finally {
        button.classList.remove('is-running');
        button.disabled = false;
        button.innerHTML = originalLabel;
      }
    },
    onOpenHistory: async (agent) => {
      state.agents = await fetchAgents();
      historyModal.open(state.agents.find((item) => item.id === agent.id) ?? agent);
    },
    onOpenModal: (agent) => openModal(agent),
    onOpenConfirm: (id, name) => confirmDialog.open(id, name),
  });

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

  async function openModal(agent = null) {
    state.editingId = agent?.id ?? null;
    state.editingEnabled = agent?.enabled ?? true;
    state.primaryModel = agent?.primaryModel ? { ...agent.primaryModel } : null;
    state.fallbackModels = agent?.fallbackModels ? [...agent.fallbackModels] : [];
    state.jobs = cloneJobsForEditing(agent);

    if (elements.modalTitleEl)
      elements.modalTitleEl.textContent = agent ? 'Edit Agent' : 'New Agent';
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

  const onModalBackdropClick = (event) => {
    if (event.target === elements.modalBackdrop) closeModal();
  };

  const onSaveClick = async () => {
    const name = elements.nameInput?.value.trim();
    if (!name) {
      elements.nameInput?.animate([{ borderColor: '#f87171' }, { borderColor: 'var(--border)' }], {
        duration: 900,
      });
      elements.nameInput?.focus();
      return;
    }

    const configuredJobs = state.jobs
      .filter((job) => !isBlankJobDraft(job))
      .map(sanitizeJobForSave);

    if (
      configuredJobs.length > 0 &&
      (!state.primaryModel?.provider || !state.primaryModel?.modelId)
    ) {
      elements.primaryModelBtn?.animate(
        [{ borderColor: '#f87171' }, { borderColor: 'var(--border)' }],
        { duration: 900 },
      );
      elements.primaryModelBtn?.focus();
      window.alert('Choose a primary model before saving an agent with jobs.');
      return;
    }

    const invalidJobMessage = configuredJobs
      .map((job, index) => getJobValidationError(job, index))
      .find(Boolean);

    if (invalidJobMessage) {
      window.alert(invalidJobMessage);
      return;
    }

    const payload = {
      id: state.editingId ?? generateAgentId(),
      name,
      description: elements.descInput?.value.trim() ?? '',
      enabled: state.editingEnabled,
      primaryModel: state.primaryModel ? { ...state.primaryModel } : null,
      fallbackModels: state.fallbackModels.map((model) => ({ ...model })),
      jobs: configuredJobs,
    };

    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = 'Saving...';

    try {
      const response = await window.electronAPI?.invoke?.('save-agent', payload);
      if (!response?.ok) {
        throw new Error(response?.error ?? 'Unable to save this agent right now.');
      }

      const nextAgent = response.agent ?? payload;
      const existingIndex = state.agents.findIndex((agent) => agent.id === payload.id);

      if (existingIndex >= 0) {
        state.agents[existingIndex] = nextAgent;
      } else {
        state.agents.push(nextAgent);
      }

      renderGrid();
      closeModal();
    } catch (error) {
      window.alert(error.message ?? 'Unable to save this agent right now.');
    } finally {
      elements.saveBtn.disabled = false;
      elements.saveBtn.textContent = 'Save Agent';
    }
  };

  const onEscapeKey = (event) => {
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

  load().catch((error) => {
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

    agentGrid.clear();
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
