import { state } from '../../../Shared/Core/State.js';
import { render as renderMarkdown } from '../../../Shared/Content/Markdown.js';
import { chatMessages } from '../../../Shared/Core/DOM.js';
import { openHtmlPreviewModal } from '../../../Shared/Modals/HtmlPreviewModal.js';
import { copyIcon, checkIcon, editIcon, retryIcon, assistantIcon } from './ChatIcons.js';
import { buildTokenFooter, updateTimeline } from './ChatTimeline.js';

const RENDER_THROTTLE_MS = 80;

const BROWSER_TOOL_LABELS = {
  browser_navigate: 'Opening the website...',
  browser_snapshot: 'Reading the current page...',
  browser_click: 'Clicking on the page...',
  browser_hover: 'Hovering over the page...',
  browser_focus: 'Focusing the page control...',
  browser_type: 'Typing into the page...',
  browser_clear: 'Clearing a field...',
  browser_press_key: 'Sending a key press...',
  browser_select_option: 'Selecting an option...',
  browser_scroll: 'Scrolling the page...',
  browser_wait: 'Waiting a moment...',
  browser_set_checked: 'Toggling a control...',
  browser_list_options: 'Reading available options...',
  browser_list_links: 'Reading visible links...',
  browser_find_elements: 'Finding matching elements...',
  browser_list_form_fields: 'Reading form fields...',
  browser_scroll_into_view: 'Bringing an element into view...',
  browser_submit_form: 'Submitting the form...',
  browser_wait_for_element: 'Waiting for an element...',
  browser_wait_for_text: 'Waiting for page text...',
  browser_wait_for_navigation: 'Waiting for the next page...',
  browser_read_element: 'Reading a page element...',
  browser_screenshot: 'Capturing the page...',
  browser_get_state: 'Checking the browser state...',
  browser_back: 'Going back in the browser...',
  browser_forward: 'Going forward in the browser...',
  browser_refresh: 'Refreshing the page...',
};

function humanizeBrowserToolLog(text) {
  const failureMatch = String(text ?? '').match(/^(browser_[a-z_]+)\s+failed:\s*(.+)$/i);
  if (failureMatch) {
    const base = BROWSER_TOOL_LABELS[failureMatch[1]] || failureMatch[1];
    return `${base.replace(/\.\.\.$/, '')} failed: ${failureMatch[2]}`;
  }

  const toolName = String(text ?? '').trim().split(/\s+/)[0];
  if (!BROWSER_TOOL_LABELS[toolName]) return text;

  const remainder = String(text ?? '').trim().slice(toolName.length).trim();
  return remainder ? `${BROWSER_TOOL_LABELS[toolName]} ${remainder}` : BROWSER_TOOL_LABELS[toolName];
}

/* ── Attachment frame builders ── */
export function buildImageFrame(attachment, className) {
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

export function buildFileFrame(attachment, className) {
  const extMatch = (attachment.name || '').match(/\.([^.]+)$/);
  const ext = extMatch ? extMatch[1].toUpperCase() : 'FILE';
  const linesText = attachment.summary || (attachment.lines ? `${attachment.lines} lines` : 'File');
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

/* ── Text utilities ── */
export function appendTextWithLineBreaks(container, text) {
  String(text ?? '').split('\n').forEach((line, i) => {
    if (i > 0) container.appendChild(document.createElement('br'));
    container.appendChild(document.createTextNode(line));
  });
}

export function smoothScrollToBottom() {
  chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
}

/* ── Copy event helper ── */
export function attachCopyEvent(btn, textToCopy) {
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

/* ── Agent log item builder ── */
export function buildLogItem(rawLine) {
  const item = document.createElement('div');
  item.className = 'agent-log-item';

  const dotSpan = document.createElement('span');
  dotSpan.className = 'agent-log-dot';
  item.appendChild(dotSpan);

  let iconHtml = '';
  let displayText = rawLine;

  if (String(displayText ?? '').trim().startsWith('Thinking')) {
    displayText = 'Understanding the request...';
  }

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
    displayText = humanizeBrowserToolLog(rawLine.slice(6).trim());
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

/* ── Live assistant streaming bubble ── */
export function createLiveRow(doSendFromStateFn) {
  const row = document.createElement('div');
  row.className = 'message-row assistant';

  row.innerHTML = `
    ${assistantIcon()}
    <div class="content-wrapper">
      <div class="content">
        <div class="agent-thinking-shell agent-thinking-shell--working">
          <button type="button" class="agent-thinking-toggle" aria-expanded="false">
            <span class="agent-thinking-summary">
            <span class="agent-thinking-dot"></span>
              <span class="agent-thinking-label">Thinking</span>
            </span>
            <span class="agent-thinking-caret" aria-hidden="true" hidden>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 8l4 4 4-4"></path>
              </svg>
            </span>
          </button>
          <div class="agent-thinking-body" hidden>
            <div class="agent-thinking-trace" hidden>
              <div class="agent-thinking-trace-content">Blooming ideas...</div>
            </div>
            <div class="agent-log"></div>
            <div class="agent-tool-output"></div>
          </div>
        </div>
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
  const thinkingShellEl = row.querySelector('.agent-thinking-shell');
  const thinkingToggleEl = row.querySelector('.agent-thinking-toggle');
  const thinkingBodyEl = row.querySelector('.agent-thinking-body');
  const thinkingTraceEl = row.querySelector('.agent-thinking-trace');
  const thinkingTraceContentEl = row.querySelector('.agent-thinking-trace-content');
  const thinkingCaretEl = row.querySelector('.agent-thinking-caret');

  let _streamActive = false;
  let _accumulated = '';
  let _reasoning = '';
  let _lastRenderAt = 0;
  let _lastReasoningRenderAt = 0;
  let _cursorEl = null;
  let _thinkingState = 'working';
  // Tracks whether any expandable content has arrived (log items or reasoning).
  // The caret is shown only once this is true.
  let _hasContent = false;

  /* ── Reveal the caret once there is content to expand/collapse ── */
  function revealCaret() {
    if (_hasContent) return;
    _hasContent = true;
    if (thinkingCaretEl) thinkingCaretEl.removeAttribute('hidden');
  }

  function setThinkingOpen(open) {
    thinkingToggleEl?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (thinkingBodyEl) thinkingBodyEl.hidden = !open;
  }

  function setThinkingState(nextState) {
    _thinkingState = nextState;
    if (!thinkingShellEl) return;
    thinkingShellEl.classList.remove(
      'agent-thinking-shell--working',
      'agent-thinking-shell--complete',
      'agent-thinking-shell--error',
    );
    thinkingShellEl.classList.add(`agent-thinking-shell--${nextState}`);
  }

  thinkingToggleEl?.addEventListener('click', () => {
    if (!_hasContent) return; // nothing to toggle yet
    const isOpen = thinkingToggleEl.getAttribute('aria-expanded') === 'true';
    setThinkingOpen(!isOpen);
  });

  function renderReasoning(force = false) {
    if (!thinkingTraceEl || !thinkingTraceContentEl) return;

    const text = _reasoning.trim();
    thinkingTraceEl.hidden = !text;
    if (!text) return;

    const now = Date.now();
    if (!force && now - _lastReasoningRenderAt < RENDER_THROTTLE_MS) return;

    _lastReasoningRenderAt = now;
    thinkingTraceContentEl.textContent = text;
  }

  return {
    row,

    push(line) {
      revealCaret();
      // Auto-open the body the first time content is pushed
      if (!_hasContent || thinkingToggleEl?.getAttribute('aria-expanded') !== 'true') {
        setThinkingOpen(true);
      }
      const item = buildLogItem(line);
      logEl.appendChild(item);
      requestAnimationFrame(() => item.classList.add('agent-log-item--in'));
      smoothScrollToBottom();
      return {
        done: (success = true, nextLine = '') => {
          const dot = item.querySelector('.agent-log-dot');
          if (dot) {
            dot.className = success ? 'agent-log-icon-success' : 'agent-log-icon-error';
            dot.innerHTML = success
              ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
          }
          const text = item.querySelector('.agent-log-text');
          if (text) {
            if (nextLine) text.textContent = nextLine;
            text.style.color = success ? 'var(--text-secondary)' : '#ef4444';
          }
          if (!success) setThinkingState('error');
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

    streamThinking(chunk) {
      const text = String(chunk ?? '');
      if (!text) return;
      _reasoning += text;
      // Reveal caret and open body when reasoning starts
      revealCaret();
      setThinkingOpen(true);
      renderReasoning();
      smoothScrollToBottom();
    },

    showPhotoGallery({ query, total, photos = [] }) {
      if (!photos.length) return;

      const wrap = document.createElement('div');
      wrap.className = 'agent-photo-gallery';

      const header = document.createElement('div');
      header.className = 'agent-photo-gallery-header';
      header.innerHTML = `
        <span class="agent-photo-gallery-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          ${photos.length} photos for &ldquo;${query}&rdquo;
        </span>
        <span class="agent-photo-gallery-meta">${(total ?? photos.length).toLocaleString()} total on Unsplash</span>
      `;
      wrap.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'agent-photo-grid';

      photos.forEach((photo) => {
        const card = document.createElement('a');
        card.className = 'agent-photo-card';
        card.href = photo.photographerUrl || '#';
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.title = `${photo.photographer} — click to view profile`;

        const imgWrap = document.createElement('div');
        imgWrap.className = 'agent-photo-img-wrap';

        const img = document.createElement('img');
        img.src = photo.thumb || photo.small || '';
        img.alt = photo.description || 'Unsplash photo';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (photo.pageUrl) window.open(photo.pageUrl, '_blank', 'noopener,noreferrer');
        });
        imgWrap.appendChild(img);

        const overlay = document.createElement('div');
        overlay.className = 'agent-photo-overlay';
        overlay.innerHTML = `
          <span class="agent-photo-desc">${(photo.description || '').slice(0, 60)}${photo.description?.length > 60 ? '…' : ''}</span>
          <span class="agent-photo-likes">
            <svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            ${photo.likes?.toLocaleString() ?? 0}
          </span>
        `;
        imgWrap.appendChild(overlay);
        card.appendChild(imgWrap);

        const meta = document.createElement('div');
        meta.className = 'agent-photo-meta';
        meta.innerHTML = `
          <span class="agent-photo-photographer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            ${photo.photographer}
          </span>
          <span class="agent-photo-dims">${photo.width ?? '?'}×${photo.height ?? '?'}</span>
        `;
        card.appendChild(meta);

        grid.appendChild(card);
      });

      wrap.appendChild(grid);

      // Ensure thinking panel is open so gallery is visible
      revealCaret();
      setThinkingOpen(true);
      toolOutputEl.appendChild(wrap);
      smoothScrollToBottom();
    },

    stream(chunk) {
      if (!_streamActive) {
        _streamActive = true;
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
      renderReasoning(true);
      _cursorEl?.remove();
      _cursorEl = null;
      replyEl.classList.remove('is-streaming');
      if (_thinkingState !== 'error') setThinkingState('complete');
      replyEl.innerHTML = renderMarkdown(markdown);
      actionsEl.style.display = 'flex';
      attachCopyEvent(actionsEl.querySelector('.copy-msg-btn'), markdown);

      // Collapse the thinking shell after finalization if there's content
      if (_hasContent && thinkingToggleEl?.getAttribute('aria-expanded') === 'true') {
        setThinkingOpen(false);
      }

      const retryBtn = actionsEl.querySelector('.retry-msg-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', async () => {
          if (state.isTyping) return;
          const rows = Array.from(chatMessages.querySelectorAll('.message-row'));
          const rowIdx = rows.indexOf(row);
          if (rowIdx === -1) return;
          rows.slice(rowIdx).forEach(r => r.remove());
          state.messages = state.messages.slice(0, rowIdx);
          await doSendFromStateFn();
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
      renderReasoning(true);
      _cursorEl?.remove();
      _cursorEl = null;
      replyEl.classList.remove('is-streaming');
      if (_thinkingState !== 'error') setThinkingState('complete');
      replyEl.innerHTML = renderMarkdown(markdown);
      actionsEl.style.display = 'flex';
      attachCopyEvent(actionsEl.querySelector('.copy-msg-btn'), markdown);
      smoothScrollToBottom();
    },

    /** Called when the user clicks stop mid-stream */
    setAborted() {
      renderReasoning(true);
      _cursorEl?.remove();
      _cursorEl = null;
      replyEl.classList.remove('is-streaming');
      if (_thinkingState !== 'error') setThinkingState('complete');

      if (_accumulated) {
        replyEl.innerHTML = renderMarkdown(_accumulated);
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

/* ── Click handler for code copy/download in chat ── */
export async function onChatMessagesClick(e) {
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

  const previewCodeBtn = e.target.closest('.preview-code-btn');
  if (previewCodeBtn) {
    const wrapper = previewCodeBtn.closest('.code-wrapper');
    const codeEl = wrapper?.querySelector('code');
    if (!codeEl) return;
    openHtmlPreviewModal(codeEl.textContent);
    return;
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
}

/* ── Message normalisation / sanitisation ── */
const INTERNAL_ASSISTANT_TOOL_PATTERNS = [
  /^\s*I\s+(?:used|called|ran|invoked)\s+(?:the\s+)?[A-Za-z0-9_.\-\s/]+\s+tool\b.*$/i,
  /^\s*Tool result for\b/i,
  /^\s*Internal execution context for the assistant only\b/i,
  /\[TERMINAL:[^\]]+\]/i,
];

export function normalizeMessage(msg) {
  return {
    role: msg?.role ?? 'user',
    content: String(msg?.content ?? ''),
    attachments: Array.isArray(msg?.attachments)
      ? msg.attachments.filter(a => (a?.type === 'image' || a?.type === 'file') && (typeof a.dataUrl === 'string' || typeof a.textContent === 'string'))
      : [],
  };
}

function isInternalAssistantToolLeak(text) {
  const value = String(text ?? '').trim();
  if (!value) return false;
  return INTERNAL_ASSISTANT_TOOL_PATTERNS.some(pattern => pattern.test(value));
}

export function isInternalHiddenMessage(msg) {
  if (!msg) return false;
  if (msg.role === 'assistant') return isInternalAssistantToolLeak(msg.content);
  if (msg.role !== 'user') return false;
  return /^\s*(?:Tool result for|Internal execution context for the assistant only)\b/i.test(String(msg.content ?? ''));
}

export function sanitizeAssistantReply(text) {
  const value = String(text ?? '').trim();
  if (!value) return '(empty response)';
  if (!isInternalAssistantToolLeak(value)) return value;
  return 'I ran into an internal formatting issue while preparing the answer. Please try again.';
}

export function sanitizeMessagesForUI(messages = []) {
  return messages
    .map(normalizeMessage)
    .filter(message => !isInternalHiddenMessage(message));
}

/* ── appendMessage ── */
export function appendMessage(role, content, addToState = true, scroll = true, attachments = [], doSendFromStateFn = () => { }) {
  const msg = normalizeMessage({ role, content, attachments });
  if (isInternalHiddenMessage(msg)) return null;
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
        await doSendFromStateFn();
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
      await doSendFromStateFn();
    });

  } else {
    row.innerHTML = `
      ${assistantIcon()}
      <div class="content-wrapper">
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
      await doSendFromStateFn();
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