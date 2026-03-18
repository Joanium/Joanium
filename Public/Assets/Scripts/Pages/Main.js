// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Pages/Main.js
//  Page orchestrator for the main chat interface.
//
//  This file wires features together. Business logic lives in Features/.
//  To add a feature: create it in Features/, import it here, call init().
// ─────────────────────────────────────────────

import { APP_NAME }           from '../Shared/Config.js';
import { state }              from '../Shared/State.js';
import {
  textarea, sendBtn, chips,
  sidebarBtns, modelDropdown, modelSelectorBtn,
  avatarPanel,
}                             from '../Shared/DOM.js';

// ── Features ─────────────────────────────────────────────────────────
import { init as initThemes }                          from '../Features/Themes/Themes.js';
import { init as initUser, loadUser, closeAvatarPanel, openSettingsModal, closeSettingsModal } from '../Features/User/User.js';
import { init as initModelSelector, loadProviders, updateModelLabel, buildModelDropdown, notifyModelSelectionChanged } from '../Features/ModelSelector/ModelSelector.js';
import { init as initComposer, reset as resetComposer, syncCapabilities } from '../Features/Composer/Composer.js';
import { init as initLibrary, open as openLibrary, close as closeLibrary, isOpen as isLibraryOpen } from '../Features/Library/Library.js';
import {
  appendMessage, sendMessage, startNewChat, loadChat,
  callAI, setSendBtnUpdater, restoreWelcome,
}                             from '../Features/Chat/Chat.js';
import '../Features/About/About.js';   // self-initializing

/* ══════════════════════════════════════════
   SEND BUTTON STATE
   Chat.js calls this when isTyping changes.
══════════════════════════════════════════ */
function updateSendBtn() {
  const hasText        = textarea.value.trim().length > 0;
  const hasAttachments = state.composerAttachments.length > 0;
  const hasUnsupported = state.composerAttachments.some(a => a.type === 'image') &&
    !state.selectedProvider?.models?.[state.selectedModel]?.inputs?.image;

  const ready = (hasText || hasAttachments) && !state.isTyping && !hasUnsupported;
  sendBtn.classList.toggle('ready', ready);
  sendBtn.disabled = !ready;
}
setSendBtnUpdater(updateSendBtn);

/* ══════════════════════════════════════════
   SYSTEM PROMPT  (refreshed after settings save)
══════════════════════════════════════════ */
async function refreshSystemPrompt() {
  try   { state.systemPrompt = await window.electronAPI?.getSystemPrompt?.() ?? ''; }
  catch { state.systemPrompt = ''; }
}
window.addEventListener('ow:settings-saved', refreshSystemPrompt);

/* ══════════════════════════════════════════
   CHIPS  (quick-send prompts on welcome screen)
══════════════════════════════════════════ */
chips.forEach(chip => {
  chip.addEventListener('click', () => {
    textarea.value = chip.getAttribute('data-prompt');
    textarea.dispatchEvent(new Event('input'));   // triggers auto-resize
    textarea.focus();
    chip.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.95)' }, { transform: 'scale(1)' }],
      { duration: 200, easing: 'ease-out' },
    );
  });
});

/* ══════════════════════════════════════════
   SIDEBAR NAVIGATION
══════════════════════════════════════════ */
sidebarBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;

    if (view === 'chat') {
      startNewChat(() => { closeLibrary(); closeAvatarPanel(); closeSettingsModal(); });
      sidebarBtns.forEach(b => b.classList.remove('active'));
      return;
    }

    if (view === 'library') {
      if (isLibraryOpen()) { closeLibrary(); }
      else { sidebarBtns.forEach(b => b.classList.remove('active')); openLibrary(closeAvatarPanel); }
      return;
    }

    if (view === 'automations') {
      window.electronAPI?.launchAutomations?.();
      return;
    }

    sidebarBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    closeLibrary();
  });
});

/* ══════════════════════════════════════════
   CLOSE DROPDOWNS ON OUTSIDE CLICK
══════════════════════════════════════════ */
document.addEventListener('click', e => {
  if (modelDropdown && !modelDropdown.contains(e.target) && !modelSelectorBtn?.contains(e.target))
    modelDropdown.classList.remove('open');
});

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.title = APP_NAME;

initThemes();
initUser();
initModelSelector();
initComposer(() => {
  // Called when the user submits a message
  const text        = textarea.value.trim();
  const attachments = state.composerAttachments.map(a => ({ ...a }));
  sendMessage({ text, attachments, sendBtnEl: sendBtn });
});
initLibrary(
  chatId => loadChat(chatId, { updateModelLabel, buildModelDropdown, notifyModelSelectionChanged }),
  closeAvatarPanel,
);

// Load providers → then sync capabilities + user + system prompt
loadProviders().then(async () => {
  syncCapabilities();
  await loadUser();
  await refreshSystemPrompt();
});

console.log(`[${APP_NAME}] loaded`);
