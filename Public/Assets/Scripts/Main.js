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
  const hasText        = textarea.value.trim().length > 0;
  const hasAttachments = state.composerAttachments.length > 0;
  return (hasText || hasAttachments) && !state.isTyping && !hasUnsupportedImageAttachments();
}

function hasUnsupportedImageAttachments() {
  return state.composerAttachments.some(
    a => a.type === 'image' && !modelSupportsInput('image'),
  );
}

function getSelectedModelName() {
  return state.selectedProvider?.models?.[state.selectedModel]?.name ?? 'This model';
}

function showComposerHint(message, tone = 'info', options = {}) {
  if (!composerHint) return;
  const { sticky = false, reason = '' } = options;
  clearTimeout(composerHintTimer);
  composerHint.textContent    = message;
  composerHint.className      = `composer-hint visible ${tone}`;
  composerHint.dataset.sticky = sticky ? 'true' : 'false';
  composerHint.dataset.reason = reason;
  if (!sticky)
    composerHintTimer = window.setTimeout(() => hideComposerHint(true), 2800);
}

function hideComposerHint(force = false) {
  if (!composerHint) return;
  if (!force && composerHint.dataset.sticky === 'true') return;
  clearTimeout(composerHintTimer);
  composerHint.textContent    = '';
  composerHint.className      = 'composer-hint';
  composerHint.dataset.sticky = 'false';
  composerHint.dataset.reason = '';
}

function clearCapabilityHintIfResolved() {
  if (composerHint?.dataset.reason === 'unsupported-image' && !hasUnsupportedImageAttachments())
    hideComposerHint(true);
}

function syncComposerCapabilities() {
  const supportsImages = modelSupportsInput('image');
  const modelName      = getSelectedModelName();
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
      { sticky: true, reason: 'unsupported-image' },
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
  String(text ?? '').split('\n').forEach((line, i) => {
    if (i > 0) container.appendChild(document.createElement('br'));
    container.appendChild(document.createTextNode(line));
  });
}

function buildImageFrame(attachment, className) {
  const frame = document.createElement('div');
  frame.className = className;
  frame.title     = attachment.name || 'Pasted image';
  const image = document.createElement('img');
  image.src     = attachment.dataUrl;
  image.alt     = attachment.name || 'Pasted image';
  image.loading = 'lazy';
  frame.appendChild(image);
  return frame;
}

function renderComposerAttachments() {
  if (!composerAttachmentsEl) return;
  composerAttachmentsEl.innerHTML = '';
  composerAttachmentsEl.hidden    = state.composerAttachments.length === 0;
  state.composerAttachments.forEach(attachment => {
    const chip    = document.createElement('div');
    chip.className = 'composer-attachment';
    chip.title     = attachment.name || 'Pasted image';
    const preview  = buildImageFrame(attachment, 'composer-attachment-preview');
    const removeBtn = document.createElement('button');
    removeBtn.type      = 'button';
    removeBtn.className = 'composer-attachment-remove';
    removeBtn.setAttribute('aria-label', `Remove ${attachment.name || 'image'}`);
    removeBtn.textContent = 'x';
    removeBtn.addEventListener('click', () => {
      state.composerAttachments = state.composerAttachments.filter(i => i.id !== attachment.id);
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
  const end   = textarea.selectionEnd ?? start;
  textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
  const c = start + text.length;
  textarea.setSelectionRange(c, c);
  autoResize();
}

function readClipboardImage(item, index) {
  return new Promise(resolve => {
    const file = item.getAsFile();
    if (!file) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload  = () => resolve({
      id: generateAttachmentId(), type: 'image',
      mimeType: file.type || 'image/png',
      name:    file.name || `Pasted image ${index + 1}`,
      dataUrl: String(reader.result ?? ''),
    });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function handleComposerPaste(event) {
  const items      = Array.from(event.clipboardData?.items ?? []);
  const imageItems = items.filter(item => item.type.startsWith('image/'));
  if (imageItems.length === 0) return;
  event.preventDefault();
  const pastedText = event.clipboardData?.getData('text/plain') ?? '';
  if (pastedText) insertTextAtCursor(pastedText);
  if (!modelSupportsInput('image')) {
    showComposerHint(`${getSelectedModelName()} does not support image input.`, 'warning');
    updateSendBtn(); return;
  }
  const attachments = (await Promise.all(imageItems.map(readClipboardImage))).filter(Boolean);
  if (!attachments.length) { showComposerHint('That image could not be added from the clipboard.', 'warning'); return; }
  state.composerAttachments = [...state.composerAttachments, ...attachments];
  renderComposerAttachments();
  showComposerHint(attachments.length === 1 ? 'Image added.' : `${attachments.length} images added.`, 'info');
  updateSendBtn();
}

function handleAttachmentButtonClick() {
  textarea.focus();
  if (!modelSupportsInput('image')) { showComposerHint(`${getSelectedModelName()} only accepts text.`, 'warning'); return; }
  showComposerHint('Copy an image and paste it into the message box.', 'info');
}

textarea.addEventListener('input',   autoResize);
textarea.addEventListener('paste',   handleComposerPaste);
textarea.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
});
sendBtn.addEventListener('click',  sendMessage);
attachmentBtn?.addEventListener('click', handleAttachmentButtonClick);
window.addEventListener('ow:model-selection-changed', syncComposerCapabilities);

chips.forEach(chip => {
  chip.addEventListener('click', () => {
    textarea.value = chip.getAttribute('data-prompt');
    autoResize();
    textarea.focus();
    chip.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.95)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
  });
});

function cancelWelcomeAnimations() { welcome.getAnimations().forEach(a => a.cancel()); }
function restoreWelcome() {
  cancelWelcomeAnimations();
  welcome.style.display = 'flex';
  welcome.style.removeProperty('opacity');
  welcome.style.removeProperty('transform');
}

/* ══════════════════════════════════════════
   CONNECTOR-AWARE COMMAND HANDLING
   Intercepts user messages before sending
   to AI when they match connector patterns.
══════════════════════════════════════════ */

/**
 * Try to handle message as a local connector command.
 * Returns true if handled (so Main.js skips the AI call),
 * false if it should fall through to the AI.
 */
async function tryConnectorCommand(text) {
  const lower = text.toLowerCase().trim();

  /* ── GMAIL ────────────────────────────────── */

  // "read my unread emails" / "email brief" / "check my inbox"
  if (/unread email|email brief|check.*inbox|read.*email/i.test(lower)) {
    appendMessage('assistant', '📬 Fetching your unread emails…', false, true);
    try {
      const res = await window.electronAPI?.gmailGetBrief?.(15);
      if (!res?.ok) throw new Error(res?.error ?? 'Gmail not connected');
      const briefText = res.count === 0
        ? 'Your inbox is clear — no unread emails 🎉'
        : `You have **${res.count} unread email${res.count !== 1 ? 's' : ''}**:\n\n${res.text}`;
      // Send the brief through the AI so it gets a polished summary
      state.messages.push({ role: 'user', content: text, attachments: [] });
      const aiPrompt = `The user asked to read their unread emails. Here are the raw unread emails fetched from Gmail:\n\n${res.text}\n\nWrite a concise, friendly summary of these emails for the user. Highlight anything that looks urgent or important. Keep it clear and scannable.`;
      await callAIWithContext(aiPrompt);
      return true;
    } catch (err) {
      const lastMsg = chatMessages.lastElementChild;
      if (lastMsg) lastMsg.querySelector('.content').innerHTML = renderMarkdown(`❌ Gmail error: ${err.message}\n\nMake sure Gmail is connected in **Settings → Connectors**.`);
      return true;
    }
  }

  // "search emails <query>"
  const searchMatch = lower.match(/search (?:emails?|inbox|mail)\s+(.+)/);
  if (searchMatch) {
    const query = searchMatch[1];
    appendMessage('assistant', `🔍 Searching Gmail for "${query}"…`, false, true);
    try {
      const res = await window.electronAPI?.gmailSearch?.(query, 10);
      if (!res?.ok) throw new Error(res?.error ?? 'Gmail error');
      const lines = res.emails.length === 0
        ? 'No emails found matching that query.'
        : res.emails.map((e, i) => `${i + 1}. **${e.subject}** — from ${e.from}\n   ${e.snippet}`).join('\n\n');
      replaceLastAssistantMessage(lines);
      return true;
    } catch (err) {
      replaceLastAssistantMessage(`❌ ${err.message}`);
      return true;
    }
  }

  /* ── GITHUB ───────────────────────────────── */

  // "list my repos" / "show my github repos"
  if (/list.*repos?|show.*repos?|my github repos?/i.test(lower)) {
    appendMessage('assistant', '🐙 Fetching your GitHub repositories…', false, true);
    try {
      const res = await window.electronAPI?.githubGetRepos?.();
      if (!res?.ok) throw new Error(res?.error ?? 'GitHub not connected');
      const lines = res.repos.slice(0, 20)
        .map((r, i) => `${i + 1}. **${r.full_name}** — ${r.description || 'No description'} _(${r.language || 'unknown'}, ⭐ ${r.stargazers_count})_`)
        .join('\n');
      replaceLastAssistantMessage(`You have ${res.repos.length} repos (showing top 20):\n\n${lines}`);
      return true;
    } catch (err) {
      replaceLastAssistantMessage(`❌ ${err.message}\n\nMake sure GitHub is connected in **Settings → Connectors**.`);
      return true;
    }
  }

  // "load file <path> from <owner>/<repo>"
  const loadFileMatch = text.match(/load (?:file\s+)?(.+?)\s+from\s+([\w.-]+)\/([\w.-]+)/i);
  if (loadFileMatch) {
    const [, filePath, owner, repo] = loadFileMatch;
    appendMessage('assistant', `📂 Loading \`${filePath}\` from **${owner}/${repo}**…`, false, true);
    try {
      const res = await window.electronAPI?.githubGetFile?.(owner, repo, filePath.trim());
      if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
      const ext     = filePath.split('.').pop() || '';
      const preview = res.content.length > 4000 ? res.content.slice(0, 4000) + '\n\n…(truncated)' : res.content;
      replaceLastAssistantMessage(`Here is \`${res.path}\` from **${owner}/${repo}**:\n\n\`\`\`${ext}\n${preview}\n\`\`\``);
      // Also inject into next AI call as context
      state.messages.push({
        role:        'assistant',
        content:     `File \`${res.path}\` loaded from GitHub (${res.size} bytes). The user can now ask questions about it.`,
        attachments: [],
      });
      return true;
    } catch (err) {
      replaceLastAssistantMessage(`❌ ${err.message}`);
      return true;
    }
  }

  // "show file tree of <owner>/<repo>"
  const treeMatch = text.match(/(?:file\s+)?tree\s+(?:of\s+)?([\w.-]+)\/([\w.-]+)/i);
  if (treeMatch) {
    const [, owner, repo] = treeMatch;
    appendMessage('assistant', `🌲 Fetching file tree of **${owner}/${repo}**…`, false, true);
    try {
      const res = await window.electronAPI?.githubGetTree?.(owner, repo);
      if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
      const files = res.tree
        .filter(f => f.type === 'blob')
        .slice(0, 80)
        .map(f => f.path)
        .join('\n');
      replaceLastAssistantMessage(`File tree for **${owner}/${repo}** (${res.tree.filter(f => f.type === 'blob').length} files):\n\n\`\`\`\n${files}\n\`\`\``);
      return true;
    } catch (err) {
      replaceLastAssistantMessage(`❌ ${err.message}`);
      return true;
    }
  }

  // "check issues <owner>/<repo>"
  const issueMatch = text.match(/(?:check|show|list)\s+issues?\s+(?:for\s+|in\s+)?([\w.-]+)\/([\w.-]+)/i);
  if (issueMatch) {
    const [, owner, repo] = issueMatch;
    appendMessage('assistant', `🐛 Fetching issues from **${owner}/${repo}**…`, false, true);
    try {
      const res = await window.electronAPI?.githubGetIssues?.(owner, repo);
      if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
      const lines = res.issues.length === 0
        ? 'No open issues.'
        : res.issues.map((i, n) => `${n + 1}. **#${i.number} ${i.title}** — ${i.user?.login ?? ''}`).join('\n');
      replaceLastAssistantMessage(`**${owner}/${repo}** has ${res.issues.length} open issue${res.issues.length !== 1 ? 's' : ''}:\n\n${lines}`);
      return true;
    } catch (err) {
      replaceLastAssistantMessage(`❌ ${err.message}`);
      return true;
    }
  }

  // "check PRs <owner>/<repo>"
  const prMatch = text.match(/(?:check|show|list)\s+(?:pr|pull request)s?\s+(?:for\s+|in\s+)?([\w.-]+)\/([\w.-]+)/i);
  if (prMatch) {
    const [, owner, repo] = prMatch;
    appendMessage('assistant', `🔀 Fetching pull requests from **${owner}/${repo}**…`, false, true);
    try {
      const res = await window.electronAPI?.githubGetPRs?.(owner, repo);
      if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
      const lines = res.prs.length === 0
        ? 'No open pull requests.'
        : res.prs.map((p, n) => `${n + 1}. **#${p.number} ${p.title}** by ${p.user?.login ?? ''}`).join('\n');
      replaceLastAssistantMessage(`**${owner}/${repo}** has ${res.prs.length} open PR${res.prs.length !== 1 ? 's' : ''}:\n\n${lines}`);
      return true;
    } catch (err) {
      replaceLastAssistantMessage(`❌ ${err.message}`);
      return true;
    }
  }

  // "github notifications"
  if (/github\s+notification|my\s+notification/i.test(lower)) {
    appendMessage('assistant', '🔔 Fetching GitHub notifications…', false, true);
    try {
      const res = await window.electronAPI?.githubGetNotifications?.();
      if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
      const n     = res.notifications ?? [];
      const lines = n.length === 0
        ? 'No unread notifications.'
        : n.slice(0, 10).map((n2, i) => `${i + 1}. **${n2.subject?.title}** — ${n2.repository?.full_name}`).join('\n');
      replaceLastAssistantMessage(`GitHub — ${n.length} unread notification${n.length !== 1 ? 's' : ''}:\n\n${lines}`);
      return true;
    } catch (err) {
      replaceLastAssistantMessage(`❌ ${err.message}`);
      return true;
    }
  }

  return false;  // Not a connector command — let the AI handle it
}

/** Replace the last assistant message bubble's content. */
function replaceLastAssistantMessage(markdown) {
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
   SEND MESSAGE
══════════════════════════════════════════ */

function sendMessage() {
  const text        = textarea.value.trim();
  const attachments = state.composerAttachments.map(a => ({ ...a }));
  if ((!text && attachments.length === 0) || state.isTyping) return;

  if (attachments.length > 0 && !modelSupportsInput('image')) {
    showComposerHint(`${getSelectedModelName()} cannot send images.`, 'warning', { sticky: true, reason: 'unsupported-image' });
    updateSendBtn(); return;
  }

  if (!state.currentChatId) state.currentChatId = generateChatId();
  showChatView();
  appendMessage('user', text, true, true, attachments);
  resetComposerDraft();

  sendBtn.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(0.85)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
    { duration: 350, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  );

  // Try connector commands first, then fall through to AI
  tryConnectorCommand(text).then(handled => {
    if (!handled) callAI();
  });
}

function showChatView() {
  if (chatView.classList.contains('active')) return;
  cancelWelcomeAnimations();
  welcome.style.display = 'flex';
  const animation = welcome.animate(
    [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(-16px) scale(0.97)' }],
    { duration: 280, easing: 'cubic-bezier(0.4,0,1,1)', fill: 'forwards' },
  );
  animation.onfinish = () => { welcome.style.display = 'none'; };
  chatView.classList.add('active');
}

function normalizeMessage(message) {
  return {
    role:        message?.role ?? 'user',
    content:     String(message?.content ?? ''),
    attachments: Array.isArray(message?.attachments)
      ? message.attachments.filter(a => a?.type === 'image' && typeof a.dataUrl === 'string')
      : [],
  };
}

function appendMessage(role, content, addToState = true, scroll = true, attachments = []) {
  const message = normalizeMessage({ role, content, attachments });
  if (addToState) state.messages.push(message);

  const row     = document.createElement('div');
  row.className = `message-row ${message.role}`;

  if (message.role === 'user') {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (message.attachments.length > 0) {
      bubble.classList.add('has-attachments');
      const gallery = document.createElement('div');
      gallery.className = 'bubble-attachments';
      message.attachments.forEach(a => gallery.appendChild(buildImageFrame(a, 'bubble-attachment')));
      bubble.appendChild(gallery);
    }
    if (message.content) {
      const tb = document.createElement('div');
      tb.className = 'bubble-text';
      appendTextWithLineBreaks(tb, message.content);
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
    row.querySelector('.content').innerHTML = renderMarkdown(message.content);
  }

  chatMessages.appendChild(row);
  if (scroll) smoothScrollToBottom();
  return row;
}

function smoothScrollToBottom() {
  chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
}

/* ══════════════════════════════════════════
   AI CALL — standard chat flow
══════════════════════════════════════════ */

async function callAI() {
  state.isTyping = true;
  updateSendBtn();
  const chatIdAtRequest = state.currentChatId;

  const typingRow = document.createElement('div');
  typingRow.className = 'message-row assistant';
  typingRow.id        = 'typing-row';
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
    if (!typingRow.isConnected) { state.isTyping = false; updateSendBtn(); callback?.(); return; }
    typingRow.animate(
      [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }],
      { duration: 180, easing: 'ease-in', fill: 'forwards' },
    ).onfinish = () => { typingRow.remove(); state.isTyping = false; updateSendBtn(); callback?.(); };
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
    removeTyping(() => { if (state.currentChatId !== chatIdAtRequest) return; appendMessage('assistant', message); });
    console.error('[openworld] API error:', error);
  }
}

/**
 * Send a custom system-built prompt to the AI (used for connector-enriched responses).
 */
async function callAIWithContext(systemPrompt) {
  state.isTyping = true;
  updateSendBtn();

  if (!state.selectedProvider || !state.selectedModel) {
    replaceLastAssistantMessage('No AI provider configured. Please add an API key in Settings.');
    state.isTyping = false; updateSendBtn(); return;
  }

  // Build a one-shot message array with the enriched context
  const contextMessages = [
    ...state.messages.slice(-10),
    { role: 'user', content: systemPrompt, attachments: [] },
  ];

  try {
    const reply = await fetchFromProvider(state.selectedProvider, state.selectedModel, contextMessages);
    replaceLastAssistantMessage(reply);
    state.messages.push({ role: 'assistant', content: reply, attachments: [] });
    saveCurrentChat();
  } catch (err) {
    replaceLastAssistantMessage(`AI error: ${err.message}`);
  } finally {
    state.isTyping = false;
    updateSendBtn();
  }
}

/* ══════════════════════════════════════════
   PROVIDER FETCH ADAPTERS
══════════════════════════════════════════ */

function extractBase64Payload(dataUrl) {
  return String(dataUrl ?? '').split(',', 2)[1] ?? '';
}

function buildAnthropicContent(message) {
  const blocks = [];
  if (message.content) blocks.push({ type: 'text', text: message.content });
  message.attachments.forEach(a => blocks.push({ type: 'image', source: { type: 'base64', media_type: a.mimeType || 'image/png', data: extractBase64Payload(a.dataUrl) } }));
  if (blocks.length === 1 && blocks[0].type === 'text') return message.content;
  return blocks;
}

function buildGoogleParts(message) {
  const parts = [];
  if (message.content) parts.push({ text: message.content });
  message.attachments.forEach(a => parts.push({ inlineData: { mimeType: a.mimeType || 'image/png', data: extractBase64Payload(a.dataUrl) } }));
  return parts;
}

function buildOpenAIContent(message) {
  if (!message.attachments.length) return message.content;
  const parts = [];
  if (message.content) parts.push({ type: 'text', text: message.content });
  message.attachments.forEach(a => parts.push({ type: 'image_url', image_url: { url: a.dataUrl } }));
  return parts;
}

async function fetchFromProvider(provider, modelId, messages) {
  const { provider: providerId, endpoint, api, auth_header, auth_prefix = '' } = provider;
  const history = messages.slice(-20).map(normalizeMessage);

  if (providerId === 'anthropic') {
    const res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': api, 'anthropic-version': '2023-06-01' },
      body:    JSON.stringify({ model: modelId, max_tokens: 2048, messages: history.map(m => ({ role: m.role, content: buildAnthropicContent(m) })) }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message ?? `HTTP ${res.status}`); }
    return (await res.json()).content?.[0]?.text ?? '(empty response)';
  }

  if (providerId === 'google') {
    const url = endpoint.replace('{model}', modelId) + `?key=${api}`;
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ contents: history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: buildGoogleParts(m) })) }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message ?? `HTTP ${res.status}`); }
    return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? '(empty response)';
  }

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: {
      'content-type':  'application/json',
      [auth_header]:   `${auth_prefix}${api}`,
      ...(providerId === 'openrouter' ? { 'HTTP-Referer': 'https://openworld.app', 'X-Title': 'openworld' } : {}),
    },
    body: JSON.stringify({ model: modelId, messages: history.map(m => ({ role: m.role, content: buildOpenAIContent(m) })) }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message ?? `HTTP ${res.status}`); }
  return (await res.json()).choices?.[0]?.message?.content ?? '(empty response)';
}

/* ══════════════════════════════════════════
   CHAT STORAGE
══════════════════════════════════════════ */

function generateChatId() {
  const now = new Date();
  const p   = v => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
}

async function saveCurrentChat() {
  if (!state.currentChatId || !state.messages.length) return;
  const first = state.messages.find(m => m.role === 'user');
  const title  = first?.content?.trim().slice(0, 70) || (first?.attachments?.length ? 'Image attachment' : 'Untitled');
  try {
    await window.electronAPI?.saveChat({ id: state.currentChatId, title, updatedAt: new Date().toISOString(), provider: state.selectedProvider?.provider ?? null, model: state.selectedModel ?? null, messages: state.messages });
  } catch (err) { console.warn('[openworld] Could not save chat:', err); }
}

function startNewChat() {
  state.messages = []; state.currentChatId = null; state.isTyping = false;
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

/* ══════════════════════════════════════════
   LIBRARY
══════════════════════════════════════════ */

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
  const query    = filter.toLowerCase().trim();
  const filtered = query ? chats.filter(c => (c.title || '').toLowerCase().includes(query)) : chats;
  if (!filtered.length) { chatList.innerHTML = `<div class="lp-empty">${query ? 'No matching chats' : 'No chats yet.<br>Start a conversation!'}</div>`; return; }
  chatList.innerHTML = filtered.map(chat => {
    const isActive  = chat.id === state.currentChatId;
    const dateText  = chat.updatedAt ? formatChatDate(new Date(chat.updatedAt)) : '';
    return `<div class="lp-item${isActive ? ' active' : ''}" data-id="${escapeHtml(chat.id)}"><div class="lp-item-title">${escapeHtml(chat.title || 'Untitled chat')}</div><div class="lp-item-meta">${escapeHtml(dateText)}</div></div>`;
  }).join('');
  chatList.querySelectorAll('.lp-item').forEach(item => item.addEventListener('click', () => loadChat(item.dataset.id)));
}

function formatChatDate(date) {
  const now  = new Date();
  const diff = now - date;
  const day  = 86400000;
  if (diff < day)     return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 7 * day) return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

async function loadChat(chatId) {
  try {
    const chat = await window.electronAPI?.loadChat(chatId);
    if (!chat) return;
    state.messages = []; state.currentChatId = chat.id; state.isTyping = false;
    document.getElementById('typing-row')?.remove();
    chatMessages.innerHTML = '';
    resetComposerDraft();
    showChatView();
    const restored = (chat.messages ?? []).map(normalizeMessage);
    restored.forEach(m => appendMessage(m.role, m.content, false, false, m.attachments));
    state.messages = restored;
    smoothScrollToBottom();
    if (chat.provider && chat.model) {
      const provider = state.providers.find(p => p.provider === chat.provider);
      if (provider) { state.selectedProvider = provider; state.selectedModel = chat.model; updateModelLabel(); buildModelDropdown(); }
    }
    notifyModelSelectionChanged();
    closeLibrary();
    updateSendBtn();
  } catch (err) { console.error('[openworld] Load chat error:', err); }
}

libraryClose?.addEventListener('click', closeLibrary);
libraryBackdrop?.addEventListener('click', e => { if (e.target === libraryBackdrop) closeLibrary(); });
librarySearch?.addEventListener('input', async () => {
  const chats = (await window.electronAPI?.getChats()) ?? [];
  renderChatList(chats, librarySearch.value);
});

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLibrary(); });
document.addEventListener('click', e => {
  if (!themePanel?.contains(e.target) && !themeBtn?.contains(e.target)) themePanel?.classList.remove('open');
  if (modelDropdown && !modelDropdown.contains(e.target) && !modelSelectorBtn?.contains(e.target)) modelDropdown.classList.remove('open');
});

sidebarBtns.forEach(button => {
  button.addEventListener('click', () => {
    const view = button.dataset.view;
    if (view === 'chat')        { startNewChat(); sidebarBtns.forEach(i => i.classList.remove('active')); return; }
    if (view === 'library')     { if (libraryBackdrop?.classList.contains('open')) { closeLibrary(); } else { sidebarBtns.forEach(i => i.classList.remove('active')); openLibrary(); } return; }
    if (view === 'automations') { window.electronAPI?.launchAutomations?.(); return; }
    sidebarBtns.forEach(i => i.classList.remove('active'));
    button.classList.add('active');
    closeLibrary();
  });
});

/* ══════════════════════════════════════════
   MARKDOWN + UTILS
══════════════════════════════════════════ */

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
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.title = APP_NAME;
loadProviders().then(() => {
  syncComposerCapabilities();
  loadUser();
});
autoResize();
console.log(`[${APP_NAME}] UI loaded`);
