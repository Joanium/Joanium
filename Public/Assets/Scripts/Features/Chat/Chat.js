// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Features/Chat/Chat.js
//  Core chat logic with NATIVE tool calling (agentic loop),
//  robust message actions, and token usage tracking.
// ─────────────────────────────────────────────

import { state } from '../../Shared/State.js';
import { render as renderMarkdown } from '../../Shared/Markdown.js';
import { welcome, chatView, chatMessages } from '../../Shared/DOM.js';
import { fetchWithTools } from '../AI/AIProvider.js';
import { reset as resetComposer } from '../Composer/Composer.js';
import { TOOLS } from './Tools/Index.js';
import { executeTool } from './Executors/Index.js';

/* ══════════════════════════════════════════
   ICONS & EVENT LISTENERS (MESSAGE ACTIONS)
══════════════════════════════════════════ */
function copyIcon() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
}

function checkIcon() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
}

// Global delegate for code-block copying and downloading
chatMessages.addEventListener('click', async (e) => {
  // ── Copy code button ──
  const copyCodeBtn = e.target.closest('.copy-code-btn');
  if (copyCodeBtn) {
    const wrapper = copyCodeBtn.closest('.code-wrapper');
    const codeEl = wrapper.querySelector('code');
    try {
      await navigator.clipboard.writeText(codeEl.textContent);
      const originalHtml = copyCodeBtn.innerHTML;
      copyCodeBtn.innerHTML = `${checkIcon()} Copied`;
      copyCodeBtn.style.color = 'var(--accent)';
      setTimeout(() => {
        copyCodeBtn.innerHTML = originalHtml;
        copyCodeBtn.style.color = '';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }

  // ── Download code button ──
  const downloadCodeBtn = e.target.closest('.download-code-btn');
  if (downloadCodeBtn) {
    const wrapper = downloadCodeBtn.closest('.code-wrapper');
    const codeEl = wrapper.querySelector('code');
    const lang = downloadCodeBtn.dataset.lang || 'txt';

    // Map language names to file extensions
    const EXT_MAP = {
      javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
      python: 'py', py: 'py', html: 'html', css: 'css',
      json: 'json', bash: 'sh', shell: 'sh', sh: 'sh',
      sql: 'sql', java: 'java', kotlin: 'kt', swift: 'swift',
      rust: 'rs', go: 'go', cpp: 'cpp', c: 'c', php: 'php',
      ruby: 'rb', yaml: 'yaml', yml: 'yml', xml: 'xml',
      markdown: 'md', md: 'md', jsx: 'jsx', tsx: 'tsx',
      vue: 'vue', scss: 'scss', sass: 'sass', less: 'less',
    };

    const ext = EXT_MAP[lang.toLowerCase()] || lang || 'txt';
    const filename = `code.${ext}`;

    try {
      const blob = new Blob([codeEl.textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Visual feedback
      const originalHtml = downloadCodeBtn.innerHTML;
      downloadCodeBtn.innerHTML = `${checkIcon()} Saved`;
      downloadCodeBtn.style.color = 'var(--accent)';
      setTimeout(() => {
        downloadCodeBtn.innerHTML = originalHtml;
        downloadCodeBtn.style.color = '';
      }, 2000);
    } catch (err) {
      console.error('Failed to download code:', err);
    }
  }
});

function attachCopyEvent(btn, textToCopy) {
  if (!btn) return;
  btn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      btn.innerHTML = checkIcon();
      btn.style.color = 'var(--accent)';
      setTimeout(() => {
        btn.innerHTML = copyIcon();
        btn.style.color = '';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function generateChatId() {
  const now = new Date();
  const p = v => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
}

function normalizeMessage(msg) {
  return {
    role: msg?.role ?? 'user',
    content: String(msg?.content ?? ''),
    attachments: Array.isArray(msg?.attachments)
      ? msg.attachments.filter(a => a?.type === 'image' && typeof a.dataUrl === 'string')
      : [],
  };
}

function buildImageFrame(attachment, className) {
  const frame = document.createElement('div');
  frame.className = className;
  frame.title = attachment.name || 'Pasted image';
  const img = document.createElement('img');
  img.src = attachment.dataUrl;
  img.alt = attachment.name || 'Pasted image';
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

let _updateSendBtn = () => { };
export function setSendBtnUpdater(fn) { _updateSendBtn = fn; }

/* ══════════════════════════════════════════
   USAGE TRACKING
══════════════════════════════════════════ */
async function trackUsage(usage, chatId) {
  if (!usage || (!usage.inputTokens && !usage.outputTokens)) return;
  if (!state.selectedProvider || !state.selectedModel) return;

  try {
    const modelInfo = state.selectedProvider.models?.[state.selectedModel];
    await window.electronAPI?.trackUsage?.({
      provider: state.selectedProvider.provider,
      model: state.selectedModel,
      modelName: modelInfo?.name ?? state.selectedModel,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      chatId: chatId ?? state.currentChatId ?? null,
    });
  } catch (err) {
    console.warn('[Chat] Could not track usage:', err);
  }
}

/* ══════════════════════════════════════════
   SKILL DETECTION  (AI-powered classification)
   Uses a lightweight AI call to determine which
   skills are genuinely relevant to the user's request.
   Falls back to empty array gracefully on any error.
══════════════════════════════════════════ */
async function detectRelevantSkills(userText) {
  try {
    const res = await window.electronAPI?.getSkills?.();
    const skills = res?.skills ?? [];
    if (!skills.length) return [];
    if (!state.selectedProvider || !state.selectedModel) return [];

    // Build a compact skill catalogue for the classifier
    const catalogue = skills
      .map(s => {
        const trigger = s.trigger?.trim();
        const desc = s.description?.trim();
        const detail = trigger || desc || '';
        return `- "${s.name}"${detail ? `: ${detail}` : ''}`;
      })
      .join('\n');

    const classifierPrompt =
      `You are a skill-routing assistant. Given a user request and a list of named skills, ` +
      `return ONLY a JSON array of skill names that are directly useful for that request. ` +
      `Return [] if none are relevant. No explanation, no markdown fences — raw JSON array only.\n\n` +
      `User request: "${userText}"\n\n` +
      `Available skills:\n${catalogue}`;

    const result = await fetchWithTools(
      state.selectedProvider,
      state.selectedModel,
      [{ role: 'user', content: classifierPrompt, attachments: [] }],
      'You are a skill classifier. Reply ONLY with a raw JSON array of skill name strings.',
      [] // no tools for this lightweight call
    );

    if (result.type !== 'text') return [];

    // Extract JSON array from response (handle any extra whitespace/chars)
    const match = result.text.match(/\[[\s\S]*?\]/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];

    // Validate against actual skill names to prevent hallucinations
    const validNames = new Set(skills.map(s => s.name));
    return parsed.filter(n => typeof n === 'string' && validNames.has(n));
  } catch (err) {
    console.warn('[Chat] Skill detection failed:', err.message);
    return [];
  }
}

/* ══════════════════════════════════════════
   LIVE ASSISTANT BUBBLE — LOG ITEM BUILDER
   Supports prefixed lines:
     [GMAIL]  … → Gmail logo
     [GITHUB] … → GitHub logo
     [SKILL]  … → openworld logo
   Anything else → plain dot log item
══════════════════════════════════════════ */
function buildLogItem(line) {
  const item = document.createElement('div');
  item.className = 'agent-log-item';

  let iconHtml = '';
  let displayText = line;

  if (line.startsWith('[GMAIL]')) {
    displayText = line.replace('[GMAIL]', '').trim();
    iconHtml = `<img
      src="Assets/Icons/Gmail.png"
      alt="Gmail"
      style="width:14px;height:14px;object-fit:contain;vertical-align:middle;border-radius:2px;flex-shrink:0;"
    />`;
  } else if (line.startsWith('[GITHUB]')) {
    displayText = line.replace('[GITHUB]', '').trim();
    iconHtml = `<img
      src="Assets/Icons/Github.png"
      alt="GitHub"
      style="width:14px;height:14px;object-fit:contain;vertical-align:middle;border-radius:2px;flex-shrink:0;"
    />`;
  } else if (line.startsWith('[SKILL]')) {
    displayText = line.replace('[SKILL]', '').trim();
    iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
      style="width:14px;height:14px;vertical-align:middle;flex-shrink:0;color:var(--accent)">
      <path d="M12 2L8 6H4v4L2 12l2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4L12 2z"/>
    </svg>`;
  } else {
    // Legacy emoji path
    const clean = line.replace(/[*_`]/g, '').replace(/^[🔧📤📬📥📖🔍📦🌲🐛🔀🔔❌✅]\s*/, '');
    const emojiMatch = line.match(/^([🔧📤📬📥📖🔍📦🌲🐛🔀🔔❌✅])/);
    item.innerHTML = `
      <span class="agent-log-dot"></span>
      <span class="agent-log-text">${emojiMatch ? emojiMatch[1] + ' ' : ''}${clean}</span>
    `;
    return item;
  }

  // Strip markdown from display text
  const cleanDisplay = displayText.replace(/[*_`]/g, '');

  item.innerHTML = `
    <span class="agent-log-dot"></span>
    <span style="display:inline-flex;align-items:center;gap:5px;">
      ${iconHtml}
      <span class="agent-log-text">${cleanDisplay}</span>
    </span>
  `;
  return item;
}

/* ══════════════════════════════════════════
   LIVE ASSISTANT BUBBLE
══════════════════════════════════════════ */
function assistantIcon() {
  return `<div class="assistant-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 2L8 6H4v4L2 12l2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4L12 2z" stroke-width="1.5"/>
    </svg>
  </div>`;
}

function createLiveRow() {
  const row = document.createElement('div');
  row.className = 'message-row assistant';
  row.innerHTML = `
    ${assistantIcon()}
    <div class="content-wrapper" style="flex:1; min-width:0;">
      <div class="content">
        <div class="agent-log"></div>
        <div class="agent-reply"></div>
      </div>
      <div class="message-actions assistant-actions" style="display:none;">
        <button class="action-btn copy-msg-btn" title="Copy Message">${copyIcon()}</button>
      </div>
    </div>`;

  chatMessages.appendChild(row);
  smoothScrollToBottom();

  const logEl = row.querySelector('.agent-log');
  const replyEl = row.querySelector('.agent-reply');
  const actionsEl = row.querySelector('.message-actions');

  return {
    row,
    push(line) {
      const item = buildLogItem(line);
      logEl.appendChild(item);
      requestAnimationFrame(() => item.classList.add('agent-log-item--in'));
      smoothScrollToBottom();
    },
    set(markdown) {
      logEl.style.opacity = '0';
      logEl.style.transition = 'opacity 0.2s ease';
      setTimeout(() => {
        logEl.innerHTML = '';
        logEl.style.display = 'none';
        replyEl.innerHTML = renderMarkdown(markdown);

        actionsEl.style.display = 'flex';
        attachCopyEvent(actionsEl.querySelector('.copy-msg-btn'), markdown);

        smoothScrollToBottom();
      }, 200);
    },
  };
}

/* ══════════════════════════════════════════
   MESSAGE RENDERING
══════════════════════════════════════════ */
export function appendMessage(role, content, addToState = true, scroll = true, attachments = []) {
  const msg = normalizeMessage({ role, content, attachments });
  if (addToState) state.messages.push(msg);

  const row = document.createElement('div');
  row.className = `message-row ${msg.role}`;

  if (msg.role === 'user') {
    const actions = document.createElement('div');
    actions.className = 'message-actions user-actions';
    actions.innerHTML = `<button class="action-btn copy-msg-btn" title="Copy Message">${copyIcon()}</button>`;
    attachCopyEvent(actions.querySelector('.copy-msg-btn'), msg.content);
    row.appendChild(actions);

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (msg.attachments.length > 0) {
      bubble.classList.add('has-attachments');
      const gallery = document.createElement('div');
      gallery.className = 'bubble-attachments';
      msg.attachments.forEach(a => gallery.appendChild(buildImageFrame(a, 'bubble-attachment')));
      bubble.appendChild(gallery);
    }
    if (msg.content) {
      const tb = document.createElement('div');
      tb.className = 'bubble-text';
      appendTextWithLineBreaks(tb, msg.content);
      bubble.appendChild(tb);
    }
    row.appendChild(bubble);
  } else {
    row.innerHTML = `
      ${assistantIcon()}
      <div class="content-wrapper" style="flex:1; min-width:0;">
        <div class="content"></div>
        <div class="message-actions assistant-actions">
          <button class="action-btn copy-msg-btn" title="Copy Message">${copyIcon()}</button>
        </div>
      </div>
    `;
    row.querySelector('.content').innerHTML = renderMarkdown(msg.content);
    attachCopyEvent(row.querySelector('.copy-msg-btn'), msg.content);
  }

  chatMessages.appendChild(row);
  if (scroll) smoothScrollToBottom();
  return row;
}

export function replaceLastAssistant(markdown) {
  const rows = chatMessages.querySelectorAll('.message-row.assistant');
  const last = rows[rows.length - 1];
  if (last) {
    const replyEl = last.querySelector('.agent-reply');
    if (replyEl) {
      replyEl.innerHTML = renderMarkdown(markdown);
    } else {
      const content = last.querySelector('.content');
      if (content) content.innerHTML = renderMarkdown(markdown);
    }
    attachCopyEvent(last.querySelector('.copy-msg-btn'), markdown);
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
    [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(-16px) scale(0.97)' }],
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
   LEGACY HELPERS
══════════════════════════════════════════ */
export async function callAI() {
  state.isTyping = true;
  _updateSendBtn();
  const chatIdAtRequest = state.currentChatId;

  const typingRow = document.createElement('div');
  typingRow.className = 'message-row assistant';
  typingRow.id = 'typing-row';
  typingRow.innerHTML = `${assistantIcon()}<div class="content" style="padding-top:6px">
    <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
  </div>`;
  chatMessages.appendChild(typingRow);
  smoothScrollToBottom();

  const remove = (cb) => {
    if (!typingRow.isConnected) { state.isTyping = false; _updateSendBtn(); cb?.(); return; }
    typingRow.animate(
      [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }],
      { duration: 180, easing: 'ease-in', fill: 'forwards' },
    ).onfinish = () => { typingRow.remove(); state.isTyping = false; _updateSendBtn(); cb?.(); };
  };

  if (!state.selectedProvider || !state.selectedModel) {
    remove(() => appendMessage('assistant', 'No AI provider configured. Please add an API key in Settings.'));
    return;
  }

  try {
    const result = await fetchWithTools(state.selectedProvider, state.selectedModel, state.messages, state.systemPrompt, []);
    const reply = result.type === 'text' ? result.text : '(unexpected tool call)';
    await trackUsage(result.usage, chatIdAtRequest);
    remove(() => {
      if (state.currentChatId !== chatIdAtRequest) return;
      appendMessage('assistant', reply);
      saveCurrentChat();
    });
  } catch (err) {
    remove(() => appendMessage('assistant', `API Error: ${err.message}`));
    console.error('[Chat] callAI error:', err);
  }
}

export async function callAIWithContext(contextPrompt) {
  state.isTyping = true;
  _updateSendBtn();
  if (!state.selectedProvider || !state.selectedModel) {
    replaceLastAssistant('No AI provider configured.');
    state.isTyping = false; _updateSendBtn(); return;
  }
  const msgs = [...state.messages.slice(-10), { role: 'user', content: contextPrompt, attachments: [] }];
  try {
    const result = await fetchWithTools(state.selectedProvider, state.selectedModel, msgs, state.systemPrompt, []);
    const reply = result.type === 'text' ? result.text : '(unexpected tool call)';
    await trackUsage(result.usage, state.currentChatId);
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
   THE AGENTIC LOOP
══════════════════════════════════════════ */
async function agentLoop(messages, live) {
  const loopMessages = [...messages];
  const MAX_TURNS = 5;
  let toolsUsed = false;

  const totalUsage = { inputTokens: 0, outputTokens: 0 };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const toolsThisTurn = toolsUsed ? [] : TOOLS;

    const result = await fetchWithTools(
      state.selectedProvider,
      state.selectedModel,
      loopMessages,
      state.systemPrompt,
      toolsThisTurn,
    );

    if (result.usage) {
      totalUsage.inputTokens += result.usage.inputTokens ?? 0;
      totalUsage.outputTokens += result.usage.outputTokens ?? 0;
    }

    if (result.type === 'text') {
      live.set(result.text);
      return { text: result.text, usage: totalUsage };
    }

    if (result.type === 'tool_call') {
      const { name, params } = result;
      toolsUsed = true;
      live.push(`🔧 _${name.replace(/_/g, ' ')}…_`);

      let toolResult;
      try {
        toolResult = await executeTool(name, params, msg => live.push(msg));
      } catch (err) {
        toolResult = `Error: ${err.message}`;
        live.push(`❌ ${err.message}`);
      }

      loopMessages.push({
        role: 'assistant',
        content: `I used the ${name} tool.`,
        attachments: [],
      });
      loopMessages.push({
        role: 'user',
        content: `Tool result: ${toolResult}\n\nNow write a short, friendly, natural language reply to the user. No JSON, no code.`,
        attachments: [],
      });

      continue;
    }
  }

  live.set('Done.');
  return { text: 'Done.', usage: totalUsage };
}

/* ══════════════════════════════════════════
   SEND MESSAGE
══════════════════════════════════════════ */
export async function sendMessage({ text, attachments, sendBtnEl }) {
  if ((!text && attachments.length === 0) || state.isTyping) return;

  if (!state.currentChatId) state.currentChatId = generateChatId();

  showChatView();
  appendMessage('user', text, true, true, attachments);
  resetComposer();

  sendBtnEl?.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(0.85)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
    { duration: 350, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  );

  if (!state.selectedProvider || !state.selectedModel) {
    appendMessage('assistant', 'No AI provider configured. Please add an API key in Settings.');
    return;
  }

  state.isTyping = true;
  _updateSendBtn();

  const live = createLiveRow();
  live.push('_Thinking…_');

  // ── AI-powered skill detection ────────────────────────────────────────
  // Run classification concurrently with initial setup; only show matched skills
  if (text) {
    try {
      const matchedSkills = await detectRelevantSkills(text);
      for (const skillName of matchedSkills) {
        live.push(`[SKILL] Reading skill: ${skillName}`);
        await new Promise(r => setTimeout(r, 160));
      }
    } catch { /* non-fatal */ }
  }

  try {
    const { text: finalReply, usage } = await agentLoop(state.messages, live);

    await trackUsage(usage, state.currentChatId);

    state.messages.push({ role: 'assistant', content: finalReply, attachments: [] });
    saveCurrentChat();
  } catch (err) {
    const msg = `Something went wrong: ${err.message}`;
    live.set(msg);
    state.messages.push({ role: 'assistant', content: msg, attachments: [] });
    console.error('[Chat] sendMessage error:', err);
  } finally {
    state.isTyping = false;
    _updateSendBtn();
  }
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
      id: state.currentChatId,
      title,
      updatedAt: new Date().toISOString(),
      provider: state.selectedProvider?.provider ?? null,
      model: state.selectedModel ?? null,
      messages: state.messages,
    });
  } catch (err) { console.warn('[Chat] Could not save chat:', err); }
}

export function startNewChat(extraCleanup = () => { }) {
  state.messages = [];
  state.currentChatId = null;
  state.isTyping = false;
  document.getElementById('typing-row')?.remove();
  chatMessages.innerHTML = '';
  restoreWelcome();
  resetComposer();
  extraCleanup();
}

export async function loadChat(chatId, { updateModelLabel, buildModelDropdown, notifyModelSelectionChanged }) {
  try {
    const chat = await window.electronAPI?.loadChat(chatId);
    if (!chat) return;
    state.messages = [];
    state.currentChatId = chat.id;
    state.isTyping = false;
    document.getElementById('typing-row')?.remove();
    chatMessages.innerHTML = '';
    resetComposer();
    showChatView();
    const restored = (chat.messages ?? []).map(m => ({
      role: m?.role ?? 'user',
      content: String(m?.content ?? ''),
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
        state.selectedModel = chat.model;
        updateModelLabel();
        buildModelDropdown();
      }
    }
    notifyModelSelectionChanged();
    _updateSendBtn();
  } catch (err) { console.error('[Chat] Load error:', err); }
}
