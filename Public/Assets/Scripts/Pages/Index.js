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
import { init as initComposer, syncCapabilities } from '../Features/Composer/Composer.js';
import {
  sendMessage, startNewChat, loadChat,
  setSendBtnUpdater,
} from '../Features/Chat/Chat.js';

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

// Send button state
function updateSendBtn() {
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
initComposer(() => {
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

  // Load a chat that was selected from the library on another page
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
//  ENHANCE BUTTON  — drop this block into Index.js
//  after the "Send button state" section.
//
//  Requires: textarea, state, fetchWithTools
//  already imported/defined in Index.js (they are).
// ─────────────────────────────────────────────

const enhanceBtn = document.getElementById('enhance-btn');

/** Sync the enhance button's active/inactive appearance */
function updateEnhanceBtn() {
  if (!enhanceBtn) return;
  const hasText = textarea.value.trim().length > 0;
  enhanceBtn.classList.toggle('enhance-active', hasText && !state.isTyping);
  enhanceBtn.disabled = !hasText || state.isTyping;
}

/** Call the AI and rewrite the user's prompt */
async function handleEnhance() {
  const raw = textarea.value.trim();
  if (!raw || state.isTyping || !state.selectedProvider || !state.selectedModel) return;

  // ── Loading state ─────────────────────────
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
      textarea.dispatchEvent(new Event('input')); // triggers auto-resize + send btn update
    }
  } catch (err) {
    console.warn('[Enhance] Failed:', err.message);
  } finally {
    // ── Restore button ─────────────────────
    enhanceBtn.classList.remove('enhance-loading');
    if (labelEl) labelEl.textContent = 'Enhance';
    updateEnhanceBtn();
  }
}

// Wire events
enhanceBtn?.addEventListener('click', handleEnhance);

// Keep enhance button in sync with textarea content
textarea.addEventListener('input', updateEnhanceBtn);

updateEnhanceBtn();

// Also update when isTyping changes (send btn updater already exists,
// piggyback by wrapping the existing setSendBtnUpdater call):
const _originalSendBtnUpdater = updateSendBtn;
setSendBtnUpdater(() => {
  _originalSendBtnUpdater();
  updateEnhanceBtn();
});