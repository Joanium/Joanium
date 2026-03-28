import { state } from '../../Shared/Core/State.js';
import { welcome, chatView, chatMessages } from '../../Shared/Core/DOM.js';
import { fetchWithTools } from '../AI/index.js';
import { reset as resetComposer } from '../Composer/index.js';
import { planRequest, agentLoop } from './Core/Agent.js';

// Sub-modules
import { onChatMessagesClick, appendMessage, createLiveRow, sanitizeAssistantReply, sanitizeMessagesForUI } from './UI/ChatBubble.js';
import { updateTimeline, setupScrollFeatures, bumpScrollBadge } from './UI/ChatTimeline.js';
import { attemptMemoryUpdate, resetMemoryCounter } from './Core/ChatMemory.js';
import { saveCurrentChat, trackUsage, generateChatId, currentChatScope } from './Data/ChatPersistence.js';

/* ══════════════════════════════════════════
   TOKEN FOOTER — always on
══════════════════════════════════════════ */
document.documentElement.classList.add('show-tokens');

/* ══════════════════════════════════════════
   ABORT CONTROLLER — stop generation
══════════════════════════════════════════ */
let _currentAbortController = null;

/** Call this to cancel the in-flight generation. */
export function stopGeneration() {
  if (_currentAbortController) {
    _currentAbortController.abort();
    _currentAbortController = null;
  }
}

/* ══════════════════════════════════════════
   SEND BUTTON UPDATER
══════════════════════════════════════════ */
let _updateSendBtn = () => { };
export function setSendBtnUpdater(fn) { _updateSendBtn = fn; }

/* ══════════════════════════════════════════
   INIT CHAT UI
══════════════════════════════════════════ */
export function initChatUI() {
  if (chatMessages && chatMessages.dataset.bound !== '1') {
    chatMessages.dataset.bound = '1';
    chatMessages.addEventListener('click', onChatMessagesClick);
  }
  setupScrollFeatures();
  updateTimeline();
}

/* ══════════════════════════════════════════
   RESEND FROM CURRENT STATE
══════════════════════════════════════════ */
async function doSendFromState() {
  if (!state.selectedProvider || !state.selectedModel || state.isTyping) return;

  state.isTyping = true;
  _updateSendBtn();

  const live = createLiveRow(doSendFromState);
  live.push('Thinking…');

  const lastUserMsg = [...state.messages].reverse().find(m => m.role === 'user');
  let plannedSkills = [];
  let plannedToolCalls = [];

  if (lastUserMsg?.content) {
    try {
      const plan = await planRequest(lastUserMsg.content);
      plannedSkills = plan.skills ?? [];
      for (const skillName of (plan.skills ?? [])) {
        const handle = live.push(`[SKILL] ${skillName}`);
        await new Promise(r => setTimeout(r, 120));
        if (handle?.done) handle.done(true);
      }
      if ((plan.toolCalls?.length ?? 0) > 0) {
        const handle = live.push('Preparing the next steps...');
        await new Promise(r => setTimeout(r, 80));
        if (handle?.done) handle.done(true);
      }
      plannedToolCalls = plan.toolCalls ?? [];
    } catch { /* non-fatal */ }
  }

  try {
    _currentAbortController = new AbortController();
    const { text: finalReply, usage, usedProvider, usedModel } = await agentLoop(
      state.messages, live, plannedSkills, plannedToolCalls, state.systemPrompt, _currentAbortController.signal,
    ).finally(() => { _currentAbortController = null; });

    const safeReply = sanitizeAssistantReply(finalReply);
    if (safeReply !== finalReply) live.set(safeReply);
    await trackUsage(usage, state.currentChatId, usedProvider, usedModel);
    state.messages.push({
      role: 'assistant',
      content: safeReply,
      attachments: live.getAttachments?.() ?? [],
    });
    saveCurrentChat();
    bumpScrollBadge();
    attemptMemoryUpdate().catch(() => { });
  } catch (err) {
    _currentAbortController = null;
    if (err.name === 'AbortError') {
      live.setAborted();
      return;
    }
    const errMsg = `Something went wrong: ${err.message}`;
    live.set(errMsg);
    state.messages.push({
      role: 'assistant',
      content: errMsg,
      attachments: live.getAttachments?.() ?? [],
    });
    console.error('[Chat] doSendFromState error:', err);
  } finally {
    state.isTyping = false;
    _updateSendBtn();
    updateTimeline();
  }
}

/* ══════════════════════════════════════════
   CHAT VIEW TRANSITIONS
══════════════════════════════════════════ */
export function showChatView() {
  if (chatView.classList.contains('active')) return;
  welcome.getAnimations().forEach(a => a.cancel());
  welcome.style.display = 'flex';
  const anim = welcome.animate(
    [{ opacity: 1, transform: 'translateY(0) scale(1)' },
    { opacity: 0, transform: 'translateY(-16px) scale(0.97)' }],
    { duration: 280, easing: 'cubic-bezier(0.4,0,1,1)', fill: 'forwards' },
  );
  anim.onfinish = () => { welcome.style.display = 'none'; };
  chatView.classList.add('active');
}

export function restoreWelcome() {
  welcome.getAnimations().forEach(a => a.cancel());
  welcome.style.display = 'flex';
  welcome.style.removeProperty('opacity');
  welcome.style.removeProperty('transform');
  chatView.classList.remove('active');

  const greeting = welcome.querySelector('.welcome-greeting');
  if (greeting) {
    greeting.style.animation = 'none';
    greeting.style.opacity = '1';
    greeting.style.transform = 'none';
    requestAnimationFrame(() => {
      greeting.style.removeProperty('animation');
      greeting.style.removeProperty('opacity');
      greeting.style.removeProperty('transform');
    });
  }
}



/* ══════════════════════════════════════════
   SEND MESSAGE
══════════════════════════════════════════ */
export async function sendMessage({ text, attachments, sendBtnEl }) {
  if ((!text && attachments.length === 0) || state.isTyping) return;

  if (!state.currentChatId) state.currentChatId = generateChatId();

  showChatView();
  appendMessage('user', text, true, true, attachments, doSendFromState);
  resetComposer();

  sendBtnEl?.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(0.85)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
    { duration: 350, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  );

  if (!state.selectedProvider || !state.selectedModel) {
    appendMessage('assistant', 'No AI provider configured. Add an API key, Ollama, or LM Studio in Settings.', true, true, [], doSendFromState);
    return;
  }

  state.isTyping = true;
  _updateSendBtn();

  const live = createLiveRow(doSendFromState);
  live.push('Thinking…');

  let plannedSkills = [];
  let plannedToolCalls = [];

  if (text) {
    try {
      const plan = await planRequest(text);
      plannedSkills = plan.skills ?? [];

      for (const skillName of (plan.skills ?? [])) {
        live.push(`[SKILL] ${skillName}`);
        await new Promise(r => setTimeout(r, 120));
      }
      if ((plan.toolCalls?.length ?? 0) > 0) {
        const handle = live.push('Preparing the next steps...');
        await new Promise(r => setTimeout(r, 80));
        if (handle?.done) handle.done(true);
      }

      plannedToolCalls = plan.toolCalls ?? [];
    } catch { /* non-fatal */ }
  }

  try {
    _currentAbortController = new AbortController();
    const { text: finalReply, usage, usedProvider, usedModel } = await agentLoop(
      state.messages, live, plannedSkills, plannedToolCalls, state.systemPrompt, _currentAbortController.signal,
    ).finally(() => { _currentAbortController = null; });

    const safeReply = sanitizeAssistantReply(finalReply);
    if (safeReply !== finalReply) live.set(safeReply);
    await trackUsage(usage, state.currentChatId, usedProvider, usedModel);
    state.messages.push({
      role: 'assistant',
      content: safeReply,
      attachments: live.getAttachments?.() ?? [],
    });
    saveCurrentChat();
    bumpScrollBadge();
    setTimeout(updateTimeline, 100);

    attemptMemoryUpdate().catch(() => { });

  } catch (err) {
    _currentAbortController = null;
    if (err.name === 'AbortError') {
      live.setAborted();
    } else {
      const msg = `Something went wrong: ${err.message}`;
      live.set(msg);
      state.messages.push({
        role: 'assistant',
        content: msg,
        attachments: live.getAttachments?.() ?? [],
      });
      console.error('[Chat] sendMessage error:', err);
    }
  } finally {
    state.isTyping = false;
    _updateSendBtn();
  }
}

/* ══════════════════════════════════════════
   CHAT SESSION HELPERS
══════════════════════════════════════════ */
export function startNewChat(extraCleanup = () => { }) {
  state.messages = [];
  state.currentChatId = null;
  state.isTyping = false;
  resetMemoryCounter();
  if (_currentAbortController) {
    _currentAbortController.abort();
    _currentAbortController = null;
  }
  document.getElementById('typing-row')?.remove();
  chatMessages.innerHTML = '';
  restoreWelcome();
  resetComposer();
  const timeline = document.getElementById('chat-timeline');
  if (timeline) timeline.classList.remove('visible');
  const scrollBtn = document.getElementById('scroll-to-bottom');
  if (scrollBtn) scrollBtn.classList.remove('visible');
  extraCleanup();
}

export async function loadChat(chatId, { updateModelLabel, buildModelDropdown, notifyModelSelectionChanged }) {
  try {
    const chat = await window.electronAPI?.loadChat(chatId, currentChatScope());
    if (!chat) return;
    state.messages = [];
    state.currentChatId = chat.id;
    state.isTyping = false;
    resetMemoryCounter();
    document.getElementById('typing-row')?.remove();
    chatMessages.innerHTML = '';
    resetComposer();
    showChatView();
    const restored = sanitizeMessagesForUI(chat.messages ?? []);
    state.messages = restored;
    restored.forEach(m => appendMessage(m.role, m.content, false, false, m.attachments, doSendFromState));
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    if (chat.provider && chat.model) {
      const provider = state.providers.find(p => p.provider === chat.provider);
      if (provider) {
        state.selectedProvider = provider;
        state.selectedModel = chat.model;
        updateModelLabel();
        buildModelDropdown();
      }
    }
    notifyModelSelectionChanged();
    _updateSendBtn();
    setTimeout(updateTimeline, 150);
  } catch (err) { console.error('[Chat] Load error:', err); }
}

/* Re-export sub-module helpers needed by other files */
export { saveCurrentChat, trackUsage } from './Data/ChatPersistence.js';
export { appendMessage, sanitizeMessagesForUI } from './UI/ChatBubble.js';
export { updateTimeline } from './UI/ChatTimeline.js';
