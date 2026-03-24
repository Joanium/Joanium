// ─────────────────────────────────────────────
//  Romelson — Public/Assets/Scripts/Features/Chat/Chat.js
//  Core chat logic with:
//    • Streaming responses (SSE, progressive markdown during stream)
//    • Per-response inline token/cost footer (always on)
//    • Model failover (rank-ordered within provider, then across providers)
//    • Retry with exponential backoff
//    • Unified AI planning step — AI decides skills + tools in one call
//    • Edit & Retry for user messages; Retry for assistant messages
//    • Auto-learning memory — extracts facts from conversation every 10 messages
//    • Right-rail message timeline navigator (2+ user messages)
//    • Scroll-to-bottom button
//    • Stop generation button support via AbortController
// ─────────────────────────────────────────────

import { state } from '../../Shared/State.js';
import { render as renderMarkdown } from '../../Shared/Markdown.js';
import { welcome, chatView, chatMessages } from '../../Shared/DOM.js';
import { fetchWithTools } from '../AI/AIProvider.js';
import { reset as resetComposer } from '../Composer/Composer.js';
import { planRequest, agentLoop } from './Agent.js';

/* ══════════════════════════════════════════
   TOKEN FOOTER — always on
══════════════════════════════════════════ */
document.documentElement.classList.add('show-tokens');

function buildTokenFooter(usage, provider, modelId) {
  const inp = usage?.inputTokens ?? 0;
  const out = usage?.outputTokens ?? 0;
  if (!inp && !out) return null;

  const pricing = provider?.models?.[modelId]?.pricing;
  const cost = pricing
    ? (inp / 1_000_000 * (pricing.input ?? 0)) + (out / 1_000_000 * (pricing.output ?? 0))
    : null;

  const fmtN = n => n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}K`
      : String(n);
  const fmtCost = c => c === 0 ? '$0.000' : c < 0.001 ? '<$0.001' : `~$${c.toFixed(3)}`;

  const el = document.createElement('div');
  el.className = 'token-footer';
  el.innerHTML = `
    <span class="tf-item tf-in">&#8593; ${fmtN(inp)}</span>
    <span class="tf-sep">&#183;</span>
    <span class="tf-item tf-out">&#8595; ${fmtN(out)}</span>
    ${cost !== null
      ? `<span class="tf-sep">&#183;</span><span class="tf-item tf-cost">${fmtCost(cost)}</span>`
      : ''}
  `.trim();
  return el;
}

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
   ICONS & EVENT LISTENERS (MESSAGE ACTIONS)
══════════════════════════════════════════ */
function copyIcon() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
}

function checkIcon() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
}

function editIcon() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}

function retryIcon() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
}

chatMessages.addEventListener('click', async (e) => {
  const copyCodeBtn = e.target.closest('.copy-code-btn');
  if (copyCodeBtn) {
    const wrapper = copyCodeBtn.closest('.code-wrapper');
    const codeEl = wrapper?.querySelector('code');
    if (!codeEl) return;
    try {
      await navigator.clipboard.writeText(codeEl.textContent);
      const orig = copyCodeBtn.innerHTML;
      copyCodeBtn.innerHTML = `${checkIcon()} Copied`;
      copyCodeBtn.style.color = 'var(--accent)';
      setTimeout(() => { copyCodeBtn.innerHTML = orig; copyCodeBtn.style.color = ''; }, 2000);
    } catch (err) { console.error('Failed to copy code:', err); }
  }

  const dlCodeBtn = e.target.closest('.download-code-btn');
  if (dlCodeBtn) {
    const wrapper = dlCodeBtn.closest('.code-wrapper');
    const codeEl = wrapper?.querySelector('code');
    if (!codeEl) return;
    const lang = dlCodeBtn.dataset.lang || 'txt';
    const EXT_MAP = {
      javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', python: 'py', py: 'py',
      html: 'html', css: 'css', json: 'json', bash: 'sh', shell: 'sh', sh: 'sh',
      sql: 'sql', java: 'java', kotlin: 'kt', swift: 'swift', rust: 'rs', go: 'go',
      cpp: 'cpp', c: 'c', php: 'php', ruby: 'rb', yaml: 'yaml', yml: 'yml',
      xml: 'xml', markdown: 'md', md: 'md', jsx: 'jsx', tsx: 'tsx',
      vue: 'vue', scss: 'scss', sass: 'sass', less: 'less',
    };
    const ext = EXT_MAP[lang.toLowerCase()] || lang || 'txt';
    try {
      const blob = new Blob([codeEl.textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `code.${ext}`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      const orig = dlCodeBtn.innerHTML;
      dlCodeBtn.innerHTML = `${checkIcon()} Saved`;
      dlCodeBtn.style.color = 'var(--accent)';
      setTimeout(() => { dlCodeBtn.innerHTML = orig; dlCodeBtn.style.color = ''; }, 2000);
    } catch (err) { console.error('Failed to download code:', err); }
  }
});

function attachCopyEvent(btn, textToCopy) {
  if (!btn) return;
  btn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      btn.innerHTML = checkIcon();
      btn.style.color = 'var(--accent)';
      setTimeout(() => { btn.innerHTML = copyIcon(); btn.style.color = ''; }, 2000);
    } catch (err) { console.error('Failed to copy message:', err); }
  };
}

/* ══════════════════════════════════════════
   MESSAGE TIMELINE
══════════════════════════════════════════ */

let _timelineRafId = null;

function updateTimeline() {
  const timeline = document.getElementById('chat-timeline');
  if (!timeline) return;

  if (_timelineRafId) cancelAnimationFrame(_timelineRafId);
  _timelineRafId = requestAnimationFrame(() => {
    const userRows = Array.from(chatMessages.querySelectorAll('.message-row.user'));

    if (userRows.length < 2) {
      timeline.classList.remove('visible');
      return;
    }

    timeline.classList.add('visible');
    timeline.querySelectorAll('.chat-timeline-tick').forEach(t => t.remove());

    const totalHeight = chatMessages.scrollHeight;
    if (totalHeight === 0) return;

    userRows.forEach((row) => {
      const tick = document.createElement('div');
      tick.className = 'chat-timeline-tick';

      const rowCenter = row.offsetTop + row.offsetHeight / 2;
      const pct = Math.min(97, Math.max(2, (rowCenter / totalHeight) * 100));
      tick.style.top = `${pct}%`;

      const textEl = row.querySelector('.bubble-text');
      const attachmentCount = row.querySelectorAll('.bubble-attachment').length;
      let raw = (textEl?.textContent || '').trim();
      if (!raw && attachmentCount > 0) raw = `${attachmentCount} attachment${attachmentCount > 1 ? 's' : ''}`;
      const preview = raw.slice(0, 55) + (raw.length > 55 ? '…' : '');
      tick.dataset.preview = preview || 'Message';

      tick.addEventListener('click', () => {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.style.transition = 'background 0.2s ease, border-radius 0.2s ease';
        row.style.background = 'color-mix(in srgb, var(--accent) 5%, transparent)';
        row.style.borderRadius = '16px';
        setTimeout(() => { row.style.background = ''; row.style.borderRadius = ''; }, 700);
      });

      timeline.appendChild(tick);
    });
  });
}

/* ══════════════════════════════════════════
   SCROLL-TO-BOTTOM BUTTON
══════════════════════════════════════════ */
let _newMsgsSinceScrolled = 0;

function setupScrollFeatures() {
  const btn = document.getElementById('scroll-to-bottom');
  if (!btn) return;

  chatMessages.addEventListener('scroll', () => {
    const distFromBottom =
      chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;

    const shouldShow = distFromBottom > 220;
    btn.classList.toggle('visible', shouldShow);

    if (!shouldShow) {
      _newMsgsSinceScrolled = 0;
      const badge = btn.querySelector('.scroll-to-bottom-badge');
      if (badge) badge.remove();
    }
  });

  btn.addEventListener('click', () => {
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    _newMsgsSinceScrolled = 0;
    const badge = btn.querySelector('.scroll-to-bottom-badge');
    if (badge) badge.remove();
  });
}

function bumpScrollBadge() {
  const btn = document.getElementById('scroll-to-bottom');
  if (!btn || !btn.classList.contains('visible')) return;

  _newMsgsSinceScrolled++;
  let badge = btn.querySelector('.scroll-to-bottom-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'scroll-to-bottom-badge';
    btn.appendChild(badge);
  }
  badge.textContent = _newMsgsSinceScrolled > 9 ? '9+' : String(_newMsgsSinceScrolled);
}

setupScrollFeatures();

/* ══════════════════════════════════════════
   AUTO-LEARNING MEMORY
══════════════════════════════════════════ */

const MEMORY_LEARN_INTERVAL = 5;
let _userMessagesSinceLastLearn = 0;

function showMemoryIndicator() {
  const existing = document.getElementById('memory-learn-indicator');
  if (existing) return () => {};

  const el = document.createElement('div');
  el.id = 'memory-learn-indicator';
  el.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
         style="width:12px;height:12px;animation:spin 1.2s linear infinite;flex-shrink:0">
      <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/>
    </svg>
    Learning…
  `;
  el.style.cssText = `
    position:fixed; top:48px; left:calc(var(--sidebar-w, 52px) + 14px); transform:none;
    display:flex; align-items:center; gap:6px;
    background:var(--bg-tertiary); border:1px solid var(--border-subtle);
    border-radius:999px; padding:4px 12px;
    font-size:11px; font-family:var(--font-ui); color:var(--text-muted);
    z-index:50; animation:fadeIn 0.2s ease both;
    pointer-events:none;
  `;

  if (!document.getElementById('mem-spin-style')) {
    const style = document.createElement('style');
    style.id = 'mem-spin-style';
    style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }

  document.body.appendChild(el);
  return () => {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  };
}

async function attemptMemoryUpdate() {
  _userMessagesSinceLastLearn++;
  if (_userMessagesSinceLastLearn < MEMORY_LEARN_INTERVAL) return;
  _userMessagesSinceLastLearn = 0;

  if (!state.selectedProvider || !state.selectedModel) return;

  const userMessages = state.messages.filter(m => m.role === 'user');
  if (userMessages.length < 4) return;

  const hideIndicator = showMemoryIndicator();

  try {
    const existingMemory = (await window.electronAPI?.getMemory?.()) ?? '';

    const recentMessages = state.messages.slice(-20);
    const conversationText = recentMessages
      .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 400)}`)
      .join('\n');

    const extractPrompt = [
      'You are a memory extraction assistant. Read this conversation and extract NEW long-term facts about the USER.',
      '',
      'Rules:',
      '- Only extract facts about the USER (not the AI), such as: preferences, projects, goals, tools they use,',
      '  personal context, recurring topics, communication style, domain expertise, etc.',
      '- Do NOT include anything already captured in the existing memory below.',
      '- Do NOT include one-off questions or temporary context.',
      '- If there is nothing new and genuinely useful to remember, respond with exactly: [NOTHING]',
      '- Otherwise respond ONLY with concise bullet points (max 5), each starting with "- ".',
      '- Keep each bullet under 20 words. Be specific, not generic.',
      '',
      `Existing memory:\n${existingMemory.trim() || '(empty)'}`,
      '',
      `Recent conversation:\n${conversationText}`,
    ].join('\n');

    const result = await fetchWithTools(
      state.selectedProvider,
      state.selectedModel,
      [{ role: 'user', content: extractPrompt, attachments: [] }],
      'You are a concise memory extraction assistant. Output only what is asked — bullet points or [NOTHING].',
      [],
    );

    if (result.type !== 'text') return;
    const text = result.text?.trim() ?? '';
    if (!text || text === '[NOTHING]' || text.toUpperCase().includes('[NOTHING]')) return;

    const bullets = text.split('\n').filter(l => l.trim().startsWith('- ')).join('\n');
    if (!bullets) return;

    const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const updated = (existingMemory.trim() ? existingMemory.trim() + '\n\n' : '') +
      `--- Auto-learned ${timestamp} ---\n${bullets}`;

    await window.electronAPI?.saveMemory?.(updated);
    console.log('[Chat] Memory updated with new learnings.');

  } catch (err) {
    console.warn('[Chat] Memory update failed (non-fatal):', err.message);
  } finally {
    hideIndicator();
  }
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
      ? msg.attachments.filter(a => (a?.type === 'image' || a?.type === 'file') && (typeof a.dataUrl === 'string' || typeof a.textContent === 'string'))
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

function buildFileFrame(attachment, className) {
  const extMatch = (attachment.name || '').match(/\.([^.]+)$/);
  const ext = extMatch ? extMatch[1].toUpperCase() : 'FILE';
  const linesText = attachment.lines ? `${attachment.lines} lines` : 'File';
  const frame = document.createElement('div');
  frame.className = className;
  frame.title = attachment.name || 'File';
  frame.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;">${attachment.name}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${linesText}</div>
    <div style="margin-top:auto;font-size:10px;font-weight:bold;color:var(--text-secondary);border:1px solid var(--border-subtle);border-radius:4px;padding:2px 6px;align-self:flex-start;">${ext}</div>
  `;
  frame.style.display = 'flex';
  frame.style.flexDirection = 'column';
  frame.style.alignItems = 'flex-start';
  frame.style.justifyContent = 'flex-start';
  frame.style.width = '135px';
  frame.style.height = '135px';
  frame.style.padding = '12px';
  frame.style.backgroundColor = 'var(--bg-tertiary)';
  frame.style.borderRadius = '12px';
  frame.style.boxSizing = 'border-box';
  frame.style.border = '1px solid var(--border-color)';
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
async function trackUsage(usage, chatId, provider = null, modelId = null) {
  if (!usage || (!usage.inputTokens && !usage.outputTokens)) return;
  const p = provider ?? state.selectedProvider;
  const m = modelId ?? state.selectedModel;
  if (!p || !m) return;
  try {
    const modelInfo = p.models?.[m];
    await window.electronAPI?.trackUsage?.({
      provider: p.provider,
      model: m,
      modelName: modelInfo?.name ?? m,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      chatId: chatId ?? state.currentChatId ?? null,
    });
  } catch (err) { console.warn('[Chat] Could not track usage:', err); }
}

/* ══════════════════════════════════════════
   RESEND FROM CURRENT STATE
══════════════════════════════════════════ */
async function doSendFromState() {
  if (!state.selectedProvider || !state.selectedModel || state.isTyping) return;

  state.isTyping = true;
  _updateSendBtn();

  const live = createLiveRow();
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
      for (const tc of (plan.toolCalls ?? [])) {
        const handle = live.push(`[TOOL] ${tc.name.replace(/_/g, ' ')}`);
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

    await trackUsage(usage, state.currentChatId, usedProvider, usedModel);
    state.messages.push({ role: 'assistant', content: finalReply, attachments: [] });
    saveCurrentChat();
    bumpScrollBadge();
  } catch (err) {
    _currentAbortController = null;
    if (err.name === 'AbortError') {
      // User stopped generation — clean up the live row gracefully
      live.setAborted();
      return;
    }
    const errMsg = `Something went wrong: ${err.message}`;
    live.set(errMsg);
    state.messages.push({ role: 'assistant', content: errMsg, attachments: [] });
    console.error('[Chat] doSendFromState error:', err);
  } finally {
    state.isTyping = false;
    _updateSendBtn();
    updateTimeline();
  }
}

/* ══════════════════════════════════════════
   LIVE ASSISTANT BUBBLE — LOG ITEM BUILDER
══════════════════════════════════════════ */
function buildLogItem(rawLine) {
  const item = document.createElement('div');
  item.className = 'agent-log-item';

  const dotSpan = document.createElement('span');
  dotSpan.className = 'agent-log-dot';
  item.appendChild(dotSpan);

  let iconHtml = '';
  let displayText = rawLine;

  if (rawLine.startsWith('[GMAIL]')) {
    displayText = rawLine.slice(7).trim();
    iconHtml = `<img src="Assets/Icons/Gmail.png" alt="Gmail"
      style="width:14px;height:14px;object-fit:contain;vertical-align:middle;border-radius:2px;flex-shrink:0;"/>`;
  } else if (rawLine.startsWith('[GITHUB]')) {
    displayText = rawLine.slice(8).trim();
    iconHtml = `<img src="Assets/Icons/Github.png" alt="GitHub"
      style="width:14px;height:14px;object-fit:contain;vertical-align:middle;border-radius:2px;flex-shrink:0;"/>`;
  } else if (rawLine.startsWith('[SKILL]')) {
    displayText = rawLine.slice(7).trim();
    iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
      style="width:14px;height:14px;vertical-align:middle;flex-shrink:0;color:var(--accent)">
      <path d="M12 2L8 6H4v4L2 12l2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4L12 2z"/>
    </svg>`;
  } else if (rawLine.startsWith('[TOOL]')) {
    displayText = rawLine.slice(6).trim();
    iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
      style="width:14px;height:14px;vertical-align:middle;flex-shrink:0;color:var(--text-muted)">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  if (iconHtml) {
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:inline-flex;align-items:center;gap:5px;';
    wrap.innerHTML = iconHtml;
    const label = document.createElement('span');
    label.className = 'agent-log-text';
    label.textContent = displayText;
    wrap.appendChild(label);
    item.appendChild(wrap);
  } else {
    const label = document.createElement('span');
    label.className = 'agent-log-text';
    label.textContent = displayText;
    item.appendChild(label);
  }

  return item;
}

/* ══════════════════════════════════════════
   LIVE ASSISTANT BUBBLE
══════════════════════════════════════════ */
const RENDER_THROTTLE_MS = 80;

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
    <div class="content-wrapper" style="flex:1;min-width:0;">
      <div class="content">
        <div class="agent-log"></div>
        <div class="agent-tool-output"></div>
        <div class="agent-reply"></div>
      </div>
      <div class="message-actions assistant-actions" style="display:none;">
        <button class="action-btn copy-msg-btn" title="Copy Message">${copyIcon()}</button>
        <button class="action-btn retry-msg-btn" title="Retry">${retryIcon()}</button>
      </div>
    </div>`;

  chatMessages.appendChild(row);
  smoothScrollToBottom();

  const logEl = row.querySelector('.agent-log');
  const toolOutputEl = row.querySelector('.agent-tool-output');
  const replyEl = row.querySelector('.agent-reply');
  const actionsEl = row.querySelector('.message-actions');

  let _streamActive = false;
  let _accumulated = '';
  let _lastRenderAt = 0;
  let _cursorEl = null;

  return {
    row,

    push(line) {
      const item = buildLogItem(line);
      logEl.appendChild(item);
      requestAnimationFrame(() => item.classList.add('agent-log-item--in'));
      smoothScrollToBottom();
      return {
        done: (success = true) => {
          const dot = item.querySelector('.agent-log-dot');
          if (dot) {
            dot.className = success ? 'agent-log-icon-success' : 'agent-log-icon-error';
            dot.innerHTML = success
              ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
          }
          const text = item.querySelector('.agent-log-text');
          if (text) {
             text.style.color = success ? 'var(--text-secondary)' : '#ef4444';
          }
        }
      };
    },

    showToolOutput(markdown) {
      const block = document.createElement('div');
      block.className = 'agent-tool-output-block';
      block.innerHTML = renderMarkdown(markdown);
      toolOutputEl.appendChild(block);
      smoothScrollToBottom();
    },

    stream(chunk) {
      if (!_streamActive) {
        _streamActive = true;
        logEl.style.transition = 'opacity 0.15s ease';
        logEl.style.opacity = '0';
        setTimeout(() => { logEl.style.display = 'none'; }, 150);
        replyEl.classList.add('is-streaming');
        _cursorEl = document.createElement('span');
        _cursorEl.className = 'stream-cursor';
      }

      _accumulated += chunk;

      const now = Date.now();
      if (now - _lastRenderAt >= RENDER_THROTTLE_MS) {
        _lastRenderAt = now;
        replyEl.innerHTML = renderMarkdown(_accumulated);
        replyEl.appendChild(_cursorEl);
      }

      smoothScrollToBottom();
    },

    finalize(markdown, usage, provider, modelId) {
      _accumulated = markdown;
      _cursorEl?.remove();
      _cursorEl = null;
      replyEl.classList.remove('is-streaming');
      logEl.style.display = 'none';
      replyEl.innerHTML = renderMarkdown(markdown);
      actionsEl.style.display = 'flex';
      attachCopyEvent(actionsEl.querySelector('.copy-msg-btn'), markdown);

      const retryBtn = actionsEl.querySelector('.retry-msg-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', async () => {
          if (state.isTyping) return;
          const rows = Array.from(chatMessages.querySelectorAll('.message-row'));
          const rowIdx = rows.indexOf(row);
          if (rowIdx === -1) return;
          rows.slice(rowIdx).forEach(r => r.remove());
          state.messages = state.messages.slice(0, rowIdx);
          await doSendFromState();
        });
      }

      if (usage) {
        const footer = buildTokenFooter(usage, provider, modelId);
        if (footer) row.querySelector('.content-wrapper')?.appendChild(footer);
      }
      smoothScrollToBottom();
    },

    set(markdown) {
      _accumulated = markdown;
      _cursorEl?.remove();
      _cursorEl = null;
      replyEl.classList.remove('is-streaming');
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

    /** Called when the user clicks stop mid-stream */
    setAborted() {
      _cursorEl?.remove();
      _cursorEl = null;
      replyEl.classList.remove('is-streaming');
      logEl.style.display = 'none';

      // Render whatever streamed so far, with a stopped indicator
      if (_accumulated) {
        replyEl.innerHTML = renderMarkdown(_accumulated);
        // Append a small "stopped" badge
        const badge = document.createElement('span');
        badge.style.cssText = `
          display:inline-flex;align-items:center;gap:4px;
          font-size:10.5px;font-weight:600;letter-spacing:0.3px;
          color:var(--text-muted);background:var(--bg-tertiary);
          border:1px solid var(--border-subtle);border-radius:6px;
          padding:2px 8px;margin-left:8px;vertical-align:middle;
        `;
        badge.textContent = '⏹ stopped';
        replyEl.appendChild(badge);
      } else {
        replyEl.innerHTML = `<span style="color:var(--text-muted);font-size:13px;font-style:italic;">Generation stopped.</span>`;
      }

      actionsEl.style.display = 'flex';
      if (_accumulated) {
        attachCopyEvent(actionsEl.querySelector('.copy-msg-btn'), _accumulated);
      }
      smoothScrollToBottom();
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

    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn copy-msg-btn';
    copyBtn.title = 'Copy Message';
    copyBtn.innerHTML = copyIcon();
    attachCopyEvent(copyBtn, msg.content);

    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn edit-msg-btn';
    editBtn.title = 'Edit Message';
    editBtn.innerHTML = editIcon();

    const retryBtn = document.createElement('button');
    retryBtn.className = 'action-btn retry-msg-btn';
    retryBtn.title = 'Retry';
    retryBtn.innerHTML = retryIcon();

    actions.append(copyBtn, editBtn, retryBtn);
    row.appendChild(actions);

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (msg.attachments.length > 0) {
      bubble.classList.add('has-attachments');
      const gallery = document.createElement('div');
      gallery.className = 'bubble-attachments';
      msg.attachments.forEach(a => {
        if (a.type === 'image') gallery.appendChild(buildImageFrame(a, 'bubble-attachment'));
        else if (a.type === 'file') gallery.appendChild(buildFileFrame(a, 'bubble-attachment'));
      });
      bubble.appendChild(gallery);
    }

    let textEl = null;
    if (msg.content) {
      textEl = document.createElement('div');
      textEl.className = 'bubble-text';
      appendTextWithLineBreaks(textEl, msg.content);
      bubble.appendChild(textEl);
    }

    row.appendChild(bubble);

    editBtn.addEventListener('click', () => {
      if (state.isTyping) return;

      row.classList.add('is-editing');
      actions.style.opacity = '0';
      actions.style.pointerEvents = 'none';

      const originalContent = msg.content;

      const editArea = document.createElement('textarea');
      editArea.className = 'bubble-edit-textarea';
      editArea.value = originalContent;
      if (textEl) {
        textEl.replaceWith(editArea);
      } else {
        bubble.appendChild(editArea);
      }
      editArea.style.height = `${Math.max(editArea.scrollHeight, 60)}px`;
      editArea.focus();
      editArea.setSelectionRange(editArea.value.length, editArea.value.length);
      editArea.addEventListener('input', () => {
        editArea.style.height = 'auto';
        editArea.style.height = `${editArea.scrollHeight}px`;
      });

      const warning = document.createElement('div');
      warning.className = 'bubble-edit-warning';
      warning.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Editing will remove all messages after this point
      `;
      bubble.appendChild(warning);

      const editActions = document.createElement('div');
      editActions.className = 'bubble-edit-actions';
      editActions.innerHTML = `
        <button class="bubble-edit-cancel">Cancel</button>
        <button class="bubble-edit-save">Save &amp; Send</button>
      `;
      bubble.appendChild(editActions);

      const cancelBtn = editActions.querySelector('.bubble-edit-cancel');
      const saveBtn = editActions.querySelector('.bubble-edit-save');

      cancelBtn.addEventListener('click', () => {
        bubble.style.transition = 'max-width 0.22s var(--ease-out-expo), width 0.22s var(--ease-out-expo), opacity 0.15s ease';
        bubble.style.opacity = '0.6';
        setTimeout(() => {
          bubble.style.opacity = '';
          bubble.style.transition = '';
          if (textEl) {
            editArea.replaceWith(textEl);
          } else {
            editArea.remove();
          }
          warning.remove();
          editActions.remove();
          row.classList.remove('is-editing');
          actions.style.opacity = '';
          actions.style.pointerEvents = '';
        }, 180);
      });

      saveBtn.addEventListener('click', async () => {
        const newText = editArea.value.trim();
        if (!newText || state.isTyping) return;

        const rows = Array.from(chatMessages.querySelectorAll('.message-row'));
        const rowIdx = rows.indexOf(row);
        if (rowIdx === -1) return;

        msg.content = newText;
        if (state.messages[rowIdx]) {
          state.messages[rowIdx] = { ...state.messages[rowIdx], content: newText };
        }

        rows.slice(rowIdx + 1).forEach(r => r.remove());
        state.messages = state.messages.slice(0, rowIdx + 1);

        textEl = document.createElement('div');
        textEl.className = 'bubble-text';
        appendTextWithLineBreaks(textEl, newText);
        editArea.replaceWith(textEl);
        warning.remove();
        editActions.remove();
        row.classList.remove('is-editing');

        attachCopyEvent(copyBtn, newText);

        actions.style.opacity = '';
        actions.style.pointerEvents = '';

        updateTimeline();
        await doSendFromState();
      });
    });

    retryBtn.addEventListener('click', async () => {
      if (state.isTyping) return;
      const rows = Array.from(chatMessages.querySelectorAll('.message-row'));
      const rowIdx = rows.indexOf(row);
      if (rowIdx === -1) return;
      rows.slice(rowIdx + 1).forEach(r => r.remove());
      state.messages = state.messages.slice(0, rowIdx + 1);
      updateTimeline();
      await doSendFromState();
    });

  } else {
    row.innerHTML = `
      ${assistantIcon()}
      <div class="content-wrapper" style="flex:1;min-width:0;">
        <div class="content"></div>
        <div class="message-actions assistant-actions">
          <button class="action-btn copy-msg-btn" title="Copy Message">${copyIcon()}</button>
          <button class="action-btn retry-msg-btn" title="Retry">${retryIcon()}</button>
        </div>
      </div>`;
    row.querySelector('.content').innerHTML = renderMarkdown(msg.content);
    attachCopyEvent(row.querySelector('.copy-msg-btn'), msg.content);

    row.querySelector('.retry-msg-btn')?.addEventListener('click', async () => {
      if (state.isTyping) return;
      const rows = Array.from(chatMessages.querySelectorAll('.message-row'));
      const rowIdx = rows.indexOf(row);
      if (rowIdx === -1) return;
      rows.slice(rowIdx).forEach(r => r.remove());
      state.messages = state.messages.slice(0, rowIdx);
      updateTimeline();
      await doSendFromState();
    });
  }

  chatMessages.appendChild(row);
  if (scroll) smoothScrollToBottom();

  if (msg.role === 'user') {
    setTimeout(updateTimeline, 60);
  }

  return row;
}

export function replaceLastAssistant(markdown) {
  const rows = chatMessages.querySelectorAll('.message-row.assistant');
  const last = rows[rows.length - 1];
  if (last) {
    const replyEl = last.querySelector('.agent-reply');
    if (replyEl) replyEl.innerHTML = renderMarkdown(markdown);
    else {
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
    greeting.style.opacity   = '1';
    greeting.style.transform = 'none';
    requestAnimationFrame(() => {
      greeting.style.removeProperty('animation');
      greeting.style.removeProperty('opacity');
      greeting.style.removeProperty('transform');
    });
  }
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
      for (const tc of (plan.toolCalls ?? [])) {
        live.push(`[TOOL] ${tc.name.replace(/_/g, ' ')}`);
        await new Promise(r => setTimeout(r, 80));
      }

      plannedToolCalls = plan.toolCalls ?? [];
    } catch { /* non-fatal */ }
  }

  try {
    _currentAbortController = new AbortController();
    const { text: finalReply, usage, usedProvider, usedModel } = await agentLoop(
      state.messages, live, plannedSkills, plannedToolCalls, state.systemPrompt, _currentAbortController.signal,
    ).finally(() => { _currentAbortController = null; });

    await trackUsage(usage, state.currentChatId, usedProvider, usedModel);
    state.messages.push({ role: 'assistant', content: finalReply, attachments: [] });
    saveCurrentChat();
    bumpScrollBadge();
    setTimeout(updateTimeline, 100);

    attemptMemoryUpdate().catch(() => {});

  } catch (err) {
    _currentAbortController = null;
    if (err.name === 'AbortError') {
      live.setAborted();
      // Don't push to state.messages — partial response discarded
    } else {
      const msg = `Something went wrong: ${err.message}`;
      live.set(msg);
      state.messages.push({ role: 'assistant', content: msg, attachments: [] });
      console.error('[Chat] sendMessage error:', err);
    }
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
  _userMessagesSinceLastLearn = 0;
  // Cancel any in-flight generation
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
    const chat = await window.electronAPI?.loadChat(chatId);
    if (!chat) return;
    state.messages = [];
    state.currentChatId = chat.id;
    state.isTyping = false;
    _userMessagesSinceLastLearn = 0;
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
    setTimeout(updateTimeline, 150);
  } catch (err) { console.error('[Chat] Load error:', err); }
}
