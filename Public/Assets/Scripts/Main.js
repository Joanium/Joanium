import { APP_NAME } from './Config.js';
import './Themes.js';
import {
  state,
  textarea,
  sendBtn,
  welcome,
  chatView,
  chatMessages,
  attachmentBtn,
  composerAttachments as composerAttachmentsEl,
  composerHint,
  chips,
  sidebarBtns,
  themeBtn,
  themePanel,
  modelSelectorBtn,
  modelDropdown,
  libraryBackdrop,
  libraryClose,
  librarySearch,
  chatList,
  syncModalOpenState,
} from './Root.js';
import {
  loadProviders,
  updateModelLabel,
  buildModelDropdown,
  notifyModelSelectionChanged,
  modelSupportsInput,
} from './ModelSelector.js';
import { loadUser, closeAvatarPanel, closeSettingsModal } from './User.js';
import './About.js';

let composerHintTimer = null;

function autoResize() {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  updateSendBtn();
}

function updateSendBtn() {
  const ready = canSendComposerMessage();
  sendBtn.classList.toggle('ready', ready);
  sendBtn.disabled = !ready;
}

function canSendComposerMessage() {
  const hasText = textarea.value.trim().length > 0;
  const hasAttachments = state.composerAttachments.length > 0;
  return (hasText || hasAttachments) && !state.isTyping && !hasUnsupportedImageAttachments();
}

function hasUnsupportedImageAttachments() {
  return state.composerAttachments.some(
    (attachment) => attachment.type === 'image' && !modelSupportsInput('image')
  );
}

function getSelectedModelName() {
  return state.selectedProvider?.models?.[state.selectedModel]?.name ?? 'This model';
}

function showComposerHint(message, tone = 'info', options = {}) {
  if (!composerHint) return;

  const { sticky = false, reason = '' } = options;
  clearTimeout(composerHintTimer);
  composerHintTimer = null;

  composerHint.textContent = message;
  composerHint.className = `composer-hint visible ${tone}`;
  composerHint.dataset.sticky = sticky ? 'true' : 'false';
  composerHint.dataset.reason = reason;

  if (!sticky) {
    composerHintTimer = window.setTimeout(() => {
      hideComposerHint(true);
    }, 2800);
  }
}

function hideComposerHint(force = false) {
  if (!composerHint) return;
  if (!force && composerHint.dataset.sticky === 'true') return;

  clearTimeout(composerHintTimer);
  composerHintTimer = null;
  composerHint.textContent = '';
  composerHint.className = 'composer-hint';
  composerHint.dataset.sticky = 'false';
  composerHint.dataset.reason = '';
}

function clearCapabilityHintIfResolved() {
  if (composerHint?.dataset.reason === 'unsupported-image' && !hasUnsupportedImageAttachments()) {
    hideComposerHint(true);
  }
}

function syncComposerCapabilities() {
  const supportsImages = modelSupportsInput('image');
  const modelName = getSelectedModelName();

  if (attachmentBtn) {
    attachmentBtn.classList.toggle('is-disabled', !supportsImages);
    attachmentBtn.setAttribute('aria-disabled', String(!supportsImages));
    attachmentBtn.title = supportsImages
      ? 'Paste an image from clipboard'
      : `${modelName} does not support image input`;
  }

  if (!supportsImages && state.composerAttachments.length > 0) {
    showComposerHint(
      `${modelName} cannot send the pasted image. Remove it or switch models.`,
      'warning',
      { sticky: true, reason: 'unsupported-image' }
    );
  } else {
    clearCapabilityHintIfResolved();
  }

  updateSendBtn();
}

function resetComposerDraft() {
  textarea.value = '';
  textarea.style.height = 'auto';
  state.composerAttachments = [];
  renderComposerAttachments();
  hideComposerHint(true);
  autoResize();
}

function generateAttachmentId() {
  return `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function appendTextWithLineBreaks(container, text) {
  const lines = String(text ?? '').split('\n');
  lines.forEach((line, index) => {
    if (index > 0) container.appendChild(document.createElement('br'));
    container.appendChild(document.createTextNode(line));
  });
}

function buildImageFrame(attachment, className) {
  const frame = document.createElement('div');
  frame.className = className;
  frame.title = attachment.name || 'Pasted image';

  const image = document.createElement('img');
  image.src = attachment.dataUrl;
  image.alt = attachment.name || 'Pasted image';
  image.loading = 'lazy';
  frame.appendChild(image);

  return frame;
}

function renderComposerAttachments() {
  if (!composerAttachmentsEl) return;

  composerAttachmentsEl.innerHTML = '';
  composerAttachmentsEl.hidden = state.composerAttachments.length === 0;

  state.composerAttachments.forEach((attachment) => {
    const chip = document.createElement('div');
    chip.className = 'composer-attachment';
    chip.title = attachment.name || 'Pasted image';

    const preview = buildImageFrame(attachment, 'composer-attachment-preview');

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'composer-attachment-remove';
    removeBtn.setAttribute('aria-label', `Remove ${attachment.name || 'image'}`);
    removeBtn.title = `Remove ${attachment.name || 'image'}`;
    removeBtn.textContent = 'x';
    removeBtn.addEventListener('click', () => {
      state.composerAttachments = state.composerAttachments.filter(
        (item) => item.id !== attachment.id
      );
      renderComposerAttachments();
      clearCapabilityHintIfResolved();
      updateSendBtn();
      textarea.focus();
    });

    chip.append(preview, removeBtn);
    composerAttachmentsEl.appendChild(chip);
  });
}

function insertTextAtCursor(text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  const nextValue = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;

  textarea.value = nextValue;

  const nextCursor = start + text.length;
  textarea.setSelectionRange(nextCursor, nextCursor);
  autoResize();
}

function readClipboardImage(item, index) {
  return new Promise((resolve) => {
    const file = item.getAsFile();
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: generateAttachmentId(),
        type: 'image',
        mimeType: file.type || 'image/png',
        name: file.name || `Pasted image ${index + 1}`,
        dataUrl: String(reader.result ?? ''),
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function handleComposerPaste(event) {
  const items = Array.from(event.clipboardData?.items ?? []);
  const imageItems = items.filter((item) => item.type.startsWith('image/'));

  if (imageItems.length === 0) return;

  event.preventDefault();

  const pastedText = event.clipboardData?.getData('text/plain') ?? '';
  if (pastedText) insertTextAtCursor(pastedText);

  if (!modelSupportsInput('image')) {
    showComposerHint(`${getSelectedModelName()} does not support image input.`, 'warning');
    updateSendBtn();
    return;
  }

  const attachments = (await Promise.all(imageItems.map(readClipboardImage))).filter(Boolean);
  if (attachments.length === 0) {
    showComposerHint('That image could not be added from the clipboard.', 'warning');
    return;
  }

  state.composerAttachments = [...state.composerAttachments, ...attachments];
  renderComposerAttachments();
  showComposerHint(
    attachments.length === 1 ? 'Image added to this message.' : `${attachments.length} images added to this message.`,
    'info'
  );
  updateSendBtn();
}

function handleAttachmentButtonClick() {
  textarea.focus();

  if (!modelSupportsInput('image')) {
    showComposerHint(`${getSelectedModelName()} only accepts text right now.`, 'warning');
    return;
  }

  showComposerHint('Copy an image and paste it into the message box.', 'info');
}

textarea.addEventListener('input', autoResize);
textarea.addEventListener('paste', handleComposerPaste);
textarea.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
sendBtn.addEventListener('click', sendMessage);
attachmentBtn?.addEventListener('click', handleAttachmentButtonClick);
window.addEventListener('ow:model-selection-changed', syncComposerCapabilities);

chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    textarea.value = chip.getAttribute('data-prompt');
    autoResize();
    textarea.focus();
    chip.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.95)' }, { transform: 'scale(1)' }],
      { duration: 200, easing: 'ease-out' }
    );
  });
});

function cancelWelcomeAnimations() {
  welcome.getAnimations().forEach((animation) => animation.cancel());
}

function restoreWelcome() {
  cancelWelcomeAnimations();
  welcome.style.display = 'flex';
  welcome.style.removeProperty('opacity');
  welcome.style.removeProperty('transform');
}

function sendMessage() {
  const text = textarea.value.trim();
  const attachments = state.composerAttachments.map((attachment) => ({ ...attachment }));

  if ((!text && attachments.length === 0) || state.isTyping) return;

  if (attachments.length > 0 && !modelSupportsInput('image')) {
    showComposerHint(
      `${getSelectedModelName()} cannot send images. Remove it or switch models.`,
      'warning',
      { sticky: true, reason: 'unsupported-image' }
    );
    updateSendBtn();
    return;
  }

  if (!state.currentChatId) state.currentChatId = generateChatId();

  showChatView();
  appendMessage('user', text, true, true, attachments);

  resetComposerDraft();

  sendBtn.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(0.85)' },
      { transform: 'scale(1.15)' },
      { transform: 'scale(1)' },
    ],
    { duration: 350, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
  );

  callAI();
}

function showChatView() {
  if (chatView.classList.contains('active')) return;

  cancelWelcomeAnimations();
  welcome.style.display = 'flex';

  const animation = welcome.animate(
    [
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(-16px) scale(0.97)' },
    ],
    { duration: 280, easing: 'cubic-bezier(0.4,0,1,1)', fill: 'forwards' }
  );

  animation.onfinish = () => {
    welcome.style.display = 'none';
  };

  chatView.classList.add('active');
}

function normalizeMessage(message) {
  return {
    role: message?.role ?? 'user',
    content: String(message?.content ?? ''),
    attachments: Array.isArray(message?.attachments)
      ? message.attachments.filter(
        (attachment) => attachment?.type === 'image' && typeof attachment.dataUrl === 'string'
      )
      : [],
  };
}

function appendMessage(role, content, addToState = true, scroll = true, attachments = []) {
  const message = normalizeMessage({ role, content, attachments });
  if (addToState) state.messages.push(message);

  const row = document.createElement('div');
  row.className = `message-row ${message.role}`;

  if (message.role === 'user') {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (message.attachments.length > 0) {
      bubble.classList.add('has-attachments');

      const gallery = document.createElement('div');
      gallery.className = 'bubble-attachments';
      message.attachments.forEach((attachment) => {
        gallery.appendChild(buildImageFrame(attachment, 'bubble-attachment'));
      });
      bubble.appendChild(gallery);
    }

    if (message.content) {
      const textBlock = document.createElement('div');
      textBlock.className = 'bubble-text';
      appendTextWithLineBreaks(textBlock, message.content);
      bubble.appendChild(textBlock);
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
    row.querySelector('.content').innerHTML = renderMarkdown(message.content);
  }

  chatMessages.appendChild(row);
  if (scroll) smoothScrollToBottom();
  return row;
}

function smoothScrollToBottom() {
  chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
}

async function callAI() {
  state.isTyping = true;
  updateSendBtn();
  const chatIdAtRequest = state.currentChatId;

  const typingRow = document.createElement('div');
  typingRow.className = 'message-row assistant';
  typingRow.id = 'typing-row';
  typingRow.innerHTML = `
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

  const removeTyping = (callback) => {
    if (!typingRow.isConnected) {
      state.isTyping = false;
      updateSendBtn();
      callback?.();
      return;
    }

    typingRow.animate(
      [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }],
      { duration: 180, easing: 'ease-in', fill: 'forwards' }
    ).onfinish = () => {
      typingRow.remove();
      state.isTyping = false;
      updateSendBtn();
      callback?.();
    };
  };

  if (!state.selectedProvider || !state.selectedModel) {
    removeTyping(() => appendMessage('assistant', 'No AI provider configured. Please add an API key in Settings.'));
    return;
  }

  try {
    const reply = await fetchFromProvider(state.selectedProvider, state.selectedModel, state.messages);
    removeTyping(() => {
      if (state.currentChatId !== chatIdAtRequest) return;
      appendMessage('assistant', reply);
      saveCurrentChat();
    });
  } catch (error) {
    const message = `API Error (${state.selectedProvider.label}): ${error.message}`;
    removeTyping(() => {
      if (state.currentChatId !== chatIdAtRequest) return;
      appendMessage('assistant', message);
    });
    console.error('[openworld] API error:', error);
  }
}

function extractBase64Payload(dataUrl) {
  return String(dataUrl ?? '').split(',', 2)[1] ?? '';
}

function buildAnthropicContent(message) {
  const blocks = [];

  if (message.content) {
    blocks.push({ type: 'text', text: message.content });
  }

  message.attachments.forEach((attachment) => {
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: attachment.mimeType || 'image/png',
        data: extractBase64Payload(attachment.dataUrl),
      },
    });
  });

  if (blocks.length === 1 && blocks[0].type === 'text') {
    return message.content;
  }

  return blocks;
}

function buildGoogleParts(message) {
  const parts = [];

  if (message.content) {
    parts.push({ text: message.content });
  }

  message.attachments.forEach((attachment) => {
    parts.push({
      inlineData: {
        mimeType: attachment.mimeType || 'image/png',
        data: extractBase64Payload(attachment.dataUrl),
      },
    });
  });

  return parts;
}

function buildOpenAIContent(message) {
  if (message.attachments.length === 0) {
    return message.content;
  }

  const parts = [];

  if (message.content) {
    parts.push({ type: 'text', text: message.content });
  }

  message.attachments.forEach((attachment) => {
    parts.push({
      type: 'image_url',
      image_url: {
        url: attachment.dataUrl,
      },
    });
  });

  return parts;
}

async function fetchFromProvider(provider, modelId, messages) {
  const { provider: providerId, endpoint, api, auth_header, auth_prefix = '' } = provider;
  const history = messages.slice(-20).map(normalizeMessage);

  if (providerId === 'anthropic') {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': api,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 2048,
        messages: history.map((message) => ({
          role: message.role,
          content: buildAnthropicContent(message),
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `HTTP ${response.status}`);
    }

    return (await response.json()).content?.[0]?.text ?? '(empty response)';
  }

  if (providerId === 'google') {
    const url = endpoint.replace('{model}', modelId) + `?key=${api}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: history.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: buildGoogleParts(message),
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `HTTP ${response.status}`);
    }

    return (await response.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? '(empty response)';
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [auth_header]: `${auth_prefix}${api}`,
      ...(providerId === 'openrouter'
        ? { 'HTTP-Referer': 'https://openworld.app', 'X-Title': 'openworld' }
        : {}),
    },
    body: JSON.stringify({
      model: modelId,
      messages: history.map((message) => ({
        role: message.role,
        content: buildOpenAIContent(message),
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message ?? `HTTP ${response.status}`);
  }

  return (await response.json()).choices?.[0]?.message?.content ?? '(empty response)';
}

function generateChatId() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${date}_${time}`;
}

async function saveCurrentChat() {
  if (!state.currentChatId || state.messages.length === 0) return;

  const firstUserMessage = state.messages.find((message) => message.role === 'user');
  const title =
    firstUserMessage?.content?.trim().slice(0, 70) ||
    (firstUserMessage?.attachments?.length ? 'Image attachment' : 'Untitled');

  try {
    await window.electronAPI?.saveChat({
      id: state.currentChatId,
      title,
      updatedAt: new Date().toISOString(),
      provider: state.selectedProvider?.provider ?? null,
      model: state.selectedModel ?? null,
      messages: state.messages,
    });
  } catch (error) {
    console.warn('[openworld] Could not save chat:', error);
  }
}

function startNewChat() {
  state.messages = [];
  state.currentChatId = null;
  state.isTyping = false;

  document.getElementById('typing-row')?.remove();
  chatMessages.innerHTML = '';

  chatView.classList.remove('active');
  restoreWelcome();

  resetComposerDraft();
  closeLibrary();
  closeAvatarPanel();
  closeSettingsModal();
  textarea.focus();
  updateSendBtn();
}

async function openLibrary() {
  closeAvatarPanel();
  document.querySelector('[data-view="library"]')?.classList.add('active');
  closeSettingsModal();
  libraryBackdrop?.classList.add('open');
  syncModalOpenState();
  await refreshChatList();
  requestAnimationFrame(() => librarySearch?.focus());
}

function closeLibrary() {
  libraryBackdrop?.classList.remove('open');
  document.querySelector('[data-view="library"]')?.classList.remove('active');
  syncModalOpenState();
}

async function refreshChatList() {
  try {
    const chats = (await window.electronAPI?.getChats()) ?? [];
    renderChatList(chats, librarySearch?.value ?? '');
  } catch {
    if (chatList) chatList.innerHTML = '<div class="lp-empty">Could not load chats</div>';
  }
}

function renderChatList(chats, filter = '') {
  if (!chatList) return;

  const query = filter.toLowerCase().trim();
  const filtered = query
    ? chats.filter((chat) => (chat.title || '').toLowerCase().includes(query))
    : chats;

  if (filtered.length === 0) {
    chatList.innerHTML = `<div class="lp-empty">${query ? 'No matching chats' : 'No chats yet.<br>Start a conversation!'
      }</div>`;
    return;
  }

  chatList.innerHTML = filtered
    .map((chat) => {
      const isActive = chat.id === state.currentChatId;
      const dateText = chat.updatedAt ? formatChatDate(new Date(chat.updatedAt)) : '';
      return `
        <div class="lp-item${isActive ? ' active' : ''}" data-id="${escapeHtml(chat.id)}">
          <div class="lp-item-title">${escapeHtml(chat.title || 'Untitled chat')}</div>
          <div class="lp-item-meta">${escapeHtml(dateText)}</div>
        </div>`;
    })
    .join('');

  chatList.querySelectorAll('.lp-item').forEach((item) => {
    item.addEventListener('click', () => loadChat(item.dataset.id));
  });
}

function formatChatDate(date) {
  const now = new Date();
  const diff = now - date;
  const day = 86400000;
  if (diff < day) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 7 * day) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

async function loadChat(chatId) {
  try {
    const chat = await window.electronAPI?.loadChat(chatId);
    if (!chat) return;

    state.messages = [];
    state.currentChatId = chat.id;
    state.isTyping = false;
    document.getElementById('typing-row')?.remove();
    chatMessages.innerHTML = '';
    resetComposerDraft();
    showChatView();

    const restoredMessages = (chat.messages ?? []).map(normalizeMessage);
    restoredMessages.forEach((message) => {
      appendMessage(message.role, message.content, false, false, message.attachments);
    });
    state.messages = restoredMessages;
    smoothScrollToBottom();

    if (chat.provider && chat.model) {
      const provider = state.providers.find((item) => item.provider === chat.provider);
      if (provider) {
        state.selectedProvider = provider;
        state.selectedModel = chat.model;
        updateModelLabel();
        buildModelDropdown();
      }
    }

    notifyModelSelectionChanged();
    closeLibrary();
    updateSendBtn();
  } catch (error) {
    console.error('[openworld] Load chat error:', error);
  }
}

libraryClose?.addEventListener('click', closeLibrary);

libraryBackdrop?.addEventListener('click', (event) => {
  if (event.target === libraryBackdrop) closeLibrary();
});

librarySearch?.addEventListener('input', async () => {
  const chats = (await window.electronAPI?.getChats()) ?? [];
  renderChatList(chats, librarySearch.value);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeLibrary();
});

document.addEventListener('click', (event) => {
  if (!themePanel?.contains(event.target) && !themeBtn?.contains(event.target)) {
    themePanel?.classList.remove('open');
  }

  if (modelDropdown && !modelDropdown.contains(event.target) && !modelSelectorBtn?.contains(event.target)) {
    modelDropdown.classList.remove('open');
  }
});

sidebarBtns.forEach((button) => {
  button.addEventListener('click', () => {
    const view = button.dataset.view;
 
    if (view === 'chat') {
      startNewChat();
      sidebarBtns.forEach((item) => item.classList.remove('active'));
      return;
    }
 
    if (view === 'library') {
      if (libraryBackdrop?.classList.contains('open')) {
        closeLibrary();
      } else {
        sidebarBtns.forEach((item) => item.classList.remove('active'));
        openLibrary();
      }
      return;
    }
 
    // ── NEW: Navigate to the Automations page ──
    if (view === 'automations') {
      window.electronAPI?.launchAutomations?.();
      return;
    }
 
    sidebarBtns.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    closeLibrary();
  });
});

function renderMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/```(?:[^\n]*)?\n([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  return `<p>${html}</p>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.title = APP_NAME;
loadProviders().then(() => {
  syncComposerCapabilities();
  loadUser();
});
autoResize();
console.log(`[${APP_NAME}] UI loaded - theme: ${state.theme}`);
