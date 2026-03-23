import { APP_NAME } from '../Shared/Config.js';
import { state } from '../Shared/State.js';
import {
  textarea, sendBtn, chips,
  modelDropdown, modelSelectorBtn,
} from '../Shared/DOM.js';

// Window controls
import '../Shared/WindowControls.js';

import { fetchWithTools } from '../Features/AI/AIProvider.js';

// Modals
import { initSidebar } from '../Shared/Sidebar.js';
import { initAboutModal } from '../Shared/Modals/AboutModal.js';
import { initLibraryModal } from '../Shared/Modals/LibraryModal.js';
import { initSettingsModal } from '../Shared/Modals/SettingsModal.js';

// Features
import { init as initModelSelector, loadProviders, updateModelLabel, buildModelDropdown, notifyModelSelectionChanged } from '../Features/ModelSelector/ModelSelector.js';
import { init as initComposer, syncCapabilities, addAttachments } from '../Features/Composer/Composer.js';
import {
  sendMessage, startNewChat, loadChat,
  setSendBtnUpdater, stopGeneration,
} from '../Features/Chat/Chat.js';
import { initTerminalObserver } from '../Features/Chat/TerminalComponent.js';

// Modal instances
const about = initAboutModal();
const settings = initSettingsModal();

const library = initLibraryModal({
  onChatSelect: chatId => loadChat(chatId, {
    updateModelLabel,
    buildModelDropdown,
    notifyModelSelectionChanged,
  }),
});

// Sidebar
const sidebar = initSidebar({
  activePage: 'chat',
  onNewChat: () => startNewChat(() => { library.close(); settings.close(); }),
  onLibrary: () => library.isOpen() ? library.close() : library.open(),
  onAutomations: () => window.electronAPI?.launchAutomations?.(),
  onAgents: () => window.electronAPI?.launchAgents?.(),
  onEvents: () => window.electronAPI?.launchEvents?.(),
  onSkills: () => window.electronAPI?.launchSkills?.(),
  onPersonas: () => window.electronAPI?.launchPersonas?.(),
  onUsage: () => window.electronAPI?.launchUsage?.(),
  onSettings: () => settings.open(),
  onAbout: () => about.open(),
});

// Keep sidebar in sync whenever the user profile updates
window.addEventListener('ow:user-profile-updated', e => {
  sidebar.setUser(e.detail?.name ?? state.userName);
});

/* ══════════════════════════════════════════
   SEND / STOP BUTTON
   When state.isTyping is true the button
   becomes a stop button (square icon, red hover).
   Clicking it calls stopGeneration() from Chat.js.
══════════════════════════════════════════ */

const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15">
  <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
</svg>`;

const STOP_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
  <rect x="5" y="5" width="14" height="14" rx="3"/>
</svg>`;

function updateSendBtn() {
  if (state.isTyping) {
    // Switch to stop mode
    sendBtn.innerHTML = STOP_ICON;
    sendBtn.classList.add('ready', 'is-stop');
    sendBtn.disabled = false;
    sendBtn.title = 'Stop generating';
    return;
  }

  // Back to send mode
  sendBtn.innerHTML = SEND_ICON;
  sendBtn.classList.remove('is-stop');
  sendBtn.title = 'Send';

  const hasText = textarea.value.trim().length > 0;
  const hasAttachments = state.composerAttachments.length > 0;
  const hasUnsupported = state.composerAttachments.some(a => a.type === 'image') &&
    !state.selectedProvider?.models?.[state.selectedModel]?.inputs?.image;
  const ready = (hasText || hasAttachments) && !state.isTyping && !hasUnsupported;
  sendBtn.classList.toggle('ready', ready);
  sendBtn.disabled = !ready;
}
setSendBtnUpdater(updateSendBtn);

// System prompt
async function refreshSystemPrompt() {
  try { state.systemPrompt = await window.electronAPI?.getSystemPrompt?.() ?? ''; }
  catch { state.systemPrompt = ''; }
}
window.addEventListener('ow:settings-saved', refreshSystemPrompt);

// Chips
chips.forEach(chip => {
  chip.addEventListener('click', () => {
    textarea.value = chip.getAttribute('data-prompt');
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
    chip.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.95)' }, { transform: 'scale(1)' }],
      { duration: 200, easing: 'ease-out' },
    );
  });
});

// Close model dropdown on outside click
document.addEventListener('click', e => {
  if (modelDropdown && !modelDropdown.contains(e.target) && !modelSelectorBtn?.contains(e.target))
    modelDropdown.classList.remove('open');
});

// Init
document.title = APP_NAME;

initModelSelector();
initTerminalObserver();

// Wire composer — stop generation if typing, otherwise send
initComposer(() => {
  if (state.isTyping) {
    stopGeneration();
    return;
  }
  const text = textarea.value.trim();
  const attachments = state.composerAttachments.map(a => ({ ...a }));
  sendMessage({ text, attachments, sendBtnEl: sendBtn });
});

// Load providers → sync capabilities → load user → refresh system prompt
loadProviders().then(async () => {
  syncCapabilities();
  const user = await settings.loadUser();
  sidebar.setUser(user?.name ?? '');
  await refreshSystemPrompt();

  const pendingChatId = localStorage.getItem('ow-pending-chat');
  if (pendingChatId) {
    localStorage.removeItem('ow-pending-chat');
    await loadChat(pendingChatId, {
      updateModelLabel,
      buildModelDropdown,
      notifyModelSelectionChanged,
    });
  }
});

console.log(`[${APP_NAME}] loaded`);

// ─────────────────────────────────────────────
//  ENHANCE BUTTON
// ─────────────────────────────────────────────

const enhanceBtn = document.getElementById('enhance-btn');

function updateEnhanceBtn() {
  if (!enhanceBtn) return;
  const hasText = textarea.value.trim().length > 0;
  enhanceBtn.classList.toggle('enhance-active', hasText && !state.isTyping);
  enhanceBtn.disabled = !hasText || state.isTyping;
}

async function handleEnhance() {
  const raw = textarea.value.trim();
  if (!raw || state.isTyping || !state.selectedProvider || !state.selectedModel) return;

  enhanceBtn.classList.remove('enhance-active');
  enhanceBtn.classList.add('enhance-loading');
  enhanceBtn.disabled = true;
  const labelEl = enhanceBtn.querySelector('.enhance-btn-label');
  if (labelEl) labelEl.textContent = 'Enhancing…';

  try {
    const result = await fetchWithTools(
      state.selectedProvider,
      state.selectedModel,
      [{ role: 'user', content: raw, attachments: [] }],
      [
        'You are a prompt-enhancement assistant.',
        'Rewrite the user\'s message into a clearer, more specific, and more effective prompt.',
        'Keep the same intent and language style.',
        'Return ONLY the enhanced prompt — no preamble, no quotes, no explanation.',
      ].join(' '),
      [],
    );

    if (result.type === 'text' && result.text && result.text !== '(empty response)') {
      textarea.value = result.text;
      textarea.dispatchEvent(new Event('input'));
    }
  } catch (err) {
    console.warn('[Enhance] Failed:', err.message);
  } finally {
    enhanceBtn.classList.remove('enhance-loading');
    if (labelEl) labelEl.textContent = 'Enhance';
    updateEnhanceBtn();
  }
}

enhanceBtn?.addEventListener('click', handleEnhance);
textarea.addEventListener('input', updateEnhanceBtn);
updateEnhanceBtn();

const _originalSendBtnUpdater = updateSendBtn;
setSendBtnUpdater(() => {
  _originalSendBtnUpdater();
  updateEnhanceBtn();
});

// ─────────────────────────────────────────────
//  DRAG AND DROP
// ─────────────────────────────────────────────

let dragCounter = 0;

const dropOverlay = document.createElement('div');
dropOverlay.className = 'drop-overlay';
dropOverlay.innerHTML = '<div class="drop-overlay-content"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48" style="margin-bottom:12px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg><h2>Drop files to attach</h2></div>';
document.body.appendChild(dropOverlay);

Object.assign(dropOverlay.style, {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, opacity: 0, pointerEvents: 'none',
  transition: 'opacity 0.2s ease, transform 0.2s ease',
  transform: 'scale(1.02)'
});
Object.assign(dropOverlay.querySelector('.drop-overlay-content').style, {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  color: 'white'
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter++;
  if (dragCounter === 1) {
    dropOverlay.style.opacity = '1';
    dropOverlay.style.transform = 'scale(1)';
  }
});

document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter--;
  if (dragCounter === 0) {
    dropOverlay.style.opacity = '0';
    dropOverlay.style.transform = 'scale(1.02)';
  }
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter = 0;
  dropOverlay.style.opacity = '0';
  dropOverlay.style.transform = 'scale(1.02)';

  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    await addAttachments(Array.from(e.dataTransfer.files));
  }
});
