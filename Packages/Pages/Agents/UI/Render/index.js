import { createConfirmDialog } from './Components/ConfirmDialog.js';
import { createModelPicker } from './Components/ModelPicker.js';
import { createResponseViewer } from './Components/ResponseViewer.js';
import { generateAgentId, resolveModelLabel } from './Utils/Utils.js';
import { getAgentsHTML } from './Templates/Template.js';
import { t } from '../../../../System/I18n/index.js';
import { createCardPool } from '../../../../System/CardPool.js';
import { state as appState } from '../../../../System/State.js';
const SCHEDULE_OPTIONS = [
  { minutes: 1, key: 'schedule1min' },
  { minutes: 5, key: 'schedule5min' },
  { minutes: 15, key: 'schedule15min' },
  { minutes: 30, key: 'schedule30min' },
  { minutes: 60, key: 'schedule1hour' },
  { minutes: 120, key: 'schedule2hours' },
  { minutes: 240, key: 'schedule4hours' },
  { minutes: 480, key: 'schedule8hours' },
  { minutes: 1440, key: 'schedule24hours' },
];
function formatSchedule(trigger = {}) {
  const minutes = Math.max(1, parseInt(trigger.minutes, 10) || 30),
    preset = SCHEDULE_OPTIONS.find((option) => option.minutes === minutes);
  return preset
    ? t(`agents.${preset.key}`)
    : minutes < 60
      ? t('agents.scheduleEveryXMin', { n: minutes })
      : t('agents.scheduleEveryXHour', { n: minutes / 60 });
}
function truncate(text, limit = 180) {
  const normalized = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 3)}...`;
}
function normalizeWorkspacePath(workspacePath) {
  return String(workspacePath ?? '').trim() || null;
}
function cloneProjectSnapshot(project) {
  return project?.rootPath
    ? {
        id: project.id ?? null,
        name: project.name ?? 'Workspace',
        rootPath: project.rootPath,
        context: project.context ?? '',
      }
    : null;
}
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso);
  return diff < 3e4
    ? t('agents.justNow')
    : diff < 12e4
      ? `${Math.floor(diff / 1e3)}s ago`
      : diff < 72e5
        ? `${Math.floor(diff / 6e4)}m ago`
        : diff < 1728e5
          ? `${Math.floor(diff / 36e5)}h ago`
          : new Date(iso).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
}
export function mount(outlet) {
  outlet.innerHTML = getAgentsHTML();
  // Move modals to body so position:fixed covers full viewport incl. titlebar
  document.getElementById('agent-modal-backdrop') &&
    document.body.appendChild(document.getElementById('agent-modal-backdrop'));
  document.getElementById('agent-confirm-overlay') &&
    document.body.appendChild(document.getElementById('agent-confirm-overlay'));
  const state = {
      agents: [],
      allModels: [],
      editingId: null,
      deletingId: null,
      editingEnabled: !0,
      primaryModel: null,
      boundWorkspacePath: null,
      boundProject: null,
    },
    elements = {
      gridEl: document.getElementById('agents-grid'),
      emptyEl: document.getElementById('agents-empty'),
      addHeaderBtn: document.getElementById('add-agent-header-btn'),
      addEmptyBtn: document.getElementById('add-agent-empty-btn'),
      modalBackdrop: document.getElementById('agent-modal-backdrop'),
      modalTitleEl: document.getElementById('agent-modal-title-text'),
      modalCloseBtn: document.getElementById('agent-modal-close'),
      cancelBtn: document.getElementById('agent-cancel-btn'),
      saveBtn: document.getElementById('agent-save-btn'),
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
      confirmOverlay: document.getElementById('agent-confirm-overlay'),
      confirmCancelBtn: document.getElementById('agent-confirm-cancel'),
      confirmDeleteBtn: document.getElementById('agent-confirm-delete'),
      confirmNameEl: document.getElementById('agent-confirm-name'),
    },
    responseViewer = createResponseViewer(),
    historyModal = (function ({ onOpenResponse: onOpenResponse }) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML =
        '\n    <div id="agent-history-backdrop">\n      <div id="agent-history-modal">\n        <div class="agent-history-header">\n          <div>\n            <div class="agent-modal-eyebrow">Run History</div>\n            <h2 id="agent-history-title">Agent</h2>\n          </div>\n          <button class="settings-modal-close" id="agent-history-close" type="button" aria-label="Close">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n            </svg>\n          </button>\n        </div>\n        <div id="agent-history-body" class="agent-history-body"></div>\n      </div>\n    </div>';
      const backdropEl = wrapper.firstElementChild;
      document.body.appendChild(backdropEl);
      const titleEl = backdropEl.querySelector('#agent-history-title'),
        bodyEl = backdropEl.querySelector('#agent-history-body'),
        closeBtn = backdropEl.querySelector('#agent-history-close');
      function close() {
        backdropEl.classList.remove('open');
      }
      const onBackdropClick = (event) => {
        event.target === backdropEl && close();
      };
      return (
        closeBtn.addEventListener('click', close),
        backdropEl.addEventListener('click', onBackdropClick),
        {
          open: function (agent) {
            ((titleEl.textContent = agent.name), (bodyEl.innerHTML = ''));
            const history = Array.isArray(agent.history) ? agent.history : [];
            if (!history.length) {
              const hintEl = document.createElement('div');
              return (
                (hintEl.className = 'agent-history-empty'),
                (hintEl.innerHTML =
                  '\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"\n          style="width:28px;height:28px;opacity:0.35">\n          <path d="M12 8v4l3 3" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/>\n        </svg>\n        <p>No runs recorded yet.<br>Use Run Now to execute this agent immediately.</p>'),
                bodyEl.appendChild(hintEl),
                void backdropEl.classList.add('open')
              );
            }
            const section = document.createElement('div');
            ((section.className = 'agent-history-job'),
              (section.innerHTML = `\n      <div class="agent-history-job-header">\n        <span class="agent-history-job-name">Scheduled runs</span>\n        <span class="agent-history-job-trigger">${formatSchedule(agent.trigger)}</span>\n        <span class="agent-history-job-count">${history.length} run${1 !== history.length ? 's' : ''}</span>\n      </div>`),
              history.forEach((entry) => {
                const statusClass = entry.error ? 'error' : 'acted',
                  statusLabel = entry.error ? 'Error' : 'Completed',
                  row = document.createElement('div');
                ((row.className = `agent-history-entry agent-history-entry--${statusClass}`),
                  (row.innerHTML = `\n        <div class="agent-history-entry-row">\n          <div class="agent-history-entry-left">\n            <span class="agent-history-entry-time">${timeAgo(entry.timestamp)}</span>\n            <span class="agent-history-entry-datetime">${new Date(entry.timestamp).toLocaleString()}</span>\n          </div>\n          <div class="agent-history-entry-right">\n            <span class="agent-history-entry-status agent-history-entry-status--${statusClass}">${statusLabel}</span>\n            ${entry.fullResponse || entry.summary ? '<button class="agent-history-view-btn" type="button">View</button>' : ''}\n          </div>\n        </div>\n        ${entry.error ? `<div class="agent-history-entry-error">${entry.error}</div>` : entry.summary ? `<div class="agent-history-entry-nothing">${truncate(entry.summary, 220)}</div>` : ''}`),
                  row
                    .querySelector('.agent-history-view-btn')
                    ?.addEventListener('click', (event) => {
                      (event.stopPropagation(), onOpenResponse(entry, agent.name));
                    }),
                  section.appendChild(row));
              }),
              bodyEl.appendChild(section),
              backdropEl.classList.add('open'));
          },
          close: close,
          destroy() {
            (closeBtn.removeEventListener('click', close),
              backdropEl.removeEventListener('click', onBackdropClick),
              backdropEl.remove());
          },
        }
      );
    })({ onOpenResponse: responseViewer.open }),
    modelPicker = createModelPicker({
      state: state,
      primaryModelBtn: elements.primaryModelBtn,
      primaryModelLabel: elements.primaryModelLabel,
      primaryModelMenu: elements.primaryModelMenu,
    });
  function getCurrentWorkspaceBinding() {
    const activeProject = cloneProjectSnapshot(appState.activeProject),
      workspacePath = normalizeWorkspacePath(activeProject?.rootPath ?? appState.workspacePath);
    return {
      workspacePath: workspacePath,
      project: activeProject && activeProject.rootPath === workspacePath ? activeProject : null,
    };
  }
  function applyWorkspaceBinding(workspacePath, project = void 0) {
    if (
      ((state.boundWorkspacePath = normalizeWorkspacePath(workspacePath)),
      !state.boundWorkspacePath)
    )
      return void (state.boundProject = null);
    if (void 0 !== project) return void (state.boundProject = cloneProjectSnapshot(project));
    if (state.boundProject?.rootPath === state.boundWorkspacePath)
      return void (state.boundProject = cloneProjectSnapshot(state.boundProject));
    const current = getCurrentWorkspaceBinding();
    state.boundProject =
      current.project?.rootPath === state.boundWorkspacePath ? current.project : null;
  }
  function syncWorkspaceBindingUI() {
    const current = getCurrentWorkspaceBinding(),
      hasBoundWorkspace = Boolean(state.boundWorkspacePath),
      hasCurrentWorkspace = Boolean(current.workspacePath);
    var workspacePath;
    (elements.workspacePanel &&
      elements.workspacePanel.classList.toggle('is-empty', !hasBoundWorkspace),
      elements.workspaceTitle &&
        (elements.workspaceTitle.textContent = hasBoundWorkspace
          ? state.boundProject
            ? state.boundProject.name || t('agents.boundProject')
            : t('agents.boundFolder')
          : t('agents.noWorkspaceTitle')),
      elements.workspacePath &&
        ((elements.workspacePath.textContent = hasBoundWorkspace
          ? state.boundWorkspacePath
          : t('agents.noWorkspaceDesc')),
        (elements.workspacePath.title = hasBoundWorkspace ? state.boundWorkspacePath : '')),
      elements.workspaceCurrentBtn &&
        ((elements.workspaceCurrentBtn.disabled = !hasCurrentWorkspace),
        (elements.workspaceCurrentBtn.textContent = current.project
          ? t('agents.useCurrentProject')
          : hasCurrentWorkspace
            ? t('agents.useCurrentFolder')
            : t('agents.noCurrentWorkspace')),
        (elements.workspaceCurrentBtn.title = hasCurrentWorkspace
          ? (workspacePath = current.workspacePath)
            ? workspacePath.length > 64
              ? `...${workspacePath.slice(-61)}`
              : workspacePath
            : ''
          : t('agents.noCurrentWorkspaceHint'))),
      elements.workspaceClearBtn && (elements.workspaceClearBtn.disabled = !hasBoundWorkspace));
  }
  async function fetchAgents() {
    const response = await window.electronAPI?.invoke?.('get-agents').catch(() => null);
    return Array.isArray(response?.agents) ? response.agents : [];
  }
  const confirmDialog = createConfirmDialog({
      state: state,
      overlayEl: elements.confirmOverlay,
      cancelBtn: elements.confirmCancelBtn,
      deleteBtn: elements.confirmDeleteBtn,
      nameEl: elements.confirmNameEl,
      onDelete: async (agentId) => {
        const response = await window.electronAPI?.invoke?.('delete-agent', agentId);
        response?.ok
          ? ((state.agents = state.agents.filter((agent) => agent.id !== agentId)),
            grid.render(state.agents))
          : window.alert(response?.error ?? 'Unable to delete this agent right now.');
      },
    }),
    grid = (function ({
      gridEl: gridEl,
      emptyEl: emptyEl,
      resolveModelName: resolveModelName,
      onToggle: onToggle,
      onRun: onRun,
      onHistory: onHistory,
      onEdit: onEdit,
      onDelete: onDelete,
    }) {
      const pool = createCardPool({
        container: gridEl,
        createCard: function () {
          const card = document.createElement('div');
          return (
            (card.className = 'agent-card'),
            (card._currentAgent = null),
            (card.innerHTML =
              '\n      <div class="agent-card-head">\n        <div class="agent-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/></svg></div>\n        <div class="agent-card-info">\n          <div class="agent-name"></div>\n          <div class="agent-desc" style="display:none"></div>\n        </div>\n        <label class="agent-toggle" title="">\n          <input type="checkbox" class="toggle-input"><div class="agent-toggle-track"></div>\n        </label>\n      </div>\n      <div class="agent-meta">\n        <span class="agent-trigger-tag">\n          <span class="agent-trigger-icon" aria-hidden="true">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 8v4l3 3" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/></svg>\n          </span>\n          <span class="agent-trigger-text"></span>\n        </span>\n        <div class="agent-card-actions-summary">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4" stroke-linecap="round"/></svg>\n          <span class="agent-actions-text"></span>\n        </div>\n        <div class="agent-prompt-preview"></div>\n        <div class="agent-lastrun" style="display:none"></div>\n      </div>\n      <div class="agent-card-footer">\n        <button class="agent-card-btn run-btn" title="Run now">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></button>\n        <button class="agent-card-btn history-btn" title="View history">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v4l3 3" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/></svg></button>\n        <button class="agent-card-btn edit-btn" title="Edit agent">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round"/></svg></button>\n        <button class="agent-card-btn danger delete-btn" title="Delete agent">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>\n      </div>'),
            card.querySelector('.toggle-input')?.addEventListener('change', (event) => {
              card._currentAgent && onToggle(card._currentAgent, event.target.checked, card);
            }),
            card.querySelector('.run-btn')?.addEventListener('click', () => {
              card._currentAgent && onRun(card._currentAgent, card.querySelector('.run-btn'));
            }),
            card.querySelector('.history-btn')?.addEventListener('click', () => {
              card._currentAgent && onHistory(card._currentAgent);
            }),
            card.querySelector('.edit-btn')?.addEventListener('click', () => {
              card._currentAgent && onEdit(card._currentAgent);
            }),
            card.querySelector('.delete-btn')?.addEventListener('click', () => {
              card._currentAgent && onDelete(card._currentAgent.id, card._currentAgent.name);
            }),
            card
          );
        },
        updateCard: function (card, agent) {
          ((card._currentAgent = agent),
            (card.className = 'agent-card' + (agent.enabled ? '' : ' is-disabled')),
            (card.querySelector('.agent-name').textContent = agent.name),
            (card.querySelector('.toggle-input').checked = agent.enabled),
            (card.querySelector('.agent-toggle').title = agent.enabled
              ? t('agents.enabled')
              : t('agents.disabled')),
            (card.querySelector('.agent-trigger-text').textContent = formatSchedule(agent.trigger)),
            (card.querySelector('.agent-actions-text').textContent =
              resolveModelName(agent.primaryModel?.provider, agent.primaryModel?.modelId) ||
              t('agents.noModel')),
            (card.querySelector('.agent-prompt-preview').textContent =
              truncate(agent.prompt, 200) || t('agents.noPromptSet')));
          const descEl = card.querySelector('.agent-desc');
          agent.description
            ? ((descEl.style.display = ''), (descEl.textContent = agent.description))
            : (descEl.style.display = 'none');
          const lastRunEl = card.querySelector('.agent-lastrun');
          agent.lastRun
            ? ((lastRunEl.style.display = ''),
              (lastRunEl.textContent = t('agents.lastRun', { time: timeAgo(agent.lastRun) })))
            : (lastRunEl.style.display = 'none');
        },
        getKey: (agent) => agent.id,
      });
      return {
        render: function (agents) {
          if (!agents.length) return ((emptyEl.hidden = !1), void (gridEl.hidden = !0));
          ((emptyEl.hidden = !0), (gridEl.hidden = !1), pool.render(agents));
        },
        clear() {
          pool.clear();
        },
      };
    })({
      gridEl: elements.gridEl,
      emptyEl: elements.emptyEl,
      resolveModelName: (providerId, modelId) =>
        resolveModelLabel(state.allModels, providerId, modelId),
      onToggle: async (agent, enabled, card) => {
        const previousEnabled = agent.enabled;
        ((agent.enabled = enabled), card.classList.toggle('is-disabled', !enabled));
        try {
          const response = await window.electronAPI?.invoke?.('toggle-agent', agent.id, enabled);
          if (!response?.ok) throw new Error(response?.error ?? 'Unable to update this agent.');
        } catch (error) {
          ((agent.enabled = previousEnabled),
            card.classList.toggle('is-disabled', !previousEnabled));
          const toggleInput = card.querySelector('.toggle-input');
          (toggleInput && (toggleInput.checked = previousEnabled),
            window.alert(error.message ?? 'Unable to update this agent.'));
        }
      },
      onRun: async (agent, button) => {
        const originalLabel = button.innerHTML;
        ((button.disabled = !0),
          button.classList.add('is-running'),
          (button.innerHTML =
            '\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite">\n          <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/>\n        </svg>\n        Running'));
        try {
          const response = await window.electronAPI?.invoke?.('run-agent-now', agent.id);
          if (!response?.ok)
            throw new Error(response?.error ?? 'Unable to run this agent right now.');
          ((state.agents = await fetchAgents()), grid.render(state.agents));
        } catch (error) {
          window.alert(error.message ?? 'Unable to run this agent right now.');
        } finally {
          ((button.disabled = !1),
            button.classList.remove('is-running'),
            (button.innerHTML = originalLabel));
        }
      },
      onHistory: async (agent) => {
        ((state.agents = await fetchAgents()),
          historyModal.open(state.agents.find((item) => item.id === agent.id) ?? agent));
      },
      onEdit: (agent) => openModal(agent),
      onDelete: (id, name) => confirmDialog.open(id, name),
    });
  function openModal(agent = null) {
    ((state.editingId = agent?.id ?? null),
      (state.editingEnabled = agent?.enabled ?? !0),
      (state.primaryModel = agent?.primaryModel ? { ...agent.primaryModel } : null),
      applyWorkspaceBinding(
        agent?.workspacePath ?? agent?.project?.rootPath ?? null,
        agent?.project,
      ),
      elements.modalTitleEl &&
        (elements.modalTitleEl.textContent = agent ? t('agents.editAgent') : t('agents.newAgent')),
      elements.nameInput && (elements.nameInput.value = agent?.name ?? ''),
      elements.descInput && (elements.descInput.value = agent?.description ?? ''),
      elements.promptInput && (elements.promptInput.value = agent?.prompt ?? ''),
      elements.scheduleSelect &&
        (elements.scheduleSelect.value = String(agent?.trigger?.minutes ?? 30)),
      modelPicker.syncPrimaryModelLabel(),
      syncWorkspaceBindingUI(),
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
  async function saveModal() {
    const name = elements.nameInput?.value.trim(),
      prompt = elements.promptInput?.value.trim();
    if (!name) return void elements.nameInput?.focus();
    if (!prompt) return void elements.promptInput?.focus();
    if (!state.primaryModel?.provider || !state.primaryModel?.modelId)
      return (elements.primaryModelBtn?.focus(), void window.alert(t('agents.selectModelAlert')));
    const minutes = Math.max(1, parseInt(elements.scheduleSelect?.value, 10) || 30),
      payload = {
        id: state.editingId ?? generateAgentId(),
        name: name,
        description: elements.descInput?.value.trim() ?? '',
        prompt: prompt,
        enabled: state.editingEnabled,
        primaryModel: { ...state.primaryModel },
        trigger: { type: 'interval', minutes: minutes },
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
    ((elements.saveBtn.disabled = !0), (elements.saveBtn.textContent = t('agents.saving')));
    try {
      const response = await window.electronAPI?.invoke?.('save-agent', payload);
      if (!response?.ok) throw new Error(response?.error ?? 'Unable to save this agent right now.');
      const nextAgent = response.agent ?? payload,
        existingIndex = state.agents.findIndex((agent) => agent.id === nextAgent.id);
      (existingIndex >= 0
        ? (state.agents[existingIndex] = nextAgent)
        : state.agents.push(nextAgent),
        grid.render(state.agents),
        closeModal());
    } catch (error) {
      window.alert(error.message ?? 'Unable to save this agent right now.');
    } finally {
      ((elements.saveBtn.disabled = !1), (elements.saveBtn.textContent = t('agents.saveAgent')));
    }
  }
  const onEscapeKey = (event) => {
      'Escape' === event.key &&
        (closeModal(), confirmDialog.close(), historyModal.close(), responseViewer.close());
    },
    onBackdropClick = (event) => {
      event.target === elements.modalBackdrop && closeModal();
    },
    onCreateClick = () => openModal(),
    onPickWorkspaceClick = async () => {
      const defaultPath =
          state.boundWorkspacePath ?? getCurrentWorkspaceBinding().workspacePath ?? void 0,
        response = await window.electronAPI?.invoke?.('select-directory', {
          defaultPath: defaultPath,
        });
      response?.ok &&
        response.path &&
        (applyWorkspaceBinding(response.path), syncWorkspaceBindingUI());
    },
    onUseCurrentWorkspaceClick = () => {
      const current = getCurrentWorkspaceBinding();
      current.workspacePath &&
        (applyWorkspaceBinding(current.workspacePath, current.project), syncWorkspaceBindingUI());
    },
    onClearWorkspaceClick = () => {
      (applyWorkspaceBinding(null, null), syncWorkspaceBindingUI());
    },
    onWorkspaceChanged = () => syncWorkspaceBindingUI();
  return (
    elements.addHeaderBtn?.addEventListener('click', onCreateClick),
    elements.addEmptyBtn?.addEventListener('click', onCreateClick),
    elements.modalCloseBtn?.addEventListener('click', closeModal),
    elements.cancelBtn?.addEventListener('click', closeModal),
    elements.workspacePickBtn?.addEventListener('click', onPickWorkspaceClick),
    elements.workspaceCurrentBtn?.addEventListener('click', onUseCurrentWorkspaceClick),
    elements.workspaceClearBtn?.addEventListener('click', onClearWorkspaceClick),
    elements.saveBtn?.addEventListener('click', saveModal),
    elements.modalBackdrop?.addEventListener('click', onBackdropClick),
    document.addEventListener('keydown', onEscapeKey),
    window.addEventListener('jo:workspace-changed', onWorkspaceChanged),
    window.addEventListener('jo:project-changed', onWorkspaceChanged),
    (async function () {
      (await (async function () {
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
          (console.warn('[Agents] Could not load models:', error), (state.allModels = []));
        }
      })(),
        (state.agents = await fetchAgents()),
        grid.render(state.agents));
    })().catch((error) => {
      console.error('[Agents] Failed to load page data:', error);
    }),
    function () {
      (document.removeEventListener('keydown', onEscapeKey),
        elements.addHeaderBtn?.removeEventListener('click', onCreateClick),
        elements.addEmptyBtn?.removeEventListener('click', onCreateClick),
        elements.modalCloseBtn?.removeEventListener('click', closeModal),
        elements.cancelBtn?.removeEventListener('click', closeModal),
        elements.workspacePickBtn?.removeEventListener('click', onPickWorkspaceClick),
        elements.workspaceCurrentBtn?.removeEventListener('click', onUseCurrentWorkspaceClick),
        elements.workspaceClearBtn?.removeEventListener('click', onClearWorkspaceClick),
        elements.saveBtn?.removeEventListener('click', saveModal),
        elements.modalBackdrop?.removeEventListener('click', onBackdropClick),
        window.removeEventListener('jo:workspace-changed', onWorkspaceChanged),
        window.removeEventListener('jo:project-changed', onWorkspaceChanged),
        grid.clear(),
        modelPicker.cleanup(),
        confirmDialog.cleanup(),
        closeModal(),
        confirmDialog.close(),
        elements.modalBackdrop?.remove(),
        elements.confirmOverlay?.remove(),
        historyModal.close(),
        historyModal.destroy(),
        responseViewer.close(),
        responseViewer.destroy());
    }
  );
}
