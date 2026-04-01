import { state } from '../../../../System/State.js';
import { initDOM } from '../../../Shared/Core/DOM.js';
import {
  textarea, sendBtn,
  modelDropdown, modelSelectorBtn,
  projectOpenFolderBtn, projectExitBtn,
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
  sendMessage, startNewChat, loadChat,
  appendMessage, showChatView,
  setSendBtnUpdater, stopGeneration, initChatUI,
} from '../../Features/index.js';
import { initTerminalObserver } from '../../Features/UI/TerminalComponent.js';

import { getChatHTML, ensureDropOverlay, getDropOverlay } from './Templates/ChatTemplate.js';
import { createEnhanceFeature } from './Features/ChatEnhance.js';
import { createBrowserPreviewFeature } from './Features/BrowserPreview.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getWelcomeTitleText() {
  const rawName = String(state.userName ?? '').trim();
  const firstName = rawName.split(/\s+/)[0];
  const name = firstName || '';

  const hour = new Date().getHours();

  const allGreetings = [...getTimeGreetings(hour, name), ...getRandomGreetings(name)];
  return allGreetings[Math.floor(Math.random() * allGreetings.length)];
}

function syncWelcomeTitle() {
  const welcomeTitle = document.querySelector('.welcome-title');
  if (welcomeTitle) welcomeTitle.textContent = getWelcomeTitleText();
}

function syncWelcomeSubtitle() {
  const el = document.getElementById('welcome-subtitle');
  if (el) el.textContent = getSubtitles[Math.floor(Math.random() * getSubtitles.length)];
}

function getStarterPrompts() {
  const projectName = state.activeProject?.name?.trim();
  const hasWorkspace = Boolean(state.workspacePath);

  if (hasWorkspace) {
    const scopeLabel = projectName ? `the project "${projectName}"` : 'this workspace';
    const appLabel = projectName ? `"${projectName}"` : 'this workspace';

    return [
      {
        label: projectName ? 'Review this project' : 'Review this workspace',
        prompt: `Summarize ${scopeLabel} and point out the top 3 things I should improve next.`,
      },
      {
        label: projectName ? 'Debug this project' : 'Debug this workspace',
        prompt: `Help me debug an issue in ${appLabel}. Ask for the files you need and guide me step by step.`,
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
      prompt: 'Review the code or approach I share and point out the top 3 improvements you would make.',
    },
    {
      label: 'Debug an issue',
      prompt: 'Help me debug an issue. Ask for the code, logs, or error message you need and guide me step by step.',
    },
    {
      label: 'Plan a feature',
      prompt: 'Help me plan a new feature with milestones, risks, and a clean implementation order.',
    },
    {
      label: 'Generate starter code',
      prompt: 'Generate starter code for what I want to build and tell me which files to create.',
    },
  ];
}

function renderStarterPrompts() {
  const container = document.querySelector('.welcome-chips');
  if (!container) return;

  container.innerHTML = '';
  for (const { label, prompt } of getStarterPrompts()) {
    const button = document.createElement('button');
    button.className = 'chip';
    button.type = 'button';
    button.dataset.prompt = prompt;
    button.textContent = label;
    container.appendChild(button);
  }
}

function restoreChatFromState() {
  if (!state.messages.length) return;
  showChatView();
  state.messages.forEach(message => {
    appendMessage(message.role, message.content, false, false, message.attachments ?? []);
  });
}

function syncProjectUI() {
  const project = state.activeProject;
  const bar = document.getElementById('project-context-bar');
  if (!bar) return;
  bar.hidden = !project;
  const ti = document.getElementById('project-context-title');
  const pa = document.getElementById('project-context-path');
  const ta = document.getElementById('chat-input');
  if (project) {
    if (ti) ti.textContent = project.name;
    if (pa) pa.textContent = project.rootPath;
    if (ta) ta.placeholder = `Message ${project.name}`;
  } else {
    if (ta) ta.placeholder = 'How can I help you today?';
  }
  renderStarterPrompts();
  syncWorkspacePickerVisibility?.();
}

// ── mount ────────────────────────────────────────────────────────────────────
export function mount(outlet, { settings, navigate }) {
  outlet.innerHTML = getChatHTML();

  // CRITICAL: initDOM() must be called after HTML is injected.
  initDOM();
  renderStarterPrompts();
  syncWelcomeTitle();
  syncWelcomeSubtitle();

  const APP_NAME = 'Joanium';
  document.title = APP_NAME;

  syncProjectUI();
  initModelSelector();

  // initTerminalObserver returns a cleanup function — capture it so we can
  // disconnect the MutationObserver when this page unmounts, preventing
  // observer accumulation across SPA navigations.
  const cleanupTerminalObserver = initTerminalObserver();

  initChatUI();

  // ── Send button ──────────────────────────────────────────────────────────
  const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15"><path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>`;
  const STOP_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>`;

  function updateSendBtn() {
    if (!sendBtn) return;
    if (state.isTyping) {
      sendBtn.innerHTML = STOP_ICON;
      sendBtn.classList.add('ready', 'is-stop');
      sendBtn.disabled = false;
      sendBtn.title = 'Stop generating';
      return;
    }
    sendBtn.innerHTML = SEND_ICON;
    sendBtn.classList.remove('is-stop');
    sendBtn.title = 'Send';
    const hasText = textarea?.value.trim().length > 0;
    const hasAtt = state.composerAttachments.length > 0;
    const hasUnsup = state.composerAttachments.some(a => a.type === 'image') &&
      !state.selectedProvider?.models?.[state.selectedModel]?.inputs?.image;
    const ready = (hasText || hasAtt) && !state.isTyping && !hasUnsup;
    sendBtn.classList.toggle('ready', ready);
    sendBtn.disabled = !ready;
  }
  setSendBtnUpdater(updateSendBtn);

  // ── Prompt chips ──────────────────────────────────────────────────────────
  const welcomeChips = document.querySelector('.welcome-chips');
  const onStarterChipClick = e => {
    const chip = e.target.closest('.chip[data-prompt]');
    if (!chip || !textarea) return;
    textarea.value = chip.getAttribute('data-prompt');
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
  };
  welcomeChips?.addEventListener('click', onStarterChipClick);

  // ── Composer ──────────────────────────────────────────────────────────────
  initComposer(() => {
    if (state.isTyping) { stopGeneration(); return; }
    const text = textarea?.value.trim() ?? '';
    const attachments = state.composerAttachments.map(a => ({ ...a }));
    sendMessage({ text, attachments, sendBtnEl: sendBtn });
  });

  // ── Project folder / exit ────────────────────────────────────────────────
  projectOpenFolderBtn?.addEventListener('click', async () => {
    if (!state.activeProject?.rootPath) return;
    await window.electronAPI?.openFolderOS?.({ dirPath: state.activeProject.rootPath });
  });
  projectExitBtn?.addEventListener('click', () => {
    state.activeProject = null;
    state.workspacePath = null;
    syncProjectUI();
    startNewChat();
    window.dispatchEvent(new CustomEvent('ow:project-changed', { detail: { project: null } }));
  });

  // ── Model dropdown outside-click ─────────────────────────────────────────
  const onDocClick = e => {
    if (modelDropdown && !modelDropdown.contains(e.target) && !modelSelectorBtn?.contains(e.target)) {
      modelDropdown.classList.remove('open');
    }
  };
  document.addEventListener('click', onDocClick);

  // ── System prompt / profile refresh ──────────────────────────────────────
  async function refreshSystemPrompt() {
    try { state.systemPrompt = await window.electronAPI?.getSystemPrompt?.() ?? ''; }
    catch { state.systemPrompt = ''; }
  }
  const onSettingsSaved = () => refreshSystemPrompt();
  const onUserProfileUpdated = () => syncWelcomeTitle();
  const onWorkspaceChanged = () => renderStarterPrompts();
  const onProjectChanged = () => syncProjectUI();
  window.addEventListener('ow:settings-saved', onSettingsSaved);
  window.addEventListener('ow:user-profile-updated', onUserProfileUpdated);
  window.addEventListener('ow:workspace-changed', onWorkspaceChanged);
  window.addEventListener('ow:project-changed', onProjectChanged);

  // ── Enhance button ────────────────────────────────────────────────────────
  const enhanceBtn = document.getElementById('enhance-btn');
  const enhanceFeature = createEnhanceFeature({ textarea, enhanceBtn, state });
  const browserPreviewFeature = createBrowserPreviewFeature();

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  ensureDropOverlay();
  let dragCounter = 0;
  const onDragOver = e => { e.preventDefault(); e.stopPropagation(); };
  const onDragEnter = e => {
    e.preventDefault(); e.stopPropagation();
    const overlay = getDropOverlay();
    if (++dragCounter === 1 && overlay) { overlay.style.opacity = '1'; overlay.style.transform = 'scale(1)'; }
  };
  const onDragLeave = e => {
    e.preventDefault(); e.stopPropagation();
    const overlay = getDropOverlay();
    if (--dragCounter === 0 && overlay) { overlay.style.opacity = '0'; overlay.style.transform = 'scale(1.02)'; }
  };
  const onDrop = async e => {
    e.preventDefault(); e.stopPropagation();
    dragCounter = 0;
    const overlay = getDropOverlay();
    if (overlay) { overlay.style.opacity = '0'; overlay.style.transform = 'scale(1.02)'; }
    if (e.dataTransfer.files?.length) await addAttachments(Array.from(e.dataTransfer.files));
  };
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('dragenter', onDragEnter);
  document.addEventListener('dragleave', onDragLeave);
  document.addEventListener('drop', onDrop);

  // ── Load providers, then show initial content ─────────────────────────────
  loadProviders().then(async () => {
    syncCapabilities();
    await refreshSystemPrompt();

    const pendingId = window._pendingChatId;
    const shouldStartFresh = window._startFreshChat === true;
    window._pendingChatId = null;
    window._startFreshChat = false;

    if (pendingId) {
      await loadChat(pendingId, { updateModelLabel, buildModelDropdown, notifyModelSelectionChanged });
      return;
    }
    if (shouldStartFresh) { startNewChat(); return; }
    if (state.messages.length > 0) restoreChatFromState();
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────
  return function unmount() {
    // Disconnect the terminal MutationObserver — prevents accumulation across
    // SPA navigations (each mount registers a new one without this).
    cleanupTerminalObserver();

    document.removeEventListener('click', onDocClick);
    document.removeEventListener('dragover', onDragOver);
    document.removeEventListener('dragenter', onDragEnter);
    document.removeEventListener('dragleave', onDragLeave);
    document.removeEventListener('drop', onDrop);
    window.removeEventListener('ow:settings-saved', onSettingsSaved);
    window.removeEventListener('ow:user-profile-updated', onUserProfileUpdated);
    window.removeEventListener('ow:workspace-changed', onWorkspaceChanged);
    window.removeEventListener('ow:project-changed', onProjectChanged);
    welcomeChips?.removeEventListener('click', onStarterChipClick);
    enhanceFeature.cleanup();
    browserPreviewFeature.cleanup();
    stopGeneration();
    const overlay = getDropOverlay();
    if (overlay) overlay.style.opacity = '0';
  };
}
