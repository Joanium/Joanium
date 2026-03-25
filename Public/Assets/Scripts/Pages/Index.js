import { state } from '../Shared/State.js';
import { initDOM } from '../Shared/DOM.js';
import {
  textarea, sendBtn, chips,
  modelDropdown, modelSelectorBtn,
  projectContextBar, projectContextTitle, projectContextPath, projectContextInfo,
  projectOpenFolderBtn, projectExitBtn,
} from '../Shared/DOM.js';

import { fetchWithTools } from '../Features/AI/AIProvider.js';
import {
  init as initModelSelector,
  loadProviders,
  updateModelLabel,
  buildModelDropdown,
  notifyModelSelectionChanged,
} from '../Features/ModelSelector/ModelSelector.js';
import {
  init as initComposer,
  syncCapabilities,
  addAttachments,
  syncWorkspacePickerVisibility,
} from '../Features/Composer/Composer.js';
import {
  sendMessage, startNewChat, loadChat,
  setSendBtnUpdater, stopGeneration, initChatUI,
} from '../Features/Chat/Chat.js';
import { initTerminalObserver } from '../Features/Chat/TerminalComponent.js';

// ── Page HTML ────────────────────────────────────────────────────────────────
function getHTML() {
  return /* html */`
<main id="main">
  <section id="project-context-bar" hidden>
    <div class="project-context-compact">
      <div class="project-compact-info">
        <span id="project-context-title" class="project-compact-title"></span>
        <span class="project-divider">/</span>
        <span id="project-context-path" class="project-compact-path"></span>
        <span id="project-context-info" style="display:none"></span>
      </div>
      <div class="project-compact-actions">
        <button id="project-open-folder-btn" class="project-secondary-btn" type="button">Open</button>
        <button id="project-exit-btn" class="project-secondary-btn" type="button">Leave</button>
      </div>
    </div>
  </section>

  <div id="chat-timeline" class="chat-timeline" aria-hidden="true">
    <div class="chat-timeline-track"></div>
  </div>

  <button id="scroll-to-bottom" class="scroll-to-bottom-btn" title="Scroll to bottom" aria-label="Scroll to bottom">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7"/>
    </svg>
  </button>

  <section id="welcome">
    <div class="welcome-greeting">
      <svg class="welcome-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2L8 6H4v4L2 12l2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4L12 2z" stroke-width="1.4"/>
      </svg>
      <h1 class="welcome-title">Welcome</h1>
    </div>
  </section>

  <section id="chat-view">
    <div class="chat-messages" id="chat-messages"></div>
  </section>

  <div id="input-area">
    <div class="input-box">
      <div id="composer-attachments" class="composer-attachments" hidden></div>
      <textarea id="chat-input" placeholder="How can I help you today?" rows="1" autofocus></textarea>
      <div id="composer-hint" class="composer-hint" aria-live="polite"></div>
      <div class="input-footer">
        <div class="model-selector-wrap">
          <button class="model-selector" id="model-selector-btn">
            <span id="model-label">Loading...</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div id="model-dropdown"></div>
        </div>
        <div class="input-actions">
          <button class="icon-btn" id="attachment-btn" title="Attach files">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="icon-btn" id="folder-btn" title="Open Workspace Folder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
          <button class="icon-btn" id="enhance-btn" title="Enhance prompt">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6"/>
            </svg>
          </button>
          <button class="send-btn" id="send-btn" title="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    <p class="footer-credit">Made with ❤️ by <a href="https://joeljolly.vercel.app" target="_blank" rel="noopener noreferrer" class="credit-name">Joel Jolly</a></p>
  </div>
</main>
`;
}

// ── Drag-and-drop overlay (created once, lives in body) ──────────────────────
let _dropOverlay = null;
function ensureDropOverlay() {
  if (_dropOverlay && document.body.contains(_dropOverlay)) return;
  _dropOverlay = document.createElement('div');
  _dropOverlay.className = 'drop-overlay';
  _dropOverlay.innerHTML = '<div class="drop-overlay-content"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48" style="margin-bottom:12px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><h2>Drop files to attach</h2></div>';
  Object.assign(_dropOverlay.style, {
    position:'fixed', top:0, left:0, right:0, bottom:0,
    backgroundColor:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)',
    display:'flex', alignItems:'center', justifyContent:'center',
    zIndex:9999, opacity:0, pointerEvents:'none',
    transition:'opacity 0.2s ease, transform 0.2s ease', transform:'scale(1.02)',
  });
  document.body.appendChild(_dropOverlay);
}

// ── mount ────────────────────────────────────────────────────────────────────
export function mount(outlet, { settings, navigate }) {
  outlet.innerHTML = getHTML();

  // CRITICAL: initDOM() must be called after HTML is injected.
  // It reassigns all the live-binding exports in DOM.js so Chat.js
  // and its sub-modules see real elements instead of null.
  initDOM();

  const APP_NAME = 'Evelina';
  document.title = APP_NAME;

  // Restore active project project context UI
  syncProjectUI();

  // Model selector
  initModelSelector();
  initTerminalObserver();
  initChatUI();

  // Send button state updater
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
    const hasText   = textarea?.value.trim().length > 0;
    const hasAtt    = state.composerAttachments.length > 0;
    const hasUnsup  = state.composerAttachments.some(a => a.type === 'image') &&
                      !state.selectedProvider?.models?.[state.selectedModel]?.inputs?.image;
    const ready = (hasText || hasAtt) && !state.isTyping && !hasUnsup;
    sendBtn.classList.toggle('ready', ready);
    sendBtn.disabled = !ready;
  }
  setSendBtnUpdater(updateSendBtn);

  // Prompt chips
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      if (!textarea) return;
      textarea.value = chip.getAttribute('data-prompt');
      textarea.dispatchEvent(new Event('input'));
      textarea.focus();
    });
  });

  // Composer
  initComposer(() => {
    if (state.isTyping) { stopGeneration(); return; }
    const text        = textarea?.value.trim() ?? '';
    const attachments = state.composerAttachments.map(a => ({ ...a }));
    sendMessage({ text, attachments, sendBtnEl: sendBtn });
  });

  // Project folder / exit
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

  // Model dropdown outside click
  const onDocClick = e => {
    if (modelDropdown && !modelDropdown.contains(e.target) && !modelSelectorBtn?.contains(e.target)) {
      modelDropdown.classList.remove('open');
    }
  };
  document.addEventListener('click', onDocClick);

  // System prompt refresh
  async function refreshSystemPrompt() {
    try { state.systemPrompt = await window.electronAPI?.getSystemPrompt?.() ?? ''; }
    catch { state.systemPrompt = ''; }
  }
  const onSettingsSaved = () => refreshSystemPrompt();
  window.addEventListener('ow:settings-saved', onSettingsSaved);

  // Enhance button
  const enhanceBtn = document.getElementById('enhance-btn');
  function updateEnhanceBtn() {
    if (!enhanceBtn || !textarea) return;
    const has = textarea.value.trim().length > 0;
    enhanceBtn.classList.toggle('enhance-active', has && !state.isTyping);
    enhanceBtn.disabled = !has || state.isTyping;
  }
  async function handleEnhance() {
    if (!textarea?.value.trim() || state.isTyping || !state.selectedProvider || !state.selectedModel) return;
    enhanceBtn.classList.remove('enhance-active');
    enhanceBtn.classList.add('enhance-loading');
    enhanceBtn.disabled = true;
    const labelEl = enhanceBtn.querySelector('.enhance-btn-label');
    if (labelEl) labelEl.textContent = 'Enhancing...';
    try {
      const result = await fetchWithTools(
        state.selectedProvider, state.selectedModel,
        [{ role: 'user', content: textarea.value.trim(), attachments: [] }],
        'You are a prompt-enhancement assistant. Rewrite the user\'s message into a clearer, more specific prompt. Keep the same intent. Return ONLY the enhanced prompt — no preamble.',
        [],
      );
      if (result.type === 'text' && result.text && result.text !== '(empty response)') {
        textarea.value = result.text;
        textarea.dispatchEvent(new Event('input'));
      }
    } catch (err) {
      console.warn('[Chat] Enhance failed:', err.message);
    } finally {
      enhanceBtn.classList.remove('enhance-loading');
      if (labelEl) labelEl.textContent = 'Enhance';
      updateEnhanceBtn();
    }
  }
  enhanceBtn?.addEventListener('click', handleEnhance);
  textarea?.addEventListener('input', updateEnhanceBtn);
  updateEnhanceBtn();

  // Drag-and-drop
  ensureDropOverlay();
  let dragCounter = 0;
  const onDragOver  = e => { e.preventDefault(); e.stopPropagation(); };
  const onDragEnter = e => {
    e.preventDefault(); e.stopPropagation();
    if (++dragCounter === 1) { _dropOverlay.style.opacity='1'; _dropOverlay.style.transform='scale(1)'; }
  };
  const onDragLeave = e => {
    e.preventDefault(); e.stopPropagation();
    if (--dragCounter === 0) { _dropOverlay.style.opacity='0'; _dropOverlay.style.transform='scale(1.02)'; }
  };
  const onDrop = async e => {
    e.preventDefault(); e.stopPropagation();
    dragCounter = 0;
    _dropOverlay.style.opacity='0'; _dropOverlay.style.transform='scale(1.02)';
    if (e.dataTransfer.files?.length) await addAttachments(Array.from(e.dataTransfer.files));
  };
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('dragenter', onDragEnter);
  document.addEventListener('dragleave', onDragLeave);
  document.addEventListener('drop', onDrop);

  // ── Load providers, system prompt, then show initial content ──────────────
  loadProviders().then(async () => {
    syncCapabilities();
    await refreshSystemPrompt();

    // Handle pending chat from library click
    const pendingId = window._pendingChatId;
    if (pendingId) {
      window._pendingChatId = null;
      await loadChat(pendingId, { updateModelLabel, buildModelDropdown, notifyModelSelectionChanged });
    }
  });

  // ── Return cleanup ────────────────────────────────────────────────────────
  return function unmount() {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('dragover', onDragOver);
    document.removeEventListener('dragenter', onDragEnter);
    document.removeEventListener('dragleave', onDragLeave);
    document.removeEventListener('drop', onDrop);
    window.removeEventListener('ow:settings-saved', onSettingsSaved);
    stopGeneration();
    if (_dropOverlay) { _dropOverlay.style.opacity = '0'; }
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  syncWorkspacePickerVisibility?.();
}
