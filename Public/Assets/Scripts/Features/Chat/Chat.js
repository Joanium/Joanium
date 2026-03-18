// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Features/Chat/Chat.js
//  Core chat logic: render messages, call AI, persist chats.
//  Exported functions are called by the page orchestrator (Main.js).
// ─────────────────────────────────────────────

import { state }            from '../../Shared/State.js';
import { escapeHtml }       from '../../Shared/Utils.js';
import { render as renderMarkdown } from '../../Shared/Markdown.js';
import {
  welcome, chatView, chatMessages,
  libraryBackdrop,
}                           from '../../Shared/DOM.js';
import { fetchFromProvider } from '../AI/AIProvider.js';
import { reset as resetComposer } from '../Composer/Composer.js';
import { tryConnectorCommand }    from './ConnectorCommands.js';

/* ══════════════════════════════════════════
   INTERNAL HELPERS
══════════════════════════════════════════ */
function generateChatId() {
  const now = new Date();
  const p   = v => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
}

function normalizeMessage(msg) {
  return {
    role:        msg?.role ?? 'user',
    content:     String(msg?.content ?? ''),
    attachments: Array.isArray(msg?.attachments)
      ? msg.attachments.filter(a => a?.type === 'image' && typeof a.dataUrl === 'string')
      : [],
  };
}

function buildImageFrame(attachment, className) {
  const frame = document.createElement('div');
  frame.className = className;
  frame.title     = attachment.name || 'Pasted image';
  const img   = document.createElement('img');
  img.src     = attachment.dataUrl;
  img.alt     = attachment.name || 'Pasted image';
  img.loading = 'lazy';
  frame.appendChild(img);
  return frame;
}

function appendTextWithLineBreaks(container, text) {
  String(text ?? '').split('\n').forEach((line, i) => {
    if (i > 0) container.appendChild(document.createElement('br'));
    container.appendChild(document.createTextNode(line));
  });
}

function smoothScrollToBottom() {
  chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
}

/* ── Send-button re-enable ── */
let _updateSendBtn = () => {};
export function setSendBtnUpdater(fn) { _updateSendBtn = fn; }

/* ══════════════════════════════════════════
   MESSAGE RENDERING
══════════════════════════════════════════ */
export function appendMessage(role, content, addToState = true, scroll = true, attachments = []) {
  const msg = normalizeMessage({ role, content, attachments });
  if (addToState) state.messages.push(msg);

  const row     = document.createElement('div');
  row.className = `message-row ${msg.role}`;

  if (msg.role === 'user') {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (msg.attachments.length > 0) {
      bubble.classList.add('has-attachments');
      const gallery   = document.createElement('div');
      gallery.className = 'bubble-attachments';
      msg.attachments.forEach(a => gallery.appendChild(buildImageFrame(a, 'bubble-attachment')));
      bubble.appendChild(gallery);
    }

    if (msg.content) {
      const tb    = document.createElement('div');
      tb.className = 'bubble-text';
      appendTextWithLineBreaks(tb, msg.content);
      bubble.appendChild(tb);
    }

    row.appendChild(bubble);
  } else {
    row.innerHTML = `
      <div class="assistant-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 2L8 6H4v4L2 12l2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4L12 2z" stroke-width="1.5"/>
        </svg>
      </div>
      <div class="content"></div>`;
    row.querySelector('.content').innerHTML = renderMarkdown(msg.content);
  }

  chatMessages.appendChild(row);
  if (scroll) smoothScrollToBottom();
  return row;
}

/* ── Replace content of the last assistant bubble ── */
export function replaceLastAssistant(markdown) {
  const rows = chatMessages.querySelectorAll('.message-row.assistant');
  const last = rows[rows.length - 1];
  if (last) {
    const content = last.querySelector('.content');
    if (content) content.innerHTML = renderMarkdown(markdown);
  } else {
    appendMessage('assistant', markdown, false, true);
  }
}

/* ══════════════════════════════════════════
   CHAT VIEW TRANSITION
══════════════════════════════════════════ */
export function showChatView() {
  if (chatView.classList.contains('active')) return;
  welcome.getAnimations().forEach(a => a.cancel());
  welcome.style.display = 'flex';
  const anim = welcome.animate(
    [
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(-16px) scale(0.97)' },
    ],
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
}

/* ══════════════════════════════════════════
   AI CALL — standard conversational flow
══════════════════════════════════════════ */
async function removeTypingRow(typingRow, callback) {
  if (!typingRow.isConnected) {
    state.isTyping = false; _updateSendBtn(); callback?.(); return;
  }
  typingRow.animate(
    [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }],
    { duration: 180, easing: 'ease-in', fill: 'forwards' },
  ).onfinish = () => { typingRow.remove(); state.isTyping = false; _updateSendBtn(); callback?.(); };
}

export async function callAI() {
  state.isTyping = true;
  _updateSendBtn();
  const chatIdAtRequest = state.currentChatId;

  const typingRow       = document.createElement('div');
  typingRow.className   = 'message-row assistant';
  typingRow.id          = 'typing-row';
  typingRow.innerHTML   = `
    <div class="assistant-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2L8 6H4v4L2 12l2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4L12 2z" stroke-width="1.5"/>
      </svg>
    </div>
    <div class="content" style="padding-top:6px">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>`;
  chatMessages.appendChild(typingRow);
  smoothScrollToBottom();

  if (!state.selectedProvider || !state.selectedModel) {
    removeTypingRow(typingRow, () =>
      appendMessage('assistant', 'No AI provider configured. Please add an API key in Settings.')
    );
    return;
  }

  try {
    const reply = await fetchFromProvider(
      state.selectedProvider,
      state.selectedModel,
      state.messages,
      state.systemPrompt,
    );
    removeTypingRow(typingRow, () => {
      if (state.currentChatId !== chatIdAtRequest) return;
      appendMessage('assistant', reply);
      saveCurrentChat();
    });
  } catch (err) {
    const msg = `API Error (${state.selectedProvider.label}): ${err.message}`;
    removeTypingRow(typingRow, () => {
      if (state.currentChatId !== chatIdAtRequest) return;
      appendMessage('assistant', msg);
    });
    console.error('[Chat] API error:', err);
  }
}

/** Call AI with an injected context prompt instead of the last user message. */
export async function callAIWithContext(contextPrompt) {
  state.isTyping = true;
  _updateSendBtn();

  if (!state.selectedProvider || !state.selectedModel) {
    replaceLastAssistant('No AI provider configured. Please add an API key in Settings.');
    state.isTyping = false; _updateSendBtn(); return;
  }

  const contextMessages = [
    ...state.messages.slice(-10),
    { role: 'user', content: contextPrompt, attachments: [] },
  ];

  try {
    const reply = await fetchFromProvider(
      state.selectedProvider,
      state.selectedModel,
      contextMessages,
      state.systemPrompt,
    );
    replaceLastAssistant(reply);
    state.messages.push({ role: 'assistant', content: reply, attachments: [] });
    saveCurrentChat();
  } catch (err) {
    replaceLastAssistant(`AI error: ${err.message}`);
  } finally {
    state.isTyping = false;
    _updateSendBtn();
  }
}

/* ══════════════════════════════════════════
   SEND MESSAGE
══════════════════════════════════════════ */
export async function sendMessage({ text, attachments, sendBtnEl, modelSupportsImage }) {
  if ((!text && attachments.length === 0) || state.isTyping) return;

  if (!state.currentChatId) state.currentChatId = generateChatId();

  showChatView();
  appendMessage('user', text, true, true, attachments);
  resetComposer();

  sendBtnEl?.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(0.85)' },
      { transform: 'scale(1.15)' },
      { transform: 'scale(1)' },
    ],
    { duration: 350, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  );

  const handled = await tryConnectorCommand(text, {
    chatMessages,
    appendMessage,
    callAIWithContext,
    messages: state.messages,
  });

  if (!handled) await callAI();
}

/* ══════════════════════════════════════════
   CHAT PERSISTENCE
══════════════════════════════════════════ */
export async function saveCurrentChat() {
  if (!state.currentChatId || !state.messages.length) return;
  const first = state.messages.find(m => m.role === 'user');
  const title = first?.content?.trim().slice(0, 70) ||
    (first?.attachments?.length ? 'Image attachment' : 'Untitled');

  try {
    await window.electronAPI?.saveChat({
      id:        state.currentChatId,
      title,
      updatedAt: new Date().toISOString(),
      provider:  state.selectedProvider?.provider ?? null,
      model:     state.selectedModel ?? null,
      messages:  state.messages,
    });
  } catch (err) { console.warn('[Chat] Could not save chat:', err); }
}

export function startNewChat(extraCleanup = () => {}) {
  state.messages       = [];
  state.currentChatId  = null;
  state.isTyping       = false;
  document.getElementById('typing-row')?.remove();
  chatMessages.innerHTML = '';
  restoreWelcome();
  resetComposer();
  extraCleanup();
}

/* ══════════════════════════════════════════
   LOAD EXISTING CHAT
══════════════════════════════════════════ */
export async function loadChat(chatId, { updateModelLabel, buildModelDropdown, notifyModelSelectionChanged }) {
  try {
    const chat = await window.electronAPI?.loadChat(chatId);
    if (!chat) return;

    state.messages      = [];
    state.currentChatId = chat.id;
    state.isTyping      = false;
    document.getElementById('typing-row')?.remove();
    chatMessages.innerHTML = '';
    resetComposer();
    showChatView();

    const restored = (chat.messages ?? []).map(m => ({
      role:        m?.role ?? 'user',
      content:     String(m?.content ?? ''),
      attachments: Array.isArray(m?.attachments)
        ? m.attachments.filter(a => a?.type === 'image' && typeof a.dataUrl === 'string')
        : [],
    }));
    restored.forEach(m => appendMessage(m.role, m.content, false, false, m.attachments));
    state.messages = restored;
    smoothScrollToBottom();

    if (chat.provider && chat.model) {
      const provider = state.providers.find(p => p.provider === chat.provider);
      if (provider) {
        state.selectedProvider = provider;
        state.selectedModel    = chat.model;
        updateModelLabel();
        buildModelDropdown();
      }
    }
    notifyModelSelectionChanged();
    _updateSendBtn();
  } catch (err) { console.error('[Chat] Load error:', err); }
}
