// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Pages/Main.js
//  Page orchestrator for the main chat interface.
// ─────────────────────────────────────────────

import { APP_NAME } from '../Shared/Config.js';
import { state } from '../Shared/State.js';
import {
  textarea, sendBtn, chips,
  modelDropdown, modelSelectorBtn,
} from '../Shared/DOM.js';

// ── Shared UI modules ──────────────────────────────────────────────────
import { initSidebar } from '../Shared/Sidebar.js';
import { initAboutModal } from '../Shared/Modals/AboutModal.js';
import { initLibraryModal } from '../Shared/Modals/LibraryModal.js';
import { initSettingsModal } from '../Shared/Modals/SettingsModal.js';

// ── Features ───────────────────────────────────────────────────────────
import { init as initModelSelector, loadProviders, updateModelLabel, buildModelDropdown, notifyModelSelectionChanged } from '../Features/ModelSelector/ModelSelector.js';
import { init as initComposer, syncCapabilities } from '../Features/Composer/Composer.js';
import {
  sendMessage, startNewChat, loadChat,
  setSendBtnUpdater,
} from '../Features/Chat/Chat.js';

/* ══════════════════════════════════════════
   MODAL INSTANCES
══════════════════════════════════════════ */
const about = initAboutModal();
const settings = initSettingsModal();

const library = initLibraryModal({
  onChatSelect: chatId => loadChat(chatId, {
    updateModelLabel,
    buildModelDropdown,
    notifyModelSelectionChanged,
  }),
});

/* ══════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════ */
const sidebar = initSidebar({
  activePage: 'chat',
  onNewChat: () => startNewChat(() => { library.close(); settings.close(); }),
  onLibrary: () => library.isOpen() ? library.close() : library.open(),
  onAutomations: () => window.electronAPI?.launchAutomations?.(),
  onSettings: () => settings.open(),
  onAbout: () => about.open(),
});

// Keep sidebar in sync whenever the user profile updates (e.g. after saving settings)
window.addEventListener('ow:user-profile-updated', e => {
  sidebar.setUser(e.detail?.name ?? state.userName);
});

/* ══════════════════════════════════════════
   SEND BUTTON STATE
══════════════════════════════════════════ */
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

/* ══════════════════════════════════════════
   SYSTEM PROMPT
══════════════════════════════════════════ */
async function refreshSystemPrompt() {
  try { state.systemPrompt = await window.electronAPI?.getSystemPrompt?.() ?? ''; }
  catch { state.systemPrompt = ''; }
}
window.addEventListener('ow:settings-saved', refreshSystemPrompt);

/* ══════════════════════════════════════════
   CHIPS
══════════════════════════════════════════ */
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

/* ══════════════════════════════════════════
   CLOSE MODEL DROPDOWN ON OUTSIDE CLICK
══════════════════════════════════════════ */
document.addEventListener('click', e => {
  if (modelDropdown && !modelDropdown.contains(e.target) && !modelSelectorBtn?.contains(e.target))
    modelDropdown.classList.remove('open');
});

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
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

  // Load a chat that was selected from the Automations library
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
