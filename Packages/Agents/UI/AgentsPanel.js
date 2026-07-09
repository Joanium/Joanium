import { createElement, formatText, makeEditableTextarea } from '../../Shared/Utils/DomUtils.js';
import { collapseWhitespace, createSlugId } from '../../Shared/Utils/StringUtils.js';
import { toFileUrl } from '../../Shared/Utils/UrlUtils.js';
import { invokeIpc } from '../../Shared/Ipc/RendererIpc.js';
import { createSearchBar } from '../../Shared/SearchBar/SearchBar.js';
import { createIcon } from '../../Shared/Icons/Icons.js';
import { createInputBoxLite } from '../../Shared/InputBoxLite/InputBoxLite.js';
import { createPanelHeader } from '../../Shared/PanelHeader/PanelHeader.js';
import { createDropDownLite } from '../../Shared/DropDownLite/DropDownLite.js';
import { createExecutionReplay } from './ExecutionReplay.js';
import {
  buildAvailableModelOptions,
  decodeModelValue,
  encodeModelValue,
} from '../../Shared/ProviderCatalog/ModelOptions.js';
import { attachCustomScrollbar } from '../../Shared/CustomScrollbar/CustomScrollbar.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createAgentId(name) {
  return createSlugId(name, 'Agent');
}

function pickRandomItem(array) {
  if (!array.length) return null;
  return array[Math.floor(Math.random() * array.length)];
}

function avatarToUrl(avatar) {
  if (avatar?.fileUrl) return avatar.fileUrl;
  if (avatar?.filePath) return toFileUrl(avatar.filePath);
  return null;
}

function buildScheduleDescription(schedule, strings) {
  if (!schedule) return strings.scheduleTypes.startup;
  const time = schedule.time ?? '09:00';
  switch (schedule.type) {
    case 'startup':
      return strings.scheduleStartup;
    case 'daily':
      return formatText(strings.scheduleDaily, { time });
    case 'weekly': {
      const day = strings.days[schedule.day ?? 1];
      return formatText(strings.scheduleWeekly, { day, time });
    }
    case 'weekdays':
      return formatText(strings.scheduleWeekdays, { time });
    case 'weekends':
      return formatText(strings.scheduleWeekends, { time });
    default:
      return strings.scheduleTypes.startup;
  }
}

function formatRelativeDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

// ---------------------------------------------------------------------------
// createAgentsPanel
// ---------------------------------------------------------------------------

export function createAgentsPanel(strings) {
  // Panel-scoped draft state
  let draftName = '';
  let draftAvatar = null;
  let draftScheduleType = 'startup';
  let draftTime = '09:00';
  let draftDay = 1;
  let draftPrompt = '';
  let draftModel = null; // null = use default; { providerId, modelId } = specific
  let editingAgentId = null;
  let editingCreatedAt = null;

  // Avatar catalog
  let availableAvatars = [];

  // Provider catalog (fetched once for the model dropdown)
  let cachedProviders = [];
  let cachedUserProviderDetails = {};

  // DOM refs
  let panelRef = null;
  let avatarGridEl = null;
  let timeRowEl = null;
  let dayRowEl = null;
  let saveBtnRef = null;
  let formHeadingRef = null;
  let modelSectionEl = null;
  let modelDropdown = null;

  // ── Replay viewer state ────────────────────────────────────────────────────
  // The right column can show either the agent list or the replay viewer.
  // replayViewer is created once and reused across agents.
  let listColEl = null;
  let listContentEl = null;
  let replayPaneEl = null;
  let replayViewer = null;
  let replayBackBtnEl = null;
  let replayRunsEl = null;
  let replayHeadingEl = null;

  // ── Provider loading ──────────────────────────────────────────────────────

  let cachedModelFavourites = [];

  async function loadProviders() {
    try {
      const [bootstrap, favourites] = await Promise.all([
        invokeIpc('chat:bootstrap'),
        invokeIpc('providers:list-model-favourites').catch(() => []),
      ]);
      cachedProviders = Array.isArray(bootstrap.providers) ? bootstrap.providers : [];
      cachedUserProviderDetails = bootstrap.user?.providers?.details ?? {};
      cachedModelFavourites = Array.isArray(favourites) ? favourites : [];
    } catch {
      cachedProviders = [];
      cachedUserProviderDetails = {};
      cachedModelFavourites = [];
    }
    rebuildModelDropdown();
  }

  function buildModelOptions() {
    return buildAvailableModelOptions(cachedProviders, cachedUserProviderDetails, {
      defaultOption: { value: 'default', label: strings.modelDefault },
      modelFavourites: cachedModelFavourites,
    });
  }

  // Rebuild (or first-build) the model dropdown inside its container.
  function rebuildModelDropdown() {
    if (!modelSectionEl) return;
    const wrap = modelSectionEl.querySelector('.agents-form__model-dropdown-wrap');
    if (!wrap) return;

    // Tear down the old instance so its panel element is removed from <body>.
    if (modelDropdown) {
      modelDropdown.dispose();
      modelDropdown = null;
    }

    const options = buildModelOptions();
    const selectedValue = encodeModelValue(draftModel, 'default');

    modelDropdown = createDropDownLite({
      options,
      value: selectedValue,
      searchable: true,
      searchPlaceholder: strings.modelSearchPlaceholder ?? 'Search models…',
      onChange: (value) => {
        draftModel = decodeModelValue(value, 'default');
      },
      onToggleFavourite: async (opt) => {
        if (!opt.provider?.id || !opt.model?.id) return;
        const result = await invokeIpc(
          'providers:toggle-model-favourite',
          opt.provider.id,
          opt.model.id,
        ).catch(() => null);
        if (result?.favourites) {
          cachedModelFavourites = result.favourites;
          rebuildModelDropdown();
        }
      },
    });

    wrap.replaceChildren(modelDropdown.element);
  }

  // Build the static shell of the model section (dropdown is injected later).
  function buildModelSection() {
    const wrapper = createElement('div', 'agents-form__model-section');
    const label = createElement('label', 'agents-form__field-label', strings.modelLabel);
    const wrap = createElement('div', 'agents-form__model-dropdown-wrap');
    wrapper.append(label, wrap);
    modelSectionEl = wrapper;
    rebuildModelDropdown();
    return wrapper;
  }

  // ── Avatar grid ────────────────────────────────────────────────────────────

  function buildAvatarGrid() {
    const wrapper = createElement('div', 'agents-form__avatar-section');
    const label = createElement('label', 'agents-form__field-label', strings.avatarLabel);
    wrapper.append(label);
    avatarGridEl = createElement('div', 'agents-form__avatar-grid');
    wrapper.append(avatarGridEl);
    return wrapper;
  }

  async function loadAvatars() {
    try {
      availableAvatars = await invokeIpc('agents:list-avatars');
    } catch {
      availableAvatars = [];
    }

    if (!avatarGridEl) return;

    availableAvatars = availableAvatars.slice().sort(() => Math.random() - 0.5);

    const existingTiles = avatarGridEl.querySelectorAll('.agents-form__avatar-tile--image');
    for (const tile of existingTiles) tile.remove();

    for (const avatar of availableAvatars) {
      const tile = createElement(
        'button',
        'agents-form__avatar-tile agents-form__avatar-tile--image',
      );
      tile.type = 'button';
      tile.setAttribute('aria-label', avatar.filename);
      tile._avatarFilename = avatar.filename;

      const img = document.createElement('img');
      img.src = avatarToUrl(avatar) ?? '';
      img.className = 'agents-form__avatar-img agents-form__avatar-img--loading';
      img.alt = avatar.filename;
      img.draggable = false;

      const spinner = createElement('span', 'agents-form__avatar-spinner');
      img.addEventListener('load', () => {
        spinner.remove();
        img.classList.remove('agents-form__avatar-img--loading');
      });
      img.addEventListener('error', () => {
        spinner.remove();
        img.classList.remove('agents-form__avatar-img--loading');
      });

      tile.append(spinner, img);
      tile.addEventListener('click', () => selectAvatar(avatar.filename));
      avatarGridEl.append(tile);
    }

    if (!draftAvatar && !editingAgentId && availableAvatars.length > 0) {
      draftAvatar = availableAvatars[0].filename;
    }
    syncAvatarTileSelection();
  }

  function selectAvatar(filename) {
    draftAvatar = filename;
    syncAvatarTileSelection();
  }

  function syncAvatarTileSelection() {
    if (!avatarGridEl) return;
    for (const tile of avatarGridEl.querySelectorAll('.agents-form__avatar-tile--image')) {
      tile.classList.toggle(
        'agents-form__avatar-tile--selected',
        tile._avatarFilename === draftAvatar,
      );
    }
  }

  // ── Schedule section ───────────────────────────────────────────────────────

  function buildScheduleSection() {
    const wrapper = createElement('div', 'agents-form__schedule-section');
    const label = createElement('label', 'agents-form__field-label', strings.scheduleLabel);
    wrapper.append(label);

    const typeRow = createElement('div', 'agents-form__schedule-types');
    for (const type of ['startup', 'daily', 'weekly', 'weekdays', 'weekends']) {
      const btn = createElement('button', 'agents-form__schedule-type-btn');
      btn.type = 'button';
      btn.textContent = strings.scheduleTypes[type];
      btn._scheduleType = type;
      btn.addEventListener('click', () => {
        draftScheduleType = type;
        syncScheduleTypeButtons(typeRow);
        syncScheduleConditionals();
      });
      typeRow.append(btn);
    }
    wrapper.append(typeRow);

    timeRowEl = createElement('div', 'agents-form__schedule-time-row');
    const timeBox = createInputBoxLite({
      label: strings.timeLabel,
      labelClassName: 'agents-form__field-label',
      className: 'agents-form__time-input',
      placeholder: strings.timePlaceholder,
      type: 'time',
      value: draftTime,
      onInput: (value) => {
        draftTime = value || '09:00';
      },
    });
    timeRowEl.append(timeBox.element);
    wrapper.append(timeRowEl);

    dayRowEl = createElement('div', 'agents-form__schedule-day-row');
    const dayLabel = createElement('label', 'agents-form__field-label', strings.dayLabel);
    const dayPicker = createElement('div', 'agents-form__day-picker');
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let d = 0; d < 7; d++) {
      const dayBtn = createElement('button', 'agents-form__day-btn');
      dayBtn.type = 'button';
      dayBtn.textContent = dayNames[d];
      dayBtn._dayIndex = d;
      dayBtn.addEventListener('click', () => {
        draftDay = d;
        syncDayButtons(dayPicker);
      });
      dayPicker.append(dayBtn);
    }
    dayRowEl.append(dayLabel, dayPicker);
    wrapper.append(dayRowEl);

    syncScheduleTypeButtons(typeRow);
    syncScheduleConditionals();
    syncDayButtons(dayPicker);
    return wrapper;
  }

  function syncScheduleTypeButtons(typeRow) {
    for (const btn of typeRow.querySelectorAll('.agents-form__schedule-type-btn')) {
      btn.classList.toggle(
        'agents-form__schedule-type-btn--active',
        btn._scheduleType === draftScheduleType,
      );
    }
  }

  function syncScheduleConditionals() {
    if (!timeRowEl || !dayRowEl) return;
    timeRowEl.hidden = draftScheduleType === 'startup';
    dayRowEl.hidden = draftScheduleType !== 'weekly';
  }

  function syncDayButtons(dayPicker) {
    for (const btn of dayPicker.querySelectorAll('.agents-form__day-btn')) {
      btn.classList.toggle('agents-form__day-btn--active', btn._dayIndex === draftDay);
    }
  }

  // ── Form save/cancel ───────────────────────────────────────────────────────

  function syncSaveBtn() {
    if (!saveBtnRef) return;
    saveBtnRef.disabled = !draftName.trim() || !draftPrompt.trim();
  }

  function syncFormChrome() {
    if (formHeadingRef) {
      formHeadingRef.textContent = editingAgentId
        ? strings.editAgentHeading
        : strings.newAgentHeading;
    }
    if (saveBtnRef) {
      saveBtnRef.textContent = editingAgentId ? strings.update : strings.save;
    }
  }

  function resetForm() {
    editingAgentId = null;
    editingCreatedAt = null;
    draftName = '';
    draftAvatar = availableAvatars.length > 0 ? pickRandomItem(availableAvatars).filename : null;
    draftScheduleType = 'startup';
    draftTime = '09:00';
    draftDay = 1;
    draftPrompt = '';
    draftModel = null;

    if (panelRef) {
      const nameInput = panelRef.querySelector('.agents-form__name-input');
      const timeInput = panelRef.querySelector('.agents-form__time-input');
      const promptTA = panelRef.querySelector('.agents-form__prompt-textarea');
      const typeRow = panelRef.querySelector('.agents-form__schedule-types');
      const dayPicker = panelRef.querySelector('.agents-form__day-picker');

      if (nameInput) nameInput.value = '';
      if (timeInput) timeInput.value = '09:00';
      if (promptTA) promptTA.value = '';
      if (typeRow) syncScheduleTypeButtons(typeRow);
      if (dayPicker) syncDayButtons(dayPicker);
    }

    syncAvatarTileSelection();
    syncScheduleConditionals();
    rebuildModelDropdown();
    syncSaveBtn();
    syncFormChrome();
  }

  function applyAgentToForm(agent) {
    editingAgentId = agent.id;
    editingCreatedAt = agent.createdAt ?? null;
    draftName = agent.name ?? '';
    draftAvatar = agent.avatar ?? null;
    draftPrompt = agent.prompt ?? '';
    draftModel = agent.model ?? null;

    const schedule = agent.schedule ?? { type: 'startup' };
    draftScheduleType = schedule.type ?? 'startup';
    draftTime = schedule.time ?? '09:00';
    draftDay = schedule.day ?? 1;

    if (panelRef) {
      const nameInput = panelRef.querySelector('.agents-form__name-input');
      const timeInput = panelRef.querySelector('.agents-form__time-input');
      const promptTA = panelRef.querySelector('.agents-form__prompt-textarea');
      const typeRow = panelRef.querySelector('.agents-form__schedule-types');
      const dayPicker = panelRef.querySelector('.agents-form__day-picker');

      if (nameInput) nameInput.value = draftName;
      if (timeInput) timeInput.value = draftTime;
      if (promptTA) promptTA.value = draftPrompt;
      if (typeRow) syncScheduleTypeButtons(typeRow);
      if (dayPicker) syncDayButtons(dayPicker);
    }

    syncAvatarTileSelection();
    syncScheduleConditionals();
    rebuildModelDropdown();
    syncSaveBtn();
    syncFormChrome();

    panelRef?.querySelector('.agents-form__name-input')?.focus();
  }

  // ── Execution Replay pane ─────────────────────────────────────────────────

  function buildReplayPane() {
    const pane = createElement('div', 'agents-replay-pane');
    pane.hidden = true;
    Object.assign(pane.style, {
      flex: '1',
      minHeight: '0',
    });

    // Back button + heading row
    const topRow = createElement('div', 'agents-replay-pane__top');

    replayBackBtnEl = createElement('button', 'agents-replay-pane__back');
    replayBackBtnEl.type = 'button';
    replayBackBtnEl.setAttribute('aria-label', strings.cancel);
    replayBackBtnEl.append(createIcon('arrowLeft', 'agents-replay-pane__back-icon'));
    replayBackBtnEl.addEventListener('click', hideReplayPane);

    replayHeadingEl = createElement('p', 'agents-list__heading');

    replayRunsEl = createElement('div', 'agents-replay-runs-wrap');
    Object.assign(replayRunsEl.style, {
      marginLeft: 'auto',
      minWidth: '180px',
    });

    topRow.append(replayBackBtnEl, replayHeadingEl, replayRunsEl);
    pane.append(topRow);

    // Replay viewer — wrapper to host the scrollbar properly
    const viewerContainer = createElement('div', 'agents-replay-pane__viewer-container');
    Object.assign(viewerContainer.style, {
      flex: '1',
      minWidth: '0',
      minHeight: '0',
      position: 'relative',
    });

    const viewerWrap = createElement('div', 'agents-replay-pane__viewer-wrap');
    Object.assign(viewerWrap.style, {
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    });

    replayViewer = createExecutionReplay(strings);
    viewerWrap.append(replayViewer.build());
    viewerContainer.append(viewerWrap);
    pane.append(viewerContainer);

    replayPaneEl = pane;
    return pane;
  }

  async function showReplayPane(agentId, agentName) {
    if (!listColEl || !listContentEl || !replayPaneEl) return;

    replayHeadingEl.textContent = agentName;
    replayViewer.clear();
    replayRunsEl.replaceChildren();
    replayRunsEl.append(createElement('div', 'agents-replay-runs__loading'));

    listColEl.querySelector('.agents-list__content-container').hidden = true;
    listColEl.querySelector('.agents-list__search').hidden = true;
    listColEl.querySelector('.agents-list__heading:not(.agents-replay-pane__top *)').hidden = true;
    replayPaneEl.hidden = false;

    // Load runs for this agent
    let allRuns;
    try {
      allRuns = await invokeIpc('agents:list-run-ids');
    } catch {
      allRuns = [];
    }

    const agentRuns = (Array.isArray(allRuns) ? allRuns : []).filter((r) => r.agentId === agentId);
    replayRunsEl.replaceChildren();

    if (agentRuns.length === 0) {
      const ddm = createDropDownLite({
        placeholder: strings.replay.empty,
        options: [],
      });
      ddm.element.querySelector('.joanium-ddm-lite__trigger').disabled = true;
      replayRunsEl.append(ddm.element);
      return;
    }

    // Select the most recent run automatically
    let selectedRunId = agentRuns[0].runId;
    let ddmInst = null;

    function syncRunSelection() {
      if (ddmInst) ddmInst.setValue(selectedRunId);
      void replayViewer.load(selectedRunId);
    }

    const options = agentRuns.map((run) => {
      let emoji = '🟢';
      if (run.status === 'failed' || run.status === 'error') emoji = '🔴';
      else if (run.status === 'running') emoji = '🟡';

      return {
        value: run.runId,
        label: `${emoji} ${formatRelativeDate(run.startedAt)}`,
      };
    });

    ddmInst = createDropDownLite({
      options,
      value: selectedRunId,
      onChange: (newVal) => {
        selectedRunId = newVal;
        syncRunSelection();
      },
    });

    replayRunsEl.append(ddmInst.element);
    syncRunSelection();
  }

  function hideReplayPane() {
    if (!listColEl || !listContentEl || !replayPaneEl) return;
    replayPaneEl.hidden = true;
    replayViewer.clear();
    listColEl.querySelector('.agents-list__content-container').hidden = false;
    listColEl.querySelector('.agents-list__search').hidden = false;
    listColEl.querySelector('.agents-list__heading:not(.agents-replay-pane__top *)').hidden = false;
  }

  // ── Card builder ───────────────────────────────────────────────────────────

  function resolveAvatarSrc(agent) {
    if (!agent.avatar) {
      const random = pickRandomItem(availableAvatars);
      return avatarToUrl(random);
    }
    const found = availableAvatars.find((a) => a.filename === agent.avatar);
    return avatarToUrl(found);
  }

  function resolveModelLabel(agent) {
    const m = agent.model;
    if (!m?.providerId || !m?.modelId) return null;
    const provider = cachedProviders.find((p) => p.id === m.providerId);
    const model = provider?.models?.find((mo) => mo.id === m.modelId);
    if (provider && model) return `${provider.label} — ${model.name ?? model.id}`;
    return `${m.providerId} / ${m.modelId}`;
  }

  function buildCard(agent, listEl) {
    const card = createElement('div', 'agents-card');

    // Avatar
    const avatarEl = createElement('div', 'agents-card__avatar');
    const avatarSrc = resolveAvatarSrc(agent);
    if (avatarSrc) {
      const img = document.createElement('img');
      img.src = avatarSrc;
      img.alt = agent.name;
      img.className = 'agents-card__avatar-img';
      img.draggable = false;
      avatarEl.append(img);
    } else {
      const initials = (agent.name || 'A').slice(0, 2).toUpperCase();
      avatarEl.append(createElement('span', 'agents-card__avatar-initials', initials));
    }

    // Body
    const body = createElement('div', 'agents-card__body');
    const nameEl = createElement('div', 'agents-card__name', agent.name);
    const metaRow = createElement('div', 'agents-card__meta');
    const schedEl = createElement(
      'span',
      'agents-card__schedule',
      buildScheduleDescription(agent.schedule, strings),
    );
    metaRow.append(schedEl);

    const modelLabel = resolveModelLabel(agent);
    if (modelLabel) {
      const dot = createElement('span', 'agents-card__meta-dot', '·');
      const modelEl = createElement('span', 'agents-card__model', modelLabel);
      metaRow.append(dot, modelEl);
    }

    const promptEl = createElement('div', 'agents-card__prompt', agent.prompt);
    body.append(nameEl, metaRow, promptEl);

    // Actions
    const actions = createElement('div', 'agents-card__actions');

    // Enable / Disable toggle
    let isEnabled = agent.enabled !== false;
    const toggleBtn = createElement('button', 'agents-card__btn agents-card__btn--toggle');
    toggleBtn.type = 'button';
    const togglePill = createElement('span', 'agents-toggle');
    const toggleThumb = createElement('span', 'agents-toggle__thumb');
    togglePill.append(toggleThumb);
    toggleBtn.append(togglePill);

    function syncToggleBtn() {
      toggleBtn.setAttribute('aria-label', isEnabled ? strings.disable : strings.enable);
      toggleBtn.classList.toggle('agents-card__btn--toggle-on', isEnabled);
      toggleBtn.classList.toggle('agents-card__btn--toggle-off', !isEnabled);
    }
    syncToggleBtn();
    toggleBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      isEnabled = !isEnabled;
      syncToggleBtn();
      try {
        const full = await invokeIpc('agents:load-agent', agent.id);
        await invokeIpc('agents:save-agent', { ...full, enabled: isEnabled });
      } catch (err) {
        console.error('[Joanium] Failed to toggle agent enabled state:', err);
      }
    });

    // Run — bolt → spinner → check
    const runBtn = createElement('button', 'agents-card__btn agents-card__btn--run');
    runBtn.type = 'button';
    runBtn.setAttribute('aria-label', strings.run);
    const runBoltIcon = createIcon('bolt', 'agents-card__btn-icon agents-card__run-play');
    const runSpinnerEl = createElement('span', 'agents-card__run-spinner');
    const runCheckIcon = createIcon('check', 'agents-card__btn-icon agents-card__run-check');
    runBtn.append(runBoltIcon, runSpinnerEl, runCheckIcon);
    runBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (runBtn._isRunning) return;
      runBtn._isRunning = true;
      runBtn.classList.add('agents-card__btn--running');
      await new Promise((resolve) => setTimeout(resolve, 0));
      try {
        await Promise.all([
          invokeIpc('agents:run-agent', agent.id),
          new Promise((resolve) => setTimeout(resolve, 600)),
        ]);
      } catch (err) {
        console.error('[Joanium] Failed to run agent:', err);
      }
      runBtn.classList.remove('agents-card__btn--running');
      runBtn.classList.add('agents-card__btn--done');
      await new Promise((resolve) => setTimeout(resolve, 1500));
      runBtn.classList.remove('agents-card__btn--done');
      runBtn._isRunning = false;
    });

    // View Replay
    const replayBtn = createElement('button', 'agents-card__btn agents-card__btn--replay');
    replayBtn.type = 'button';
    replayBtn.setAttribute('aria-label', strings.viewReplay);
    replayBtn.append(createIcon('tabHistory', 'agents-card__btn-icon'));
    replayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      void showReplayPane(agent.id, agent.name);
    });

    // Edit
    const editBtn = createElement('button', 'agents-card__btn');
    editBtn.type = 'button';
    editBtn.setAttribute('aria-label', strings.edit);
    editBtn.append(createIcon('pencil', 'agents-card__btn-icon'));
    editBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const full = await invokeIpc('agents:load-agent', agent.id);
        panelRef?._startEdit(full);
      } catch (err) {
        console.error('[Joanium] Failed to load agent for editing:', err);
      }
    });

    // Delete
    const deleteBtn = createElement('button', 'agents-card__btn agents-card__btn--danger');
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', strings.delete);
    deleteBtn.append(createIcon('trash', 'agents-card__btn-icon'));
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await invokeIpc('agents:delete-agent', agent.id);
      } catch (err) {
        console.error('[Joanium] Failed to delete agent:', err);
      }
      if (editingAgentId === agent.id) panelRef?._resetForm();
      await populateList(listEl, panelRef?._search.getValue().trim() ?? '');
    });

    actions.append(toggleBtn, runBtn, replayBtn, editBtn, deleteBtn);
    card.append(avatarEl, body, actions);
    return card;
  }

  // ── populateList ───────────────────────────────────────────────────────────

  let _fetchGen = 0;

  async function populateList(listEl, query = '') {
    _fetchGen++;
    const gen = _fetchGen;

    const alreadyLoading = !!listEl.querySelector('.agents-skeleton');
    if (!alreadyLoading) {
      listEl.replaceChildren();
      for (let i = 0; i < 3; i++) listEl.append(createElement('div', 'agents-skeleton'));
    }

    let agents;
    try {
      agents = await invokeIpc('agents:list-agents');
    } catch {
      agents = [];
    }

    if (gen !== _fetchGen) return;

    const normalizedQuery = collapseWhitespace(query).toLowerCase();
    const filtered = normalizedQuery
      ? agents.filter((a) => {
          const haystack = [a.name, a.prompt]
            .map((v) => collapseWhitespace(v ?? '').toLowerCase())
            .join('\n');
          return haystack.includes(normalizedQuery);
        })
      : agents;

    listEl.replaceChildren();

    if (filtered.length === 0) {
      const empty = createElement('div', 'agents-empty');
      empty.append(
        createElement(
          'p',
          'agents-empty__title',
          normalizedQuery ? strings.noResults : strings.empty,
        ),
        createElement(
          'p',
          'agents-empty__hint',
          normalizedQuery ? strings.noResultsHint : strings.emptyHint,
        ),
      );
      listEl.append(empty);
      return;
    }

    for (const agent of filtered) listEl.append(buildCard(agent, listEl));
  }

  // ── build ──────────────────────────────────────────────────────────────────

  function build() {
    const panel = createElement('div', 'agents-panel');
    panel.hidden = true;

    const header = createPanelHeader({ title: strings.title, subtitle: strings.subtitle });
    panel.append(header);

    const body = createElement('div', 'agents-panel__body');
    const formCol = createElement('div', 'agents-form-col');

    formHeadingRef = createElement('p', 'agents-form__heading', strings.newAgentHeading);
    formCol.append(formHeadingRef);

    const formCard = createElement('div', 'agents-form__card');

    // Name
    const nameBox = createInputBoxLite({
      label: strings.nameLabel,
      labelClassName: 'agents-form__field-label',
      className: 'agents-form__name-input',
      placeholder: strings.namePlaceholder,
      onInput: (value) => {
        draftName = value;
        syncSaveBtn();
      },
    });
    formCard.append(nameBox.element);

    // Avatar
    formCard.append(buildAvatarGrid());

    // Schedule
    formCard.append(buildScheduleSection());

    // Model
    formCard.append(buildModelSection());

    // Prompt
    const promptLabel = createElement('label', 'agents-form__field-label', strings.promptLabel);
    const promptTextarea = document.createElement('textarea');
    promptTextarea.className = 'agents-form__prompt-textarea';
    promptTextarea.placeholder = strings.promptPlaceholder;
    promptTextarea.rows = 5;
    makeEditableTextarea(promptTextarea);
    promptTextarea.addEventListener('input', (e) => {
      draftPrompt = e.target.value;
      syncSaveBtn();
    });
    formCard.append(promptLabel, promptTextarea);

    // Actions
    const formActions = createElement('div', 'agents-form__actions');
    const cancelBtn = createElement('button', 'agents-form__btn-cancel');
    cancelBtn.type = 'button';
    cancelBtn.textContent = strings.cancel;
    cancelBtn.addEventListener('click', resetForm);

    saveBtnRef = createElement('button', 'agents-form__btn-save');
    saveBtnRef.type = 'button';
    saveBtnRef.disabled = true;
    saveBtnRef.textContent = strings.save;

    saveBtnRef.addEventListener('click', async () => {
      const name = draftName.trim();
      const prompt = draftPrompt.trim();
      if (!name || !prompt) return;

      const avatar =
        draftAvatar ??
        (availableAvatars.length > 0 ? pickRandomItem(availableAvatars).filename : null);

      const now = new Date().toISOString();
      const schedule =
        draftScheduleType === 'startup'
          ? { type: 'startup' }
          : draftScheduleType === 'weekly'
            ? { type: 'weekly', time: draftTime, day: draftDay }
            : { type: draftScheduleType, time: draftTime };

      const agent = {
        id: editingAgentId ?? createAgentId(name),
        name,
        avatar,
        schedule,
        model: draftModel,
        prompt,
        createdAt: editingCreatedAt ?? now,
        updatedAt: now,
      };

      try {
        await invokeIpc('agents:save-agent', agent);
      } catch (err) {
        console.error('[Joanium] Failed to save agent:', err);
        return;
      }

      resetForm();
      await populateList(panel._listEl, panel._search.getValue().trim());
    });

    formActions.append(cancelBtn, saveBtnRef);
    formCard.append(formActions);
    formCol.append(formCard);

    // ── Right: list + replay pane ──────────────────────────────────────────
    const listCol = createElement('div', 'agents-list-col');
    listColEl = listCol;

    const listHeading = createElement('p', 'agents-list__heading', strings.yourAgents);
    listCol.append(listHeading);

    const searchWrap = createElement('div', 'agents-list__search');
    const search = createSearchBar({
      placeholder: strings.searchPlaceholder,
      onChange: (value) => void populateList(listContent, value.trim()),
    });
    searchWrap.append(search.element);

    const listContainer = createElement('div', 'agents-list__content-container');
    Object.assign(listContainer.style, {
      flex: 1,
      minWidth: '0',
      minHeight: 0,
      position: 'relative',
    });

    const listContent = createElement('div', 'agents-list__content');
    listContentEl = listContent;
    Object.assign(listContent.style, {
      height: '100%',
      width: '100%',
      overflowY: 'auto',
    });

    listContainer.append(listContent);
    attachCustomScrollbar(listContainer, listContent, {
      right: -8,
      top: 4,
      bottom: 4,
      minThumb: 24,
    });
    listCol.append(searchWrap, listContainer);

    // Replay pane — hidden until activated by a "View Replay" card button
    listCol.append(buildReplayPane());

    body.append(formCol, listCol);
    panel.append(body);

    panel._listEl = listContent;
    panel._search = search;
    panel._startEdit = applyAgentToForm;
    panel._resetForm = resetForm;

    panelRef = panel;

    syncFormChrome();
    syncSaveBtn();

    void loadAvatars();
    void loadProviders();

    return panel;
  }

  return { build, populateList };
}
