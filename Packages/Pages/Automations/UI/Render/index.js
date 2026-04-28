import {
  DATA_SOURCE_TYPES,
  OUTPUT_TYPES,
  loadAutomationsFeatureRegistry,
} from './Config/Constants.js';
import { createConfirmDialog } from '../../../Agents/UI/Render/Components/ConfirmDialog.js';
import { createAgentGrid } from './Components/Grid.js';
import { createHistoryModal } from '../../../../Modals/HistoryModal.js';
import { createJobsController } from './Builders/JobBuilder.js';
import { createModelPicker } from '../../../Agents/UI/Render/Components/ModelPicker.js';
import { createResponseViewer } from '../../../Agents/UI/Render/Components/ResponseViewer.js';
import { createAgentsPageState } from './State/State.js';
import { getAutomationsHTML } from './Templates/Template.js';
import {
  cloneJobsForEditing,
  generateAgentId,
  resolveModelLabel,
} from '../../../Agents/UI/Render/Utils/Utils.js';
import { t } from '../../../../System/I18n/index.js';
const BUILTIN_REQUIRED_DATA_SOURCE_FIELDS = {
    rss_feed: ['url'],
    reddit_posts: ['subreddit'],
    weather: ['location'],
    read_file: ['filePath'],
    fetch_url: ['url'],
  },
  BUILTIN_REQUIRED_OUTPUT_FIELDS = {
    send_email: ['to'],
    write_file: ['filePath'],
    http_webhook: ['url'],
  },
  BUILTIN_FIELD_LABELS = {
    filePath: 'file path',
    location: 'location',
    repo: 'repository',
    subreddit: 'subreddit',
    to: 'recipient email',
    url: 'URL',
  };
function hasConfiguredValue(value) {
  return (
    'boolean' == typeof value ||
    ('number' == typeof value
      ? Number.isFinite(value)
      : Array.isArray(value)
        ? value.length > 0
        : value && 'object' == typeof value
          ? Object.keys(value).length > 0
          : String(value ?? '').trim().length > 0)
  );
}
function getJobSources(job = {}) {
  return Array.isArray(job.dataSources)
    ? job.dataSources.filter(Boolean)
    : job.dataSource?.type
      ? [job.dataSource]
      : [];
}
function isMeaningfulSource(source = {}) {
  return (
    !!source.type ||
    Object.entries(source).some(([key, value]) => 'type' !== key && hasConfiguredValue(value))
  );
}
function collectMissingFields(definition, values = {}, builtinRequired = []) {
  const missing = [];
  return (
    (definition?.params ?? [])
      .filter((param) => param.required)
      .forEach((param) => {
        hasConfiguredValue(values?.[param.key]) ||
          missing.push((param.label ?? param.key).toLowerCase());
      }),
    builtinRequired.forEach((key) => {
      hasConfiguredValue(values?.[key]) || missing.push(BUILTIN_FIELD_LABELS[key] ?? key);
    }),
    missing
  );
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
  outlet.innerHTML = getAutomationsHTML();
  // Move modals to body so position:fixed covers full viewport incl. titlebar
  document.getElementById('agent-modal-backdrop') &&
    document.body.appendChild(document.getElementById('agent-modal-backdrop'));
  document.getElementById('agent-confirm-overlay') &&
    document.body.appendChild(document.getElementById('agent-confirm-overlay'));
  const state = createAgentsPageState(),
    elements = {
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
      jobsListEl: document.getElementById('jobs-list'),
      addJobBtn: document.getElementById('add-job-btn'),
      jobsBadge: document.getElementById('jobs-count-badge'),
      confirmOverlay: document.getElementById('agent-confirm-overlay'),
      confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
      confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
      confirmNameEl: document.getElementById('confirm-agent-name'),
    },
    responseViewer = createResponseViewer(),
    historyModal = createHistoryModal({
      dataSourceTypes: DATA_SOURCE_TYPES,
      onOpenResponse: responseViewer.open,
    }),
    modelPicker = createModelPicker({
      state: state,
      primaryModelBtn: elements.primaryModelBtn,
      primaryModelLabel: elements.primaryModelLabel,
      primaryModelMenu: elements.primaryModelMenu,
    }),
    jobsController = createJobsController({
      state: state,
      jobsListEl: elements.jobsListEl,
      addJobBtn: elements.addJobBtn,
      jobsBadge: elements.jobsBadge,
      modalBodyEl: elements.modalBodyEl,
    });
  function renderGrid() {
    agentGrid.render(state.agents);
  }
  const confirmDialog = createConfirmDialog({
      state: state,
      overlayEl: elements.confirmOverlay,
      cancelBtn: elements.confirmCancelBtn,
      deleteBtn: elements.confirmDeleteBtn,
      nameEl: elements.confirmNameEl,
      onDelete: async (automationId) => {
        try {
          const response = await window.electronAPI?.invoke?.('delete-automation', automationId);
          if (!response?.ok)
            return void window.alert(
              response?.error ?? 'Unable to delete this automation right now.',
            );
          ((state.agents = state.agents.filter((automation) => automation.id !== automationId)),
            renderGrid());
        } catch (error) {
          window.alert(error.message ?? 'Unable to delete this automation right now.');
        }
      },
    }),
    agentGrid = createAgentGrid({
      gridEl: elements.gridEl,
      emptyEl: elements.emptyEl,
      dataSourceTypes: DATA_SOURCE_TYPES,
      resolveModelLabel: (providerId, modelId) =>
        resolveModelLabel(state.allModels, providerId, modelId),
      onToggleAgent: async ({ agent: agent, enabled: enabled, card: card }) => {
        const previousEnabled = agent.enabled;
        ((agent.enabled = enabled), card.classList.toggle('is-disabled', !enabled));
        try {
          const response = await window.electronAPI?.invoke?.(
            'toggle-automation',
            agent.id,
            enabled,
          );
          if (response?.ok) return;
          throw new Error(response?.error ?? 'Unable to update the automation right now.');
        } catch (error) {
          ((agent.enabled = previousEnabled),
            card.classList.toggle('is-disabled', !previousEnabled));
          const toggleInput = card.querySelector('.toggle-input');
          (toggleInput && (toggleInput.checked = previousEnabled),
            window.alert(error.message ?? 'Unable to update the automation right now.'));
        }
      },
      onRunAgent: async ({ agent: agent, button: button }) => {
        const originalLabel = button.innerHTML;
        (button.classList.add('is-running'),
          (button.disabled = !0),
          (button.innerHTML =
            '\n        <svg class="auto-run-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n          <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/>\n        </svg>'));
        try {
          const response = await window.electronAPI?.invoke?.('run-automation-now', agent.id);
          if (!response?.ok)
            throw new Error(response?.error ?? 'Unable to run this automation right now.');
          ((state.agents = await fetchAutomations()), renderGrid());
        } catch (error) {
          window.alert(error.message ?? 'Unable to run this automation right now.');
        } finally {
          (button.classList.remove('is-running'),
            (button.disabled = !1),
            (button.innerHTML = originalLabel));
        }
      },
      onOpenHistory: async (automation) => {
        ((state.agents = await fetchAutomations()),
          historyModal.open(state.agents.find((item) => item.id === automation.id) ?? automation));
      },
      onOpenModal: (automation) => openModal(automation),
      onOpenConfirm: (id, name) => confirmDialog.open(id, name),
    });
  async function fetchAutomations() {
    const response = await window.electronAPI?.invoke?.('get-automations').catch(() => null);
    return Array.isArray(response?.automations) ? response.automations : [];
  }
  async function openModal(automation = null) {
    ((state.editingId = automation?.id ?? null),
      (state.editingEnabled = automation?.enabled ?? !0),
      (state.primaryModel = automation?.primaryModel ? { ...automation.primaryModel } : null),
      (state.jobs = cloneJobsForEditing(automation)),
      elements.modalTitleEl &&
        (elements.modalTitleEl.textContent = automation
          ? t('automations.editAutomation')
          : t('automations.titleNew')),
      elements.nameInput && (elements.nameInput.value = automation?.name ?? ''),
      elements.descInput && (elements.descInput.value = automation?.description ?? ''),
      modelPicker.syncPrimaryModelLabel(),
      jobsController.renderJobsList(),
      elements.modalBackdrop?.classList.add('open'),
      document.body.classList.add('modal-open'),
      setTimeout(() => elements.nameInput?.focus(), 60));
  }
  function closeModal() {
    (elements.modalBackdrop?.classList.remove('open'),
      document.body.classList.remove('modal-open'),
      (state.editingId = null),
      modelPicker.closeMenu());
  }
  const onModalBackdropClick = (event) => {
      event.target === elements.modalBackdrop && closeModal();
    },
    onSaveClick = async () => {
      const name = elements.nameInput?.value.trim();
      if (!name)
        return (
          elements.nameInput?.animate(
            [{ borderColor: '#f87171' }, { borderColor: 'var(--border)' }],
            { duration: 900 },
          ),
          void elements.nameInput?.focus()
        );
      const configuredJobs = state.jobs
        .filter(
          (job) =>
            !(function (job = {}) {
              return !(
                String(job.name ?? '').trim() ||
                String(job.instruction ?? '').trim() ||
                getJobSources(job).some(isMeaningfulSource) ||
                (function (output = {}) {
                  return (
                    !!output.type ||
                    Object.entries(output).some(
                      ([key, value]) => 'type' !== key && hasConfiguredValue(value),
                    )
                  );
                })(job.output ?? {})
              );
            })(job),
        )
        .map(sanitizeJobForSave);
      if (
        configuredJobs.length > 0 &&
        (!state.primaryModel?.provider || !state.primaryModel?.modelId)
      )
        return (
          elements.primaryModelBtn?.animate(
            [{ borderColor: '#f87171' }, { borderColor: 'var(--border)' }],
            { duration: 900 },
          ),
          elements.primaryModelBtn?.focus(),
          void window.alert('Choose a primary model before saving an automation with jobs.')
        );
      const invalidJobMessage = configuredJobs
        .map((job, index) =>
          (function (job, index) {
            const jobName = job.name?.trim() || `Job ${index + 1}`,
              sources = getJobSources(job);
            if (!sources.length || !sources.some((source) => source?.type))
              return `${jobName}: choose at least one data source.`;
            for (const source of sources) {
              if (!source?.type)
                return `${jobName}: remove the unfinished data source or choose its type.`;
              const definition = DATA_SOURCE_TYPES.find((item) => item.value === source.type),
                missing = collectMissingFields(
                  definition,
                  source,
                  BUILTIN_REQUIRED_DATA_SOURCE_FIELDS[source.type] ?? [],
                );
              if (missing.length)
                return `${jobName}: ${definition?.label ?? source.type} is missing ${missing.join(', ')}.`;
            }
            if (!job.output?.type) return `${jobName}: choose what to do with the result.`;
            const outputDefinition = OUTPUT_TYPES.find((item) => item.value === job.output.type),
              outputMissing = collectMissingFields(
                outputDefinition,
                job.output,
                BUILTIN_REQUIRED_OUTPUT_FIELDS[job.output.type] ?? [],
              );
            return outputMissing.length
              ? `${jobName}: ${outputDefinition?.label ?? job.output.type} is missing ${outputMissing.join(', ')}.`
              : null;
          })(job, index),
        )
        .find(Boolean);
      if (invalidJobMessage) return void window.alert(invalidJobMessage);
      const payload = {
        id: state.editingId ?? generateAgentId(),
        name: name,
        description: elements.descInput?.value.trim() ?? '',
        enabled: state.editingEnabled,
        primaryModel: state.primaryModel ? { ...state.primaryModel } : null,
        jobs: configuredJobs,
      };
      ((elements.saveBtn.disabled = !0), (elements.saveBtn.textContent = t('automations.saving')));
      try {
        const response = await window.electronAPI?.invoke?.('save-automation', payload);
        if (!response?.ok)
          throw new Error(response?.error ?? 'Unable to save this automation right now.');
        const nextAutomation = response.automation ?? payload,
          existingIndex = state.agents.findIndex((automation) => automation.id === payload.id);
        (existingIndex >= 0
          ? (state.agents[existingIndex] = nextAutomation)
          : state.agents.push(nextAutomation),
          renderGrid(),
          closeModal());
      } catch (error) {
        window.alert(error.message ?? 'Unable to save this automation right now.');
      } finally {
        ((elements.saveBtn.disabled = !1),
          (elements.saveBtn.textContent = t('automations.saveAutomation')));
      }
    },
    onEscapeKey = (event) => {
      'Escape' === event.key &&
        (closeModal(), confirmDialog.close(), historyModal.close(), responseViewer.close());
    },
    onCreateClick = () => openModal();
  return (
    elements.addAgentHeaderBtn?.addEventListener('click', onCreateClick),
    elements.addAgentEmptyBtn?.addEventListener('click', onCreateClick),
    elements.modalCloseBtn?.addEventListener('click', closeModal),
    elements.cancelBtn?.addEventListener('click', closeModal),
    elements.modalBackdrop?.addEventListener('click', onModalBackdropClick),
    elements.saveBtn?.addEventListener('click', onSaveClick),
    document.addEventListener('keydown', onEscapeKey),
    (async function () {
      (await loadAutomationsFeatureRegistry(),
        await (async function () {
          try {
            const providers = (await window.electronAPI?.invoke?.('get-models')) ?? [];
            ((state.allModels = []),
              providers.forEach((provider) => {
                provider.configured &&
                  Object.entries(provider.models ?? {}).forEach(([modelId, info]) => {
                    state.allModels.push({
                      providerId: provider.provider,
                      provider: provider.label ?? provider.provider,
                      modelId: modelId,
                      modelName: info.name ?? modelId,
                      description: info.description ?? '',
                      rank: info.rank ?? 999,
                    });
                  });
              }),
              state.allModels.sort((left, right) => left.rank - right.rank));
          } catch (error) {
            (console.warn('[Automations] Could not load models:', error), (state.allModels = []));
          }
        })(),
        (state.agents = await fetchAutomations()),
        renderGrid());
    })().catch((error) => {
      console.error('[Automations] Failed to load page data:', error);
    }),
    function () {
      (document.removeEventListener('keydown', onEscapeKey),
        elements.addAgentHeaderBtn?.removeEventListener('click', onCreateClick),
        elements.addAgentEmptyBtn?.removeEventListener('click', onCreateClick),
        elements.modalCloseBtn?.removeEventListener('click', closeModal),
        elements.cancelBtn?.removeEventListener('click', closeModal),
        elements.modalBackdrop?.removeEventListener('click', onModalBackdropClick),
        elements.saveBtn?.removeEventListener('click', onSaveClick),
        agentGrid.clear(),
        jobsController.cleanup(),
        modelPicker.cleanup(),
        confirmDialog.cleanup(),
        closeModal(),
        confirmDialog.close(),
        historyModal.close(),
        responseViewer.close(),
        elements.modalBackdrop?.remove(),
        elements.confirmOverlay?.remove(),
        historyModal.destroy(),
        responseViewer.destroy());
    }
  );
}
