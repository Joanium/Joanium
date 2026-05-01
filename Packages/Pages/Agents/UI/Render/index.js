import { getAgentsHTML } from './Templates/AgentsTemplate.js';
import { openConfirm } from '../../../../System/ConfirmDialog.js';
import { createAgentAvatarDataUri } from '../../../../System/Agents/Avatar.js';
import {
  BUILT_IN_SLASH_COMMAND_IDS,
  sanitizeSlashCommandId,
} from '../../../../System/Agents/CommandId.js';
import {
  buildCronExpressionFromEditor,
  describeSchedule,
  isValidCronExpression,
} from '../../../../System/Agents/Schedule.js';
import {
  STATIC_CONNECTORS,
  STATIC_FREE_CONNECTORS,
} from '../../../Shared/Connectors/Catalog/ConnectorDefs.js';

let _allAgents = [];
let _projects = [];
let _templates = [];
let _providers = [];
let _editingId = null;
let _searchQuery = '';
let _runningAgentIds = new Set();
let _refreshTimer = null;
let _allRuns = [];
let _historyFilterAgentId = '';
let _activeTab = 'agents';

let grid = null;
let emptyEl = null;
let searchWrapper = null;
let searchInput = null;
let searchClearBtn = null;
let addBtn = null;
let createFirstBtn = null;
let warningEl = null;
let totalCountEl = null; // unused
let enabledCountEl = null; // unused
let scheduledCountEl = null; // unused
let modalBackdrop = null;
let modalEyebrow = null;
let modalTitle = null;
let modalClose = null;
let modalCancel = null;
let modalSave = null;
let modalStatus = null;
let avatarPreview = null;
let nameInput = null;
let nameHint = null;
let descriptionInput = null;
let promptInput = null;
let enabledInput = null;
let triggerTypeInput = null;
let scheduleEditorWrap = null;
let scheduleModeInput = null;
let intervalMinutesInput = null;
let hourlyMinuteInput = null;
let dailyHourInput = null;
let dailyMinuteInput = null;
let weeklyDayInput = null;
let weeklyHourInput = null;
let weeklyMinuteInput = null;
let customCronInput = null;
let schedulePreview = null;
let cronPreview = null;
let primaryModelInput = null;
let fallbackModel1Input = null;
let fallbackModel2Input = null;
let workspaceSelect = null;
let workspaceHint = null;
let tabAgentsBtn = null;
let tabHistoryBtn = null;
let viewAgentsEl = null;
let viewHistoryEl = null;
let historyFilterSelect = null;
let historyAllBody = null;
let historyViewLoading = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRelative(iso) {
  if (!iso) return 'Never';
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

function formatTimestamp(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function providerLabel(provider = {}) {
  return String(provider?.label ?? provider?.name ?? provider?.provider ?? 'Provider');
}

function modelValue(ref = null) {
  const provider = String(ref?.provider ?? '').trim();
  const modelId = String(ref?.modelId ?? '').trim();
  return provider && modelId ? `${provider}::${modelId}` : '';
}

function parseModelValue(value = '') {
  const [provider, modelId] = String(value ?? '').split('::');
  return provider && modelId ? { provider, modelId } : null;
}

function configuredProviders() {
  return _providers.filter((provider) => provider?.configured);
}

function allModelOptions() {
  return configuredProviders().flatMap((provider) =>
    Object.entries(provider.models ?? {}).map(([modelId, meta]) => ({
      value: `${provider.provider}::${modelId}`,
      label: `${providerLabel(provider)} · ${meta?.name ?? modelId}`,
    })),
  );
}

async function resolveDefaultPrimaryModel() {
  const providers = configuredProviders();
  if (providers.length < 1) return null;
  const user = await window.electronAPI?.invoke?.('get-user');
  const savedProviderId = user?.preferences?.default_provider ?? null;
  const savedModelId = user?.preferences?.default_model ?? null;
  if (savedProviderId && savedModelId) {
    const found = providers.find(
      (provider) => provider.provider === savedProviderId && provider.models?.[savedModelId],
    );
    if (found) return { provider: found.provider, modelId: savedModelId };
  }
  const first = providers[0];
  const firstModelId = Object.keys(first.models ?? {})[0] ?? null;
  return firstModelId ? { provider: first.provider, modelId: firstModelId } : null;
}

function reservedIds(editingId = null) {
  const connectorIds = [...STATIC_CONNECTORS, ...STATIC_FREE_CONNECTORS]
    .map((connector) => sanitizeSlashCommandId(connector?.id))
    .filter(Boolean);
  return new Set([
    ...BUILT_IN_SLASH_COMMAND_IDS,
    ...connectorIds,
    ..._templates.map((template) => sanitizeSlashCommandId(template?.id ?? '')),
    ..._allAgents
      .map((agent) => sanitizeSlashCommandId(agent?.id ?? agent?.name ?? ''))
      .filter((id) => id && id !== editingId),
  ]);
}

function validateName(raw) {
  const id = sanitizeSlashCommandId(raw);
  if (!id || id.length < 2) return { ok: false, id, message: 'Use at least 2 letters or numbers.' };
  if (reservedIds(_editingId).has(id))
    return { ok: false, id, message: `/${id} is already taken.` };
  return { ok: true, id, message: `Available as /${id}` };
}

function currentScheduleEditor() {
  return {
    mode: String(scheduleModeInput?.value ?? 'interval'),
    intervalMinutes: Number(intervalMinutesInput?.value ?? 15) || 15,
    minute:
      'hourly' === scheduleModeInput?.value
        ? Number(hourlyMinuteInput?.value ?? 0) || 0
        : 'daily' === scheduleModeInput?.value
          ? Number(dailyMinuteInput?.value ?? 0) || 0
          : 'weekly' === scheduleModeInput?.value
            ? Number(weeklyMinuteInput?.value ?? 0) || 0
            : 0,
    hour:
      'daily' === scheduleModeInput?.value
        ? Number(dailyHourInput?.value ?? 9) || 9
        : 'weekly' === scheduleModeInput?.value
          ? Number(weeklyHourInput?.value ?? 9) || 9
          : 0,
    weekday: Number(weeklyDayInput?.value ?? 1) || 1,
    expression: String(customCronInput?.value ?? '').trim(),
  };
}

function currentSchedule() {
  if ('on_startup' === triggerTypeInput?.value)
    return { type: 'on_startup', label: 'On app startup' };
  const editor = currentScheduleEditor();
  const expression = buildCronExpressionFromEditor(editor);
  return {
    type: 'cron',
    expression,
    editor,
    label: describeSchedule({ type: 'cron', expression, editor }),
  };
}

function updateScheduleUi() {
  const onSchedule = 'cron' === triggerTypeInput?.value;
  scheduleEditorWrap.hidden = !onSchedule;
  scheduleEditorWrap
    .querySelectorAll('[data-mode]')
    .forEach((section) => (section.hidden = section.dataset.mode !== scheduleModeInput.value));
  const schedule = currentSchedule();
  schedulePreview.textContent = describeSchedule(schedule);
  if (cronPreview) cronPreview.hidden = true;
}

function setModalStatus(message = '', tone = 'info') {
  if (!modalStatus) return;
  if (!message) {
    modalStatus.hidden = true;
    modalStatus.textContent = '';
    modalStatus.className = 'agents-modal-status';
    return;
  }
  modalStatus.hidden = false;
  modalStatus.textContent = message;
  modalStatus.className = `agents-modal-status agents-modal-status--${tone}`;
}

function updateNameUi() {
  const validation = validateName(nameInput?.value ?? '');
  nameHint.textContent = validation.message;
  nameHint.className = `agents-input-hint ${validation.ok ? 'agents-input-hint--ok' : 'agents-input-hint--error'}`;
  avatarPreview.src = createAgentAvatarDataUri(validation.id || nameInput?.value || 'agent', 96);
  return validation;
}

function resetModelSelect(selectEl, selectedValue = '') {
  if (!selectEl) return;
  const options = allModelOptions();
  selectEl.innerHTML = `<option value="">None</option>${options
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`,
    )
    .join('')}`;
  selectEl.value =
    selectedValue && options.some((option) => option.value === selectedValue) ? selectedValue : '';
}

function renderModelSelects(agent = null, defaultPrimary = null) {
  const primaryValue = modelValue(agent?.primaryModel ?? defaultPrimary);
  primaryModelInput.innerHTML = allModelOptions()
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`,
    )
    .join('');
  primaryModelInput.value =
    primaryValue && allModelOptions().some((option) => option.value === primaryValue)
      ? primaryValue
      : (allModelOptions()[0]?.value ?? '');
  resetModelSelect(fallbackModel1Input, modelValue(agent?.fallbackModels?.[0] ?? null));
  resetModelSelect(fallbackModel2Input, modelValue(agent?.fallbackModels?.[1] ?? null));
}

function renderWorkspaceSelect(selectedProjectId = '') {
  workspaceSelect.innerHTML = [
    '<option value="">No workspace</option>',
    ..._projects.map(
      (project) =>
        `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)} · ${escapeHtml(project.rootPath)}</option>`,
    ),
  ].join('');
  workspaceSelect.value = selectedProjectId || '';
  const project = _projects.find((entry) => entry.id === selectedProjectId);
  workspaceHint.textContent = project
    ? `This agent will stay inside ${project.rootPath}.`
    : 'By default the agent runs without a workspace. If you choose one, tool access is fenced to that project root.';
}

function showModal() {
  modalBackdrop.classList.add('open');
  document.body.classList.add('modal-open');
  nameInput?.focus();
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  document.body.classList.remove('modal-open');
  _editingId = null;
  setModalStatus('');
}

async function openCreateModal() {
  _editingId = null;
  modalEyebrow.textContent = 'New Agent';
  nameInput.value = '';
  descriptionInput.value = '';
  promptInput.value = '';
  enabledInput.checked = true;
  triggerTypeInput.value = 'on_startup';
  scheduleModeInput.value = 'interval';
  intervalMinutesInput.value = '15';
  hourlyMinuteInput.value = '0';
  dailyHourInput.value = '9';
  dailyMinuteInput.value = '0';
  weeklyDayInput.value = '1';
  weeklyHourInput.value = '9';
  weeklyMinuteInput.value = '0';
  customCronInput.value = '';
  const defaultPrimary = await resolveDefaultPrimaryModel();
  renderModelSelects(null, defaultPrimary);
  renderWorkspaceSelect('');
  updateScheduleUi();
  updateNameUi();
  setModalStatus('');
  showModal();
}

async function openEditModal(agent) {
  _editingId = agent.id;
  modalEyebrow.textContent = `Edit Agent — ${agent.name}`;
  nameInput.value = agent.name ?? agent.id;
  descriptionInput.value = agent.description ?? '';
  promptInput.value = agent.prompt ?? '';
  enabledInput.checked = false !== agent.enabled;
  triggerTypeInput.value = agent.schedule?.type ?? 'on_startup';
  scheduleModeInput.value = agent.schedule?.editor?.mode ?? 'interval';
  intervalMinutesInput.value = String(agent.schedule?.editor?.intervalMinutes ?? 15);
  hourlyMinuteInput.value = String(agent.schedule?.editor?.minute ?? 0);
  dailyHourInput.value = String(agent.schedule?.editor?.hour ?? 9);
  dailyMinuteInput.value = String(agent.schedule?.editor?.minute ?? 0);
  weeklyDayInput.value = String(agent.schedule?.editor?.weekday ?? 1);
  weeklyHourInput.value = String(agent.schedule?.editor?.hour ?? 9);
  weeklyMinuteInput.value = String(agent.schedule?.editor?.minute ?? 0);
  customCronInput.value = String(agent.schedule?.expression ?? '');
  renderModelSelects(agent, null);
  renderWorkspaceSelect(agent.workspace?.projectId ?? '');
  updateScheduleUi();
  updateNameUi();
  setModalStatus('');
  showModal();
}

function runState(agent) {
  if (_runningAgentIds.has(agent.id)) return { label: 'Running', tone: 'running' };
  if ('error' === agent.lastRunStatus)
    return { label: `Error ${formatRelative(agent.lastRunAt)}`, tone: 'error' };
  if ('success' === agent.lastRunStatus)
    return { label: `Last run ${formatRelative(agent.lastRunAt)}`, tone: 'idle' };
  return {
    label: agent.nextRunAt ? `Next ${formatRelative(agent.nextRunAt)}` : 'Not run yet',
    tone: 'idle',
  };
}

function buildCard(agent) {
  const card = document.createElement('article');
  const status = runState(agent);
  const primaryProvider = configuredProviders().find(
    (provider) => provider.provider === agent.primaryModel?.provider,
  );
  const primaryModelName =
    primaryProvider?.models?.[agent.primaryModel?.modelId]?.name ??
    agent.primaryModel?.modelId ??
    'Unknown model';
  const scheduleLabel = agent.schedule?.label ?? 'On app startup';

  card.className = 'agents-card';
  card.dataset.id = agent.id;
  card.innerHTML = `
    <div class="agents-card-identity">
      <img class="agents-card-avatar" src="${createAgentAvatarDataUri(agent.id, 72)}" alt="${escapeHtml(agent.name)}" />
      <div class="agents-card-name-block">
        <div class="agents-card-name-row">
          <h3 class="agents-card-title">${escapeHtml(agent.name)}</h3>
          <button class="agents-card-enabled ${agent.enabled ? 'is-on' : ''}" type="button" data-action="toggle">
            ${agent.enabled ? 'Enabled' : 'Paused'}
          </button>
        </div>
        <div class="agents-card-meta-row">
          <span class="agents-card-command">/${escapeHtml(agent.id)}</span>
          <span class="agents-card-state agents-card-state--${status.tone}">${escapeHtml(status.label)}</span>
        </div>
      </div>
    </div>

    <div class="agents-card-schedule-col">
      <div class="agents-card-col-label">Run</div>
      <div class="agents-card-col-value">${escapeHtml(scheduleLabel)}</div>
    </div>

    <div class="agents-card-model-col">
      <div class="agents-card-col-label">Model</div>
      <div class="agents-card-col-value">${escapeHtml(primaryModelName)}</div>
    </div>

    <div class="agents-card-actions">
      <button class="agents-card-btn" type="button" data-action="run">${_runningAgentIds.has(agent.id) ? 'Running\u2026' : 'Run'}</button>
      <button class="agents-card-btn" type="button" data-action="edit">Edit</button>
      <button class="agents-card-btn agents-card-btn--danger" type="button" data-action="delete">Delete</button>
    </div>
  `;

  card.querySelector('[data-action="toggle"]')?.addEventListener('click', async () => {
    const result = await window.electronAPI?.invoke?.('update-agent', agent.id, {
      enabled: !agent.enabled,
    });
    if (!result?.ok) return;
    await refreshAll();
    window.dispatchEvent(new Event('jo:agents-changed'));
  });

  card.querySelector('[data-action="run"]')?.addEventListener('click', async () => {
    if (_runningAgentIds.has(agent.id)) return;
    try {
      await window.joaniumAgents?.runAgent?.(agent.id, { source: 'manual' });
    } catch (error) {
      console.error('[Agents] Manual run failed:', error);
    } finally {
      await refreshAll();
    }
  });

  card.querySelector('[data-action="edit"]')?.addEventListener('click', () => openEditModal(agent));

  card.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
    const confirmed = await openConfirm({
      title: `Delete ${agent.name}?`,
      body: 'This removes the saved agent and its schedule. Existing run history stays in History.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    const result = await window.electronAPI?.invoke?.('delete-agent', agent.id);
    if (!result?.ok) return;
    await refreshAll();
    window.dispatchEvent(new Event('jo:agents-changed'));
  });

  return card;
}

function updateCounts() {
  // stats display removed
}

function renderWarning() {
  const hasModels = configuredProviders().length > 0;
  warningEl.hidden = hasModels;
  warningEl.textContent = hasModels
    ? ''
    : 'Configure at least one model in Settings before creating or running agents.';
  addBtn.disabled = !hasModels;
  createFirstBtn.disabled = !hasModels;
}

function render() {
  updateCounts();
  renderWarning();
  const total = _allAgents.length;
  if (0 === total) {
    searchWrapper.hidden = true;
    grid.hidden = true;
    emptyEl.hidden = false;
    return;
  }
  const query = _searchQuery.trim().toLowerCase();
  const filtered = query
    ? _allAgents.filter((agent) =>
        [
          agent.name,
          agent.id,
          agent.description,
          agent.prompt,
          agent.workspace?.projectName,
          agent.schedule?.label,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    : [..._allAgents];
  searchWrapper.hidden = false;
  emptyEl.hidden = true;
  grid.hidden = false;
  grid.innerHTML = '';
  if (0 === filtered.length) {
    grid.innerHTML = `<div class="agents-no-results">No agents matched "${escapeHtml(_searchQuery)}".</div>`;
    return;
  }

  // Diff-based update: keep existing cards to avoid DOM wipe flicker
  const existingById = new Map();
  // Clear any non-card children (e.g. "no results" message)
  Array.from(grid.children).forEach((el) => {
    if (!el.classList.contains('agents-card')) el.remove();
  });
  grid
    .querySelectorAll('.agents-card[data-id]')
    .forEach((el) => existingById.set(el.dataset.id, el));
  // Remove stale cards
  existingById.forEach((el, id) => {
    if (!filtered.some((a) => a.id === id)) el.remove();
  });
  // Insert/replace cards in correct order
  filtered.forEach((agent, index) => {
    const newCard = buildCard(agent);
    const ref = grid.children[index] || null;
    if (ref && ref.dataset.id === agent.id) {
      // Replace in-place only if state changed
      const stateKey = JSON.stringify({
        enabled: agent.enabled,
        lastRunStatus: agent.lastRunStatus,
        lastRunAt: agent.lastRunAt,
        running: _runningAgentIds.has(agent.id),
        schedule: agent.schedule?.label,
        model: agent.primaryModel?.modelId,
      });
      if (ref.dataset.stateKey !== stateKey) {
        newCard.dataset.stateKey = stateKey;
        grid.replaceChild(newCard, ref);
      }
    } else {
      newCard.dataset.stateKey = JSON.stringify({
        enabled: agent.enabled,
        lastRunStatus: agent.lastRunStatus,
        lastRunAt: agent.lastRunAt,
        running: _runningAgentIds.has(agent.id),
        schedule: agent.schedule?.label,
        model: agent.primaryModel?.modelId,
      });
      grid.insertBefore(newCard, ref);
      if (existingById.has(agent.id)) existingById.get(agent.id).remove();
    }
  });
}

// ── History view ─────────────────────────────────────────────────────────────

function renderAllHistoryRuns(runs) {
  if (!historyAllBody) return;

  const filtered = _historyFilterAgentId
    ? runs.filter((r) => r.agentId === _historyFilterAgentId)
    : runs;

  if (!filtered.length) {
    historyAllBody.innerHTML = `
      <div class="agents-history-view-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" width="32" height="32">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 7v5l3 3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>No runs recorded yet. Hit <strong>Run</strong> on an agent to execute it manually.</p>
      </div>`;
    return;
  }

  historyAllBody.innerHTML = filtered
    .map((run) => {
      const agentName =
        _allAgents.find((a) => a.id === run.agentId)?.name ?? run.agentId ?? 'Unknown agent';
      const output = String(run.summary || run.fullResponse || '').trim();
      const hasOutput = output.length > 0;
      const hasError = run.status === 'error' && run.error;
      const durationMs =
        run.finishedAt && run.startedAt ? new Date(run.finishedAt) - new Date(run.startedAt) : null;
      const durationStr =
        durationMs != null
          ? durationMs < 1000
            ? `${durationMs}ms`
            : `${(durationMs / 1000).toFixed(1)}s`
          : '';
      const sourceLabel =
        run.source === 'manual'
          ? 'Manual'
          : run.source === 'cron'
            ? 'Scheduled'
            : escapeHtml(run.source ?? '');
      const timestampStr = formatTimestamp(run.startedAt);

      return `
        <div class="agents-history-run-card agents-history-run-card--${escapeHtml(run.status ?? 'idle')}">
          <div class="agents-history-run-card-header">
            <div class="agents-history-run-card-left">
              <img class="agents-history-run-card-avatar" src="${createAgentAvatarDataUri(run.agentId ?? 'agent', 32)}" alt="${escapeHtml(agentName)}" />
              <div class="agents-history-run-card-identity">
                <span class="agents-history-run-card-name">${escapeHtml(agentName)}</span>
                <span class="agents-history-run-card-time">${escapeHtml(timestampStr)}</span>
              </div>
            </div>
            <div class="agents-history-run-card-badges">
              <span class="agents-history-run-dot agents-history-run-dot--${escapeHtml(run.status ?? 'idle')}"></span>
              <span class="agents-history-run-badge">${escapeHtml(sourceLabel)}</span>
              ${durationStr ? `<span class="agents-history-run-badge">${escapeHtml(durationStr)}</span>` : ''}
              ${run.model ? `<span class="agents-history-run-badge agents-history-run-badge--model">${escapeHtml(run.model)}</span>` : ''}
            </div>
          </div>
          ${hasError ? `<div class="agents-history-run-error">${escapeHtml(String(run.error))}</div>` : ''}
          ${
            hasOutput
              ? `<div class="agents-history-run-output"><pre class="agents-history-run-text">${escapeHtml(output.slice(0, 4000))}${output.length > 4000 ? '\n\u2026' : ''}</pre></div>`
              : !hasError
                ? `<div class="agents-history-run-nooutput">No output was recorded for this run.</div>`
                : ''
          }
        </div>`;
    })
    .join('');
}

function populateHistoryFilter(runs) {
  if (!historyFilterSelect) return;
  const agentIds = [...new Set(runs.map((r) => r.agentId).filter(Boolean))];
  historyFilterSelect.innerHTML =
    `<option value="">All agents</option>` +
    agentIds
      .map((id) => {
        const name = _allAgents.find((a) => a.id === id)?.name ?? id;
        return `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`;
      })
      .join('');
  historyFilterSelect.value = _historyFilterAgentId;
}

async function loadHistoryView() {
  if (!historyAllBody || !historyViewLoading) return;
  historyViewLoading.hidden = false;
  historyAllBody.innerHTML = '';
  try {
    const result = await window.electronAPI?.invoke?.('get-agent-runs', 500);
    _allRuns = Array.isArray(result?.runs) ? result.runs : [];
    historyViewLoading.hidden = true;
    populateHistoryFilter(_allRuns);
    renderAllHistoryRuns(_allRuns);
  } catch (err) {
    historyViewLoading.hidden = true;
    historyAllBody.innerHTML = `<div class="agents-history-view-empty"><p>Could not load run history.</p></div>`;
    console.error('[Agents] History load failed:', err);
  }
}

function switchTab(tab) {
  _activeTab = tab;
  tabAgentsBtn?.classList.toggle('is-active', tab === 'agents');
  tabHistoryBtn?.classList.toggle('is-active', tab === 'history');
  if (viewAgentsEl) viewAgentsEl.hidden = tab !== 'agents';
  if (viewHistoryEl) viewHistoryEl.hidden = tab !== 'history';
  if (tab === 'history') loadHistoryView();
}

// ── Data ─────────────────────────────────────────────────────────────────────

async function refreshRunning() {
  const result = await window.electronAPI?.invoke?.('get-running-jobs');
  const running = Array.isArray(result?.running) ? result.running : [];
  _runningAgentIds = new Set(
    running
      .filter((job) => 'agent' === job.type)
      .map(
        (job) =>
          job.agentId ??
          _allAgents.find((agent) => agent.name === job.jobName || agent.id === job.jobName)?.id ??
          null,
      )
      .filter(Boolean),
  );
}

async function refreshAll() {
  const [agents, projects, templates, providers] = await Promise.all([
    window.electronAPI?.invoke?.('get-agents'),
    window.electronAPI?.invoke?.('get-projects'),
    window.electronAPI?.invoke?.('get-templates-full'),
    window.electronAPI?.invoke?.('get-models'),
  ]);
  _allAgents = Array.isArray(agents) ? agents : [];
  _projects = Array.isArray(projects) ? projects : [];
  _templates = Array.isArray(templates) ? templates : [];
  _providers = Array.isArray(providers) ? providers : [];
  await refreshRunning();
  render();
  // If on history tab, refresh the history view too
  if (_activeTab === 'history') loadHistoryView();
}

async function saveAgent() {
  const nameState = updateNameUi();
  if (!nameState.ok) {
    setModalStatus(nameState.message, 'error');
    return;
  }
  if (!String(promptInput.value ?? '').trim()) {
    setModalStatus('Prompt is required.', 'error');
    return;
  }
  const schedule = currentSchedule();
  if ('cron' === schedule.type && !isValidCronExpression(schedule.expression)) {
    setModalStatus('Fix the cron expression before saving.', 'error');
    return;
  }
  const workspace = _projects.find((project) => project.id === workspaceSelect.value) ?? null;
  const payload = {
    name: nameInput.value,
    description: descriptionInput.value,
    prompt: promptInput.value,
    enabled: enabledInput.checked,
    primaryModel: parseModelValue(primaryModelInput.value),
    fallbackModels: [fallbackModel1Input.value, fallbackModel2Input.value]
      .map(parseModelValue)
      .filter(Boolean),
    workspace: workspace
      ? {
          projectId: workspace.id,
          projectName: workspace.name,
          workspacePath: workspace.rootPath,
        }
      : null,
    schedule,
  };
  if (!payload.primaryModel) {
    setModalStatus('Choose a primary model.', 'error');
    return;
  }
  const result = _editingId
    ? await window.electronAPI?.invoke?.('update-agent', _editingId, payload)
    : await window.electronAPI?.invoke?.('create-agent', payload);
  if (!result?.ok) {
    setModalStatus(result?.error ?? 'Could not save the agent.', 'error');
    return;
  }
  closeModal();
  await refreshAll();
  window.dispatchEvent(new Event('jo:agents-changed'));
}

export function mount(outlet) {
  outlet.innerHTML = getAgentsHTML();
  document.getElementById('agents-modal-backdrop') &&
    document.body.appendChild(document.getElementById('agents-modal-backdrop'));

  grid = document.getElementById('agents-grid');
  emptyEl = document.getElementById('agents-empty');
  searchWrapper = document.getElementById('agents-search-wrapper');
  searchInput = document.getElementById('agents-search');
  searchClearBtn = document.getElementById('agents-search-clear');
  addBtn = document.getElementById('agents-add-btn');
  createFirstBtn = document.getElementById('agents-create-first');
  warningEl = document.getElementById('agents-warning');
  totalCountEl = null; // removed
  enabledCountEl = null; // removed
  scheduledCountEl = null; // removed
  modalBackdrop = document.getElementById('agents-modal-backdrop');
  modalEyebrow = document.getElementById('agents-modal-eyebrow');
  modalTitle = null; // element removed — eyebrow pill handles the label
  modalClose = document.getElementById('agents-modal-close');
  modalCancel = document.getElementById('agents-modal-cancel');
  modalSave = document.getElementById('agents-modal-save');
  modalStatus = document.getElementById('agents-modal-status');
  avatarPreview = document.getElementById('agents-avatar-preview');
  nameInput = document.getElementById('agents-name-input');
  nameHint = document.getElementById('agents-name-hint');
  descriptionInput = document.getElementById('agents-description-input');
  promptInput = document.getElementById('agents-prompt-input');
  enabledInput = document.getElementById('agents-enabled-input');
  triggerTypeInput = document.getElementById('agents-trigger-type');
  scheduleEditorWrap = document.getElementById('agents-schedule-editor');
  scheduleModeInput = document.getElementById('agents-schedule-mode');
  intervalMinutesInput = document.getElementById('agents-interval-minutes');
  hourlyMinuteInput = document.getElementById('agents-hourly-minute');
  dailyHourInput = document.getElementById('agents-daily-hour');
  dailyMinuteInput = document.getElementById('agents-daily-minute');
  weeklyDayInput = document.getElementById('agents-weekly-day');
  weeklyHourInput = document.getElementById('agents-weekly-hour');
  weeklyMinuteInput = document.getElementById('agents-weekly-minute');
  customCronInput = document.getElementById('agents-custom-cron');
  schedulePreview = document.getElementById('agents-schedule-preview');
  cronPreview = document.getElementById('agents-cron-preview');
  primaryModelInput = document.getElementById('agents-primary-model');
  fallbackModel1Input = document.getElementById('agents-fallback-model-1');
  fallbackModel2Input = document.getElementById('agents-fallback-model-2');
  workspaceSelect = document.getElementById('agents-workspace-select');
  workspaceHint = document.getElementById('agents-workspace-hint');
  tabAgentsBtn = document.getElementById('agents-tab-agents');
  tabHistoryBtn = document.getElementById('agents-tab-history');
  viewAgentsEl = document.getElementById('agents-view-agents');
  viewHistoryEl = document.getElementById('agents-view-history');
  historyFilterSelect = document.getElementById('agents-history-filter');
  historyAllBody = document.getElementById('agents-history-all-body');
  historyViewLoading = document.getElementById('agents-history-view-loading');

  const onSearch = () => {
      _searchQuery = searchInput.value;
      searchClearBtn.classList.toggle('visible', _searchQuery.length > 0);
      render();
    },
    onSearchClear = () => {
      _searchQuery = '';
      searchInput.value = '';
      searchClearBtn.classList.remove('visible');
      render();
      searchInput.focus();
    },
    onModalBackdropClick = (event) => {
      event.target === modalBackdrop && closeModal();
    },
    onKeydown = (event) => {
      'Escape' === event.key && closeModal();
    },
    onRuntimeUpdate = (() => {
      let _debounceTimer = null;
      return () => {
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => {
          refreshAll().catch((error) => console.warn('[Agents] Refresh failed:', error));
        }, 300);
      };
    })();

  searchInput?.addEventListener('input', onSearch);
  searchClearBtn?.addEventListener('click', onSearchClear);
  addBtn?.addEventListener('click', () => openCreateModal());
  createFirstBtn?.addEventListener('click', () => openCreateModal());
  modalClose?.addEventListener('click', closeModal);
  modalCancel?.addEventListener('click', closeModal);
  modalSave?.addEventListener('click', saveAgent);
  modalBackdrop?.addEventListener('click', onModalBackdropClick);
  document.addEventListener('keydown', onKeydown);
  nameInput?.addEventListener('input', updateNameUi);
  triggerTypeInput?.addEventListener('change', updateScheduleUi);
  scheduleModeInput?.addEventListener('change', updateScheduleUi);
  [
    intervalMinutesInput,
    hourlyMinuteInput,
    dailyHourInput,
    dailyMinuteInput,
    weeklyDayInput,
    weeklyHourInput,
    weeklyMinuteInput,
    customCronInput,
  ].forEach((input) => input?.addEventListener('input', updateScheduleUi));
  workspaceSelect?.addEventListener('change', () => renderWorkspaceSelect(workspaceSelect.value));

  tabAgentsBtn?.addEventListener('click', () => switchTab('agents'));
  tabHistoryBtn?.addEventListener('click', () => switchTab('history'));

  historyFilterSelect?.addEventListener('change', () => {
    _historyFilterAgentId = historyFilterSelect.value;
    renderAllHistoryRuns(_allRuns);
  });

  window.addEventListener('jo:agents-runtime-updated', onRuntimeUpdate);
  window.addEventListener('jo:agents-changed', onRuntimeUpdate);

  refreshAll().catch((error) => {
    console.error('[Agents] Initial load failed:', error);
  });

  return function cleanup() {
    window.clearInterval(_refreshTimer);
    window.removeEventListener('jo:agents-runtime-updated', onRuntimeUpdate);
    window.removeEventListener('jo:agents-changed', onRuntimeUpdate);
    document.removeEventListener('keydown', onKeydown);
    modalBackdrop?.removeEventListener('click', onModalBackdropClick);
    modalBackdrop?.classList.remove('open');
    modalBackdrop?.remove();
    document.body.classList.remove('modal-open');
  };
}
