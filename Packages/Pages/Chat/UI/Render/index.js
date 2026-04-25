import { state } from '../../../../System/State.js';
import { t, getLanguage, applyI18n } from '../../../../System/I18n/index.js';
import { createGitBar } from './Features/GitBar.js';
import { initDOM } from '../../../Shared/Core/DOM.js';
import {
  textarea,
  sendBtn,
  modelDropdown,
  modelSelectorBtn,
  projectOpenFolderBtn,
  projectExitBtn,
} from '../../../Shared/Core/DOM.js';
import { getSubtitles, getTimeGreetings, getRandomGreetings } from './Messages/Messages.js';
import {
  init as initModelSelector,
  loadProviders,
  updateModelLabel,
  buildModelDropdown,
  notifyModelSelectionChanged,
} from '../../Features/ModelSelector/index.js';
import {
  init as initComposer,
  reset as resetComposer,
  syncCapabilities,
  addAttachments,
  syncWorkspacePickerVisibility,
} from '../../Features/Composer/index.js';
import { initSlashCommands, destroySlashCommands } from '../../Features/Composer/SlashCommands.js';
import {
  sendMessage,
  startNewChat,
  loadChat,
  appendMessage,
  showChatView,
  setSendBtnUpdater,
  stopGeneration,
  queueSteeringMessage,
  initChatUI,
  prewarmAgentContext,
} from '../../Features/index.js';
import { cancelSpeak } from '../../Voice/VoicePlayer.js';
import {
  queueCurrentSessionMemorySync,
  initMemoryMicroQueue,
  triggerMicroSync,
} from '../../Features/Core/ChatMemory.js';
import { initTerminalObserver } from '../../Features/UI/TerminalComponent.js';
import { getChatHTML, ensureDropOverlay, getDropOverlay } from './Templates/ChatTemplate.js';
import { createFileDiffTracker } from './Features/FileDiffTracker.js';
import { createEnhanceFeature } from './Features/ChatEnhance.js';
import { createBrowserPreviewFeature } from './Features/BrowserPreview.js';

let _memoryFlushTimer = null;
let gitBar;

// Fallback timer: if the user opens the app but never sends a message,
// this fires triggerMicroSync after a quiet period so catch-up still happens.
// When messages ARE exchanged, triggerMicroSync fires naturally after each
// response — this timer is purely a no-activity safety net.
function scheduleMemoryFlush(delayMs = 45_000) {
  if (_memoryFlushTimer) clearTimeout(_memoryFlushTimer);
  _memoryFlushTimer = setTimeout(() => {
    _memoryFlushTimer = null;
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => triggerMicroSync().catch(() => {}), { timeout: 60_000 });
    } else {
      triggerMicroSync().catch(() => {});
    }
  }, delayMs);
}

function syncWelcomeTitle() {
  const welcomeTitle = document.querySelector('.welcome-title');
  if (!welcomeTitle) return;
  const name =
    String(state.userName ?? '')
      .trim()
      .split(/\s+/)[0] || '';
  if (getLanguage() !== 'en') {
    welcomeTitle.textContent = name ? `${t('chat.welcome')}, ${name}!` : `${t('chat.welcome')}!`;
    return;
  }
  const hour = new Date().getHours();
  const allGreetings = [...getTimeGreetings(hour, name), ...getRandomGreetings(name)];
  welcomeTitle.textContent = allGreetings[Math.floor(Math.random() * allGreetings.length)];
}
function renderStarterPrompts() {
  const container = document.querySelector('.welcome-chips');
  if (!container) return;
  container.innerHTML = '';

  if (state.isIncognito) {
    const doesItems = [
      t('incognito.offRecord'),
      t('incognito.noHistory'),
      t('incognito.clearsOnClose'),
    ];
    const wontItems = [
      t('incognito.wontSave'),
      t('incognito.wontMemory'),
      t('incognito.wontHistory'),
    ];
    for (const label of doesItems) {
      const chip = document.createElement('span');
      chip.className = 'chip chip--info chip--does';
      chip.textContent = label;
      container.appendChild(chip);
    }
    for (const label of wontItems) {
      const chip = document.createElement('span');
      chip.className = 'chip chip--info chip--wont';
      chip.textContent = label;
      container.appendChild(chip);
    }
    return;
  }

  const projectName = state.activeProject?.name?.trim();
  let prompts;
  if (state.workspacePath) {
    const scope = projectName
      ? t('prompts.theProject', { name: projectName })
      : t('prompts.thisWorkspace');
    prompts = [
      {
        label: projectName ? t('prompts.reviewProject') : t('prompts.reviewWorkspace'),
        prompt: t('prompts.reviewScopePrompt', { scope }),
      },
      {
        label: projectName ? t('prompts.debugProject') : t('prompts.debugWorkspace'),
        prompt: t('prompts.debugScopePrompt', { scope }),
      },
      { label: t('prompts.planFeature'), prompt: t('prompts.planScopePrompt', { scope }) },
      { label: t('prompts.whatBuild'), prompt: t('prompts.whatBuildPrompt', { scope }) },
    ];
  } else {
    prompts = [
      { label: t('prompts.reviewCode'), prompt: t('prompts.reviewCodePrompt') },
      { label: t('prompts.debugIssue'), prompt: t('prompts.debugIssuePrompt') },
      { label: t('prompts.planFeature'), prompt: t('prompts.planFeaturePrompt') },
      { label: t('prompts.generateStarter'), prompt: t('prompts.generateStarterPrompt') },
    ];
  }

  for (const { label, prompt } of prompts) {
    const button = document.createElement('button');
    button.className = 'chip';
    button.type = 'button';
    button.dataset.prompt = prompt;
    button.textContent = label;
    container.appendChild(button);
  }
}
function syncProjectUI() {
  const project = state.activeProject,
    bar = document.getElementById('project-context-bar');
  if (!bar) return;
  bar.hidden = !project;
  const ti = document.getElementById('project-context-title'),
    pa = document.getElementById('project-context-path'),
    ta = document.getElementById('chat-input');
  if (project) {
    ti && (ti.textContent = project.name);
    pa && (pa.textContent = project.rootPath);
    ta && (ta.placeholder = t('chat.messageName', { name: project.name }));
  } else {
    ta && (ta.placeholder = t('chat.placeholder'));
  }
  renderStarterPrompts();
  syncWorkspacePickerVisibility?.();
  gitBar?.updateWorkingDir(project?.rootPath ?? null);
}
export function mount(outlet, { settings: _settings, navigate: _navigate }) {
  ((outlet.innerHTML = getChatHTML()),
    initDOM(),
    renderStarterPrompts(),
    syncWelcomeTitle(),
    (function () {
      const el = document.getElementById('welcome-subtitle');
      el &&
        (el.textContent =
          getLanguage() === 'en'
            ? getSubtitles[Math.floor(Math.random() * getSubtitles.length)]
            : t('chat.askAnything'));
    })(),
    (document.title = 'Joanium'),
    syncProjectUI(),
    initModelSelector());
  const pendingId = window._pendingChatId,
    shouldStartFresh = !0 === window._startFreshChat;
  ((window._pendingChatId = null), (window._startFreshChat = !1));
  const cleanupTerminalObserver = initTerminalObserver();
  (initChatUI(),
    setSendBtnUpdater(function () {
      if (!sendBtn) return;
      if (state.isTyping) {
        const hasText = textarea?.value.trim().length > 0;
        const hasAtt = state.composerAttachments?.length > 0;
        if (hasText || hasAtt) {
          return (
            (sendBtn.innerHTML =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13"><path d="M22 2L11 13" stroke-width="2" stroke-linecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke-width="2" stroke-linejoin="round"/></svg>'),
            sendBtn.classList.add('ready', 'is-queue'),
            sendBtn.classList.remove('is-stop'),
            (sendBtn.disabled = !1),
            void (sendBtn.title = 'Queue instructions for next step')
          );
        }
        return (
          (sendBtn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>'),
          sendBtn.classList.add('ready', 'is-stop'),
          sendBtn.classList.remove('is-queue'),
          (sendBtn.disabled = !1),
          void (sendBtn.title = 'Stop generating')
        );
      }
      ((sendBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15"><path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>'),
        sendBtn.classList.remove('is-stop'),
        (sendBtn.title = 'Send'));
      const hasText = textarea?.value.trim().length > 0,
        hasAtt = state.composerAttachments.length > 0,
        hasUnsup =
          state.composerAttachments.some((a) => 'image' === a.type) &&
          !state.selectedProvider?.models?.[state.selectedModel]?.inputs?.image,
        ready = (hasText || hasAtt) && !state.isTyping && !hasUnsup;
      (sendBtn.classList.toggle('ready', ready), (sendBtn.disabled = !ready));
    }));
  const welcomeChips = document.querySelector('.welcome-chips'),
    onStarterChipClick = (e) => {
      const chip = e.target.closest('.chip[data-prompt]');
      chip &&
        textarea &&
        ((textarea.value = chip.getAttribute('data-prompt')),
        textarea.dispatchEvent(new Event('input')),
        textarea.focus());
    };
  (welcomeChips?.addEventListener('click', onStarterChipClick),
    initComposer(() => {
      const text = textarea?.value.trim() ?? '',
        attachments = state.composerAttachments.map((a) => ({ ...a }));
      if (state.isTyping) {
        if (text || attachments.length > 0) {
          queueSteeringMessage(text, attachments);
          resetComposer();
        } else {
          stopGeneration();
        }
        return;
      }
      sendMessage({ text: text, attachments: attachments, sendBtnEl: sendBtn });
    }),
    // Slash commands — /new, /private, /tool
    initSlashCommands(textarea, document.querySelector('.input-box'), {
      onAction(actionId) {
        if ('new' === actionId) {
          _navigate('chat', { startFreshChat: true });
        } else if ('private' === actionId) {
          state.isIncognito = true;
          syncIncognitoUI();
          startNewChatAndReset();
        }
      },
    }),
    projectOpenFolderBtn?.addEventListener('click', async () => {
      state.activeProject?.rootPath &&
        (await window.electronAPI?.invoke?.('open-folder-os', {
          dirPath: state.activeProject.rootPath,
        }));
    }),
    projectExitBtn?.addEventListener('click', () => {
      ((state.activeProject = null),
        (state.workspacePath = null),
        syncProjectUI(),
        startNewChat(),
        window.dispatchEvent(new CustomEvent('jo:project-changed', { detail: { project: null } })));
    }));
  const onDocClick = (e) => {
    !modelDropdown ||
      modelDropdown.contains(e.target) ||
      modelSelectorBtn?.contains(e.target) ||
      modelDropdown.classList.remove('open');
  };
  async function refreshSystemPrompt() {
    try {
      state.systemPrompt = (await window.electronAPI?.invoke?.('get-system-prompt')) ?? '';
    } catch {
      state.systemPrompt = '';
    }
  }
  document.addEventListener('click', onDocClick);
  const onUserActivity = () => scheduleMemoryFlush();
  window.addEventListener('jo:user-activity', onUserActivity);

  const onSettingsSaved = () => refreshSystemPrompt(),
    onUserProfileUpdated = () => syncWelcomeTitle(),
    onWorkspaceChanged = () => {
      (renderStarterPrompts(), prewarmAgentContext().catch(() => {}));
    },
    onProjectChanged = () => {
      (syncProjectUI(), prewarmAgentContext().catch(() => {}));
      if (!state.workspacePath) diffTracker.reset();
    };
  (window.addEventListener('jo:settings-saved', onSettingsSaved),
    window.addEventListener('jo:user-profile-updated', onUserProfileUpdated),
    window.addEventListener('jo:workspace-changed', onWorkspaceChanged),
    window.addEventListener('jo:project-changed', onProjectChanged));
  const onLanguageChanged = () => {
    syncWelcomeTitle();
    renderStarterPrompts();
    syncIncognitoUI();
    syncProjectUI();
    applyI18n(outlet);
  };
  window.addEventListener('jo:language-changed', onLanguageChanged);
  const enhanceBtn = document.getElementById('enhance-btn'),
    enhanceFeature = createEnhanceFeature({
      textarea: textarea,
      enhanceBtn: enhanceBtn,
      state: state,
    }),
    browserPreviewFeature = createBrowserPreviewFeature();
  // Git bar start
  gitBar = createGitBar();
  gitBar.init(state.activeProject?.rootPath ?? null);
  // Git bar end

  // Incognito mode toggle
  const incognitoBtn = document.getElementById('incognito-btn');
  function syncIncognitoUI() {
    if (!incognitoBtn) return;
    incognitoBtn.classList.toggle('incognito-active', state.isIncognito);
    incognitoBtn.title = state.isIncognito ? t('chat.incognitoActive') : t('chat.incognito');

    // Swap welcome logo between Joanium logo and Private.png
    const welcomeLogo = document.querySelector('.welcome-logo');
    if (welcomeLogo) {
      welcomeLogo.src = state.isIncognito
        ? '../../../Assets/App/Private.png'
        : '../../../Assets/Logo/Logo.png';
    }

    // Update welcome subtitle
    const subtitleEl = document.getElementById('welcome-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = state.isIncognito
        ? t('chat.incognitoDesc')
        : getLanguage() === 'en'
          ? getSubtitles[Math.floor(Math.random() * getSubtitles.length)]
          : t('chat.askAnything');
    }

    // Toggle a class on the welcome section for CSS hooks
    document.getElementById('welcome')?.classList.toggle('welcome--incognito', state.isIncognito);

    // Re-render the starter chips
    renderStarterPrompts();
  }
  incognitoBtn?.addEventListener('click', () => {
    state.isIncognito = !state.isIncognito;
    syncIncognitoUI();
  });
  syncIncognitoUI();
  // Incognito mode end

  // File diff tracker — project-only, resets on new chat
  const diffTracker = createFileDiffTracker();
  diffTracker.init();
  const _origStartNewChat = startNewChat;
  function startNewChatAndReset(...args) {
    diffTracker.reset();
    return _origStartNewChat(...args);
  }
  ensureDropOverlay();
  let dragCounter = 0;
  const onDragOver = (e) => {
      (e.preventDefault(), e.stopPropagation());
    },
    onDragEnter = (e) => {
      (e.preventDefault(), e.stopPropagation());
      const overlay = getDropOverlay();
      1 === ++dragCounter &&
        overlay &&
        ((overlay.style.opacity = '1'), (overlay.style.transform = 'scale(1)'));
    },
    onDragLeave = (e) => {
      (e.preventDefault(), e.stopPropagation());
      const overlay = getDropOverlay();
      0 === --dragCounter &&
        overlay &&
        ((overlay.style.opacity = '0'), (overlay.style.transform = 'scale(1.02)'));
    },
    onDrop = async (e) => {
      (e.preventDefault(), e.stopPropagation(), (dragCounter = 0));
      const overlay = getDropOverlay();
      (overlay && ((overlay.style.opacity = '0'), (overlay.style.transform = 'scale(1.02)')),
        e.dataTransfer.files?.length && (await addAttachments(Array.from(e.dataTransfer.files))));
    };
  (document.addEventListener('dragover', onDragOver),
    document.addEventListener('dragenter', onDragEnter),
    document.addEventListener('dragleave', onDragLeave),
    document.addEventListener('drop', onDrop),
    shouldStartFresh && !pendingId
      ? startNewChatAndReset()
      : !pendingId &&
        state.messages.length > 0 &&
        state.messages.length &&
        (showChatView(),
        state.messages.forEach((message) => {
          appendMessage(message.role, message.content, !1, !1, message.attachments ?? []);
        })));
  let pendingChatRestored = !1;
  async function initializeChatBackend() {
    (await loadProviders(),
      syncCapabilities(),
      await refreshSystemPrompt(),
      prewarmAgentContext().catch(() => {}),
      // Load the micro-queue once so reprioritization and triggerMicroSync
      // have data to work with from the very first message onward.
      initMemoryMicroQueue().catch(() => {}),
      pendingId &&
        !pendingChatRestored &&
        ((pendingChatRestored = !0),
        await loadChat(pendingId, {
          updateModelLabel: updateModelLabel,
          buildModelDropdown: buildModelDropdown,
          notifyModelSelectionChanged: notifyModelSelectionChanged,
        })),
      scheduleMemoryFlush(45_000));
  }
  const offBackendReady = window.electronAPI?.on?.('backend-ready', () => {
    initializeChatBackend().catch(() => {});
  });
  return (
    initializeChatBackend().catch(() => {}),
    function () {
      if (_memoryFlushTimer) {
        clearTimeout(_memoryFlushTimer);
        _memoryFlushTimer = null;
      }
      (!state.isIncognito && queueCurrentSessionMemorySync('page-leave').catch(() => {}),
        cleanupTerminalObserver(),
        document.removeEventListener('click', onDocClick),
        document.removeEventListener('dragover', onDragOver),
        document.removeEventListener('dragenter', onDragEnter),
        document.removeEventListener('dragleave', onDragLeave),
        document.removeEventListener('drop', onDrop),
        window.removeEventListener('jo:user-activity', onUserActivity),
        window.removeEventListener('jo:settings-saved', onSettingsSaved),
        window.removeEventListener('jo:user-profile-updated', onUserProfileUpdated),
        window.removeEventListener('jo:workspace-changed', onWorkspaceChanged),
        window.removeEventListener('jo:project-changed', onProjectChanged),
        window.removeEventListener('jo:language-changed', onLanguageChanged),
        offBackendReady?.(),
        cancelSpeak(),
        welcomeChips?.removeEventListener('click', onStarterChipClick),
        enhanceFeature.cleanup(),
        browserPreviewFeature.cleanup(),
        diffTracker.destroy(),
        destroySlashCommands(),
        stopGeneration());
      const overlay = getDropOverlay();
      overlay && (overlay.style.opacity = '0');
    }
  );
}
