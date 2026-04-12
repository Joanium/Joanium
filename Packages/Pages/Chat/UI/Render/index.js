import { state } from '../../../../System/State.js';
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
  syncCapabilities,
  addAttachments,
  syncWorkspacePickerVisibility,
} from '../../Features/Composer/index.js';
import {
  sendMessage,
  startNewChat,
  loadChat,
  appendMessage,
  showChatView,
  setSendBtnUpdater,
  stopGeneration,
  initChatUI,
  prewarmAgentContext,
} from '../../Features/index.js';
import {
  flushPendingPersonalMemorySyncs,
  queueCurrentSessionMemorySync,
} from '../../Features/Core/ChatMemory.js';
import { initTerminalObserver } from '../../Features/UI/TerminalComponent.js';
import { getChatHTML, ensureDropOverlay, getDropOverlay } from './Templates/ChatTemplate.js';
import { createEnhanceFeature } from './Features/ChatEnhance.js';
import { createBrowserPreviewFeature } from './Features/BrowserPreview.js';
function syncWelcomeTitle() {
  const welcomeTitle = document.querySelector('.welcome-title');
  welcomeTitle &&
    (welcomeTitle.textContent = (function () {
      const name =
          String(state.userName ?? '')
            .trim()
            .split(/\s+/)[0] || '',
        hour = new Date().getHours(),
        allGreetings = [...getTimeGreetings(hour, name), ...getRandomGreetings(name)];
      return allGreetings[Math.floor(Math.random() * allGreetings.length)];
    })());
}
function renderStarterPrompts() {
  const container = document.querySelector('.welcome-chips');
  if (container) {
    container.innerHTML = '';
    for (const { label: label, prompt: prompt } of (function () {
      const projectName = state.activeProject?.name?.trim();
      if (Boolean(state.workspacePath)) {
        const scopeLabel = projectName ? `the project "${projectName}"` : 'this workspace';
        return [
          {
            label: projectName ? 'Review this project' : 'Review this workspace',
            prompt: `Summarize ${scopeLabel} and point out the top 3 things I should improve next.`,
          },
          {
            label: projectName ? 'Debug this project' : 'Debug this workspace',
            prompt: `Help me debug an issue in ${projectName ? `"${projectName}"` : 'this workspace'}. Ask for the files you need and guide me step by step.`,
          },
          {
            label: 'Plan a feature',
            prompt: `Plan the next feature for ${scopeLabel} with milestones, risks, and a clean implementation order.`,
          },
          {
            label: 'What should I build?',
            prompt: `Write a focused to-do list for what I should work on next based on ${scopeLabel}.`,
          },
        ];
      }
      return [
        {
          label: 'Review some code',
          prompt:
            'Review the code or approach I share and point out the top 3 improvements you would make.',
        },
        {
          label: 'Debug an issue',
          prompt:
            'Help me debug an issue. Ask for the code, logs, or error message you need and guide me step by step.',
        },
        {
          label: 'Plan a feature',
          prompt:
            'Help me plan a new feature with milestones, risks, and a clean implementation order.',
        },
        {
          label: 'Generate starter code',
          prompt:
            'Generate starter code for what I want to build and tell me which files to create.',
        },
      ];
    })()) {
      const button = document.createElement('button');
      ((button.className = 'chip'),
        (button.type = 'button'),
        (button.dataset.prompt = prompt),
        (button.textContent = label),
        container.appendChild(button));
    }
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
  (project
    ? (ti && (ti.textContent = project.name),
      pa && (pa.textContent = project.rootPath),
      ta && (ta.placeholder = `Message ${project.name}`))
    : ta && (ta.placeholder = 'How can I help you today?'),
    renderStarterPrompts(),
    syncWorkspacePickerVisibility?.());
}
export function mount(outlet, { settings: settings, navigate: navigate }) {
  ((outlet.innerHTML = getChatHTML()),
    initDOM(),
    renderStarterPrompts(),
    syncWelcomeTitle(),
    (function () {
      const el = document.getElementById('welcome-subtitle');
      el && (el.textContent = getSubtitles[Math.floor(Math.random() * getSubtitles.length)]);
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
      if (state.isTyping)
        return (
          (sendBtn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>'),
          sendBtn.classList.add('ready', 'is-stop'),
          (sendBtn.disabled = !1),
          void (sendBtn.title = 'Stop generating')
        );
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
      if (state.isTyping) return void stopGeneration();
      const text = textarea?.value.trim() ?? '',
        attachments = state.composerAttachments.map((a) => ({ ...a }));
      sendMessage({ text: text, attachments: attachments, sendBtnEl: sendBtn });
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
        window.dispatchEvent(new CustomEvent('ow:project-changed', { detail: { project: null } })));
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
  const onSettingsSaved = () => refreshSystemPrompt(),
    onUserProfileUpdated = () => syncWelcomeTitle(),
    onWorkspaceChanged = () => {
      (renderStarterPrompts(), prewarmAgentContext().catch(() => {}));
    },
    onProjectChanged = () => {
      (syncProjectUI(), prewarmAgentContext().catch(() => {}));
    };
  (window.addEventListener('ow:settings-saved', onSettingsSaved),
    window.addEventListener('ow:user-profile-updated', onUserProfileUpdated),
    window.addEventListener('ow:workspace-changed', onWorkspaceChanged),
    window.addEventListener('ow:project-changed', onProjectChanged));
  const enhanceBtn = document.getElementById('enhance-btn'),
    enhanceFeature = createEnhanceFeature({
      textarea: textarea,
      enhanceBtn: enhanceBtn,
      state: state,
    }),
    browserPreviewFeature = createBrowserPreviewFeature();
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
      ? startNewChat()
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
      pendingId &&
        !pendingChatRestored &&
        ((pendingChatRestored = !0),
        await loadChat(pendingId, {
          updateModelLabel: updateModelLabel,
          buildModelDropdown: buildModelDropdown,
          notifyModelSelectionChanged: notifyModelSelectionChanged,
        })),
      flushPendingPersonalMemorySyncs().catch(() => {}));
  }
  const offBackendReady = window.electronAPI?.on?.('backend-ready', () => {
    initializeChatBackend().catch(() => {});
  });
  return (
    initializeChatBackend().catch(() => {}),
    function () {
      (queueCurrentSessionMemorySync('page-leave').catch(() => {}),
        cleanupTerminalObserver(),
        document.removeEventListener('click', onDocClick),
        document.removeEventListener('dragover', onDragOver),
        document.removeEventListener('dragenter', onDragEnter),
        document.removeEventListener('dragleave', onDragLeave),
        document.removeEventListener('drop', onDrop),
        window.removeEventListener('ow:settings-saved', onSettingsSaved),
        window.removeEventListener('ow:user-profile-updated', onUserProfileUpdated),
        window.removeEventListener('ow:workspace-changed', onWorkspaceChanged),
        window.removeEventListener('ow:project-changed', onProjectChanged),
        offBackendReady?.(),
        welcomeChips?.removeEventListener('click', onStarterChipClick),
        enhanceFeature.cleanup(),
        browserPreviewFeature.cleanup(),
        stopGeneration());
      const overlay = getDropOverlay();
      overlay && (overlay.style.opacity = '0');
    }
  );
}
