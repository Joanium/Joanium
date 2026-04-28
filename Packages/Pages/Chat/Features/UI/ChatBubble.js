import { state } from '../../../../System/State.js';
import { render as renderMarkdown } from '../../../Shared/Content/Markdown.js';
import { chatMessages } from '../../../Shared/Core/DOM.js';
import { openHtmlPreviewModal } from '../../../../Modals/HtmlPreviewModal.js';
import {
  copyIcon,
  checkIcon,
  editIcon,
  retryIcon,
  assistantIcon,
  speakIcon,
  starIcon,
} from './ChatIcons.js';
import { toggleSpeak } from '../../Voice/VoicePlayer.js';
import { buildTokenFooter, updateTimeline, maybeScrollToBottom } from './ChatTimeline.js';
import {
  cloneSubAgentRunAttachment,
  createLiveSubAgentRunTracker,
  createSubAgentRunElement,
  isSubAgentRunAttachment,
} from './SubAgentPanels.js';
const REASONING_TAG_NAMES = new Set([
    'think',
    'thinking',
    'reason',
    'reasoning',
    'analysis',
    'reflection',
  ]),
  BROWSER_TOOL_LABELS = {
    spawn_sub_agents: 'Delegating to focused sub-agents...',
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
function parseLeadingHtmlTagToken(value) {
  const text = String(value ?? '');
  if (!text.startsWith('<')) return { complete: !0, isTag: !1, raw: '' };
  if (text.length >= 2 && !/[A-Za-z/!]/.test(text[1])) return { complete: !0, isTag: !1, raw: '<' };
  const closeIndex = text.indexOf('>');
  if (-1 === closeIndex) return { complete: !1, isTag: !1, raw: '' };
  const raw = text.slice(0, closeIndex + 1),
    match = raw.match(/^<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:_-]*)\b[^>]*>$/);
  if (!match) return { complete: !0, isTag: !1, raw: raw };
  const isClosing = Boolean(match[1]),
    tagName = match[2].toLowerCase(),
    isReasoningTag = REASONING_TAG_NAMES.has(tagName);
  return {
    complete: !0,
    isTag: !0,
    raw: raw,
    isReasoningOpen: isReasoningTag && !isClosing,
    isReasoningClose: isReasoningTag && isClosing,
  };
}
export function buildImageFrame(attachment, className) {
  const frame = document.createElement('div');
  ((frame.className = className), (frame.title = attachment.name || 'Pasted image'));
  const img = document.createElement('img');
  return (
    (img.src = attachment.dataUrl || attachment.url || ''),
    (img.alt = attachment.name || 'Pasted image'),
    (img.loading = 'lazy'),
    frame.appendChild(img),
    frame
  );
}
function createStaticIcon(svgMarkup) {
  const icon = document.createElement('span');
  return (icon.setAttribute('aria-hidden', 'true'), (icon.innerHTML = svgMarkup), icon);
}
function toSafeHttpUrl(rawUrl) {
  const value = String(rawUrl ?? '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}
export function buildFileFrame(attachment, className) {
  const extMatch = (attachment.name || '').match(/\.([^.]+)$/),
    ext = extMatch ? extMatch[1].toUpperCase() : 'FILE',
    linesText = attachment.summary || (attachment.lines ? `${attachment.lines} lines` : 'File'),
    frame = document.createElement('div');
  ((frame.className = `${className} chat-file-frame`), (frame.title = attachment.name || 'File'));
  const nameEl = document.createElement('div');
  ((nameEl.className = 'chat-file-frame-name'), (nameEl.textContent = attachment.name || 'File'));
  const summaryEl = document.createElement('div');
  ((summaryEl.className = 'chat-file-frame-summary'), (summaryEl.textContent = linesText));
  const extEl = document.createElement('div');
  return (
    (extEl.className = 'chat-file-frame-ext'),
    (extEl.textContent = ext),
    frame.append(nameEl, summaryEl, extEl),
    frame
  );
}
function clonePhotoGalleryAttachment(gallery) {
  return {
    type: 'photo_gallery',
    query: gallery?.query ?? '',
    total: gallery?.total ?? null,
    photos: Array.isArray(gallery?.photos)
      ? gallery.photos.map((photo) => ({
          id: photo?.id ?? '',
          description: photo?.description ?? 'Photo',
          thumb: photo?.thumb ?? '',
          small: photo?.small ?? '',
          regular: photo?.regular ?? '',
          full: photo?.full ?? '',
          pageUrl: photo?.pageUrl ?? '',
          photographer: photo?.photographer ?? 'Unknown',
          photographerUsername: photo?.photographerUsername ?? '',
          photographerUrl: photo?.photographerUrl ?? '',
          likes: photo?.likes ?? 0,
          width: photo?.width ?? null,
          height: photo?.height ?? null,
        }))
      : [],
  };
}
function isSupportedAttachment(attachment) {
  return (
    !(!attachment || 'object' != typeof attachment) &&
    ('image' === attachment.type
      ? 'string' == typeof attachment.dataUrl || 'string' == typeof attachment.url
      : 'file' === attachment.type
        ? 'string' == typeof attachment.dataUrl || 'string' == typeof attachment.textContent
        : 'photo_gallery' === attachment.type
          ? Array.isArray(attachment.photos) && attachment.photos.length > 0
          : 'subagent_run' === attachment.type && isSubAgentRunAttachment(attachment))
  );
}
function createPhotoGalleryElement({ query: query, total: total, photos: photos = [] }) {
  const wrap = document.createElement('div');
  wrap.className = 'agent-photo-gallery';
  const header = document.createElement('div');
  header.className = 'agent-photo-gallery-header';
  const title = document.createElement('span');
  ((title.className = 'agent-photo-gallery-title'),
    title.append(
      createStaticIcon(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      ),
      document.createTextNode(`${photos.length} photos for "${query}"`),
    ));
  const metaCount = document.createElement('span');
  ((metaCount.className = 'agent-photo-gallery-meta'),
    (metaCount.textContent = `${(total ?? photos.length).toLocaleString()} total on Unsplash`),
    header.append(title, metaCount),
    wrap.appendChild(header));
  const grid = document.createElement('div');
  return (
    (grid.className = 'agent-photo-grid'),
    photos.forEach((photo) => {
      const card = document.createElement('a');
      card.className = 'agent-photo-card';
      const profileUrl = toSafeHttpUrl(photo.photographerUrl),
        pageUrl = toSafeHttpUrl(photo.pageUrl);
      ((card.href = profileUrl || '#'),
        profileUrl && ((card.target = '_blank'), (card.rel = 'noopener noreferrer')),
        (card.title = `${photo.photographer} - click to view profile`));
      const imgWrap = document.createElement('div');
      imgWrap.className = 'agent-photo-img-wrap';
      const img = document.createElement('img');
      ((img.src = toSafeHttpUrl(photo.thumb) || toSafeHttpUrl(photo.small) || ''),
        (img.alt = photo.description || 'Unsplash photo'),
        (img.loading = 'lazy'),
        (img.decoding = 'async'),
        img.addEventListener('click', (e) => {
          (e.preventDefault(),
            e.stopPropagation(),
            pageUrl && window.open(pageUrl, '_blank', 'noopener,noreferrer'));
        }),
        imgWrap.appendChild(img));
      const overlay = document.createElement('div');
      overlay.className = 'agent-photo-overlay';
      const descEl = document.createElement('span');
      descEl.className = 'agent-photo-desc';
      const description = String(photo.description || '');
      descEl.textContent = `${description.slice(0, 60)}${description.length > 60 ? '...' : ''}`;
      const likesEl = document.createElement('span');
      ((likesEl.className = 'agent-photo-likes'),
        likesEl.append(
          createStaticIcon(
            '<svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
          ),
          document.createTextNode(` ${photo.likes?.toLocaleString() ?? 0}`),
        ),
        overlay.append(descEl, likesEl),
        imgWrap.appendChild(overlay),
        card.appendChild(imgWrap));
      const meta = document.createElement('div');
      meta.className = 'agent-photo-meta';
      const photographerEl = document.createElement('span');
      ((photographerEl.className = 'agent-photo-photographer'),
        photographerEl.append(
          createStaticIcon(
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
          ),
          document.createTextNode(` ${photo.photographer}`),
        ));
      const dimsEl = document.createElement('span');
      ((dimsEl.className = 'agent-photo-dims'),
        (dimsEl.textContent = `${photo.width ?? '?'}x${photo.height ?? '?'}`),
        meta.append(photographerEl, dimsEl),
        card.appendChild(meta),
        grid.appendChild(card));
    }),
    wrap.appendChild(grid),
    wrap
  );
}
export function appendTextWithLineBreaks(container, text) {
  String(text ?? '')
    .split('\n')
    .forEach((line, i) => {
      (i > 0 && container.appendChild(document.createElement('br')),
        container.appendChild(document.createTextNode(line)));
    });
}
export function smoothScrollToBottom() {
  maybeScrollToBottom({ behavior: 'smooth' });
}
// Find an unclosed (open) code fence in accumulated streaming text.
// Returns { stablePart, lang, code } or null if no open fence exists.
function parseOpenFence(text) {
  let lastCompleteEnd = 0;
  const re = /```[^\n`]*\n?[\s\S]*?```/g;
  let m;
  while ((m = re.exec(text)) !== null) lastCompleteEnd = m.index + m[0].length;
  const afterComplete = text.slice(lastCompleteEnd);
  const idx = afterComplete.indexOf('```');
  if (idx === -1) return null;
  const absIdx = lastCompleteEnd + idx;
  const rest = text.slice(absIdx + 3);
  const nl = rest.indexOf('\n');
  return {
    stablePart: text.slice(0, absIdx),
    lang: (nl === -1 ? rest : rest.slice(0, nl)).trim(),
    code: nl === -1 ? '' : rest.slice(nl + 1),
  };
}
export function attachCopyEvent(btn, textToCopy) {
  btn &&
    (btn.onclick = async () => {
      try {
        (await navigator.clipboard.writeText(textToCopy),
          (btn.innerHTML = checkIcon()),
          (btn.style.color = 'var(--accent)'),
          setTimeout(() => {
            ((btn.innerHTML = copyIcon()), (btn.style.color = ''));
          }, 2e3));
      } catch (err) {
        console.error('Failed to copy message:', err);
      }
    });
}
export function buildLogItem(rawLine) {
  const item = document.createElement('div');
  item.className = 'agent-log-item';
  const statusWrap = document.createElement('span');
  statusWrap.className = 'agent-log-status';
  const dotSpan = document.createElement('span');
  ((dotSpan.className = 'agent-log-dot'),
    statusWrap.appendChild(dotSpan),
    item.appendChild(statusWrap));
  let iconHtml = '',
    displayText = rawLine;
  if (
    (String(displayText ?? '')
      .trim()
      .startsWith('Thinking') && (displayText = 'Working…'),
    rawLine.startsWith('[GMAIL]')
      ? ((displayText = rawLine.slice(7).trim()),
        (iconHtml =
          '<img src="../../../Assets/Icons/Gmail.png" alt="Gmail" class="agent-log-source-icon"/>'))
      : rawLine.startsWith('[GITHUB]')
        ? ((displayText = rawLine.slice(8).trim()),
          (iconHtml =
            '<img src="../../../Assets/Icons/Github.png" alt="GitHub" class="agent-log-source-icon"/>'))
        : rawLine.startsWith('[SKILL]')
          ? ((displayText = rawLine.slice(7).trim()),
            (iconHtml =
              '<img src="../../../Assets/Logo/Logo.png" alt="Joanium" width="14" height="14">'))
          : rawLine.startsWith('[TOOL]') &&
            ((displayText = (function (text) {
              const failureMatch = String(text ?? '').match(
                /^(browser_[a-z_]+)\s+failed:\s*(.+)$/i,
              );
              if (failureMatch)
                return `${(BROWSER_TOOL_LABELS[failureMatch[1]] || failureMatch[1]).replace(/\.\.\.$/, '')} failed: ${failureMatch[2]}`;
              const toolName = String(text ?? '')
                .trim()
                .split(/\s+/)[0];
              if (!BROWSER_TOOL_LABELS[toolName]) return text;
              const remainder = String(text ?? '')
                .trim()
                .slice(toolName.length)
                .trim();
              return remainder
                ? `${BROWSER_TOOL_LABELS[toolName]} ${remainder}`
                : BROWSER_TOOL_LABELS[toolName];
            })(rawLine.slice(6).trim())),
            (iconHtml =
              '<svg class="agent-log-source-icon agent-log-source-icon--tool" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"\n            stroke-linecap="round" stroke-linejoin="round"/>\n    </svg>')),
    iconHtml)
  ) {
    const wrap = document.createElement('span');
    wrap.className = 'agent-log-item-with-icon';
    const glyph = document.createElement('span');
    ((glyph.className = 'agent-log-item-glyph'), (glyph.innerHTML = iconHtml));
    const label = document.createElement('span');
    ((label.className = 'agent-log-text'),
      (label.textContent = displayText),
      wrap.appendChild(glyph),
      wrap.appendChild(label),
      item.appendChild(wrap));
  } else {
    const label = document.createElement('span');
    ((label.className = 'agent-log-text agent-log-item-main'),
      (label.textContent = displayText),
      item.appendChild(label));
  }
  return item;
}
export function createLiveRow(doSendFromStateFn) {
  const row = document.createElement('div');
  ((row.className = 'message-row assistant'),
    (row.innerHTML = `\n    ${assistantIcon()}\n    <div class="content-wrapper">\n      <div class="content">\n        <div class="agent-thinking-shell agent-thinking-shell--working">\n          <button type="button" class="agent-thinking-toggle" aria-expanded="false">\n            <span class="agent-thinking-summary">\n            <span class="agent-thinking-dot"></span>\n              <span class="agent-thinking-label">Thinking</span>\n            </span>\n            <span class="agent-thinking-caret" aria-hidden="true" hidden>\n              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">\n                <path d="M6 8l4 4 4-4"></path>\n              </svg>\n            </span>\n          </button>\n          <div class="agent-thinking-body" hidden>\n            <div class="agent-thinking-trace" hidden>\n              <div class="agent-thinking-trace-content">Blooming ideas...</div>\n            </div>\n            <div class="agent-log"></div>\n            <div class="agent-tool-output"></div>\n          </div>\n        </div>\n        <div class="agent-reply">\n          <div class="agent-reply-media"></div>\n          <div class="agent-reply-text"></div>\n        </div>\n      </div>\n      <div class="message-actions assistant-actions" style="display:none;">\n        <button class="action-btn copy-msg-btn" title="Copy Message">${copyIcon()}</button>\n        <button class="action-btn speak-msg-btn" title="Speak">${speakIcon()}</button>\n        <button class="action-btn retry-msg-btn" title="Retry">${retryIcon()}</button>\n        <button class="action-btn star-msg-btn" title="Star this exchange">${starIcon(false)}</button>\n      </div>\n    </div>`),
    chatMessages.appendChild(row),
    smoothScrollToBottom());
  const logEl = row.querySelector('.agent-log'),
    toolOutputEl = row.querySelector('.agent-tool-output'),
    replyMediaEl = row.querySelector('.agent-reply-media'),
    replyTextEl = row.querySelector('.agent-reply-text'),
    actionsEl = row.querySelector('.message-actions'),
    thinkingShellEl = row.querySelector('.agent-thinking-shell'),
    thinkingToggleEl = row.querySelector('.agent-thinking-toggle'),
    thinkingBodyEl = row.querySelector('.agent-thinking-body'),
    thinkingTraceEl = row.querySelector('.agent-thinking-trace'),
    thinkingTraceContentEl = row.querySelector('.agent-thinking-trace-content'),
    thinkingCaretEl = row.querySelector('.agent-thinking-caret');
  let _streamActive = !1,
    _accumulated = '',
    _reasoning = '',
    _lastRenderAt = 0,
    _lastReasoningRenderAt = 0,
    _cursorEl = null,
    _thinkingState = 'working',
    _replyAttachments = [],
    _startTime = Date.now(),
    _lastStableText = null;
  // Split replyTextEl into two stable sub-containers so stream() can update
  // only the open code block without reflowing the already-rendered content.
  const _stableEl = document.createElement('div');
  const _codeStreamEl = document.createElement('div');
  replyTextEl.appendChild(_stableEl);
  replyTextEl.appendChild(_codeStreamEl);
  const _streamFilter = (function () {
      let _buffer = '',
        _reasoningDepth = 0;
      return {
        appendChunk(chunk) {
          if (((_buffer += String(chunk ?? '')), !_buffer))
            return { visibleChunk: '', reasoningChunk: '' };
          let visibleChunk = '',
            reasoningChunk = '';
          for (; _buffer; ) {
            if (!_buffer.startsWith('<')) {
              const nextTagIndex = _buffer.indexOf('<'),
                textPart = -1 === nextTagIndex ? _buffer : _buffer.slice(0, nextTagIndex);
              (_reasoningDepth > 0 ? (reasoningChunk += textPart) : (visibleChunk += textPart),
                (_buffer = -1 === nextTagIndex ? '' : _buffer.slice(nextTagIndex)));
              continue;
            }
            const parsed = parseLeadingHtmlTagToken(_buffer);
            if (!parsed.complete) break;
            const consumed = parsed.raw || '<';
            parsed.isTag
              ? (parsed.isReasoningOpen
                  ? (_reasoningDepth += 1)
                  : parsed.isReasoningClose
                    ? (_reasoningDepth = Math.max(0, _reasoningDepth - 1))
                    : _reasoningDepth > 0
                      ? (reasoningChunk += consumed)
                      : (visibleChunk += consumed),
                (_buffer = _buffer.slice(consumed.length)))
              : (_reasoningDepth > 0 ? (reasoningChunk += consumed) : (visibleChunk += consumed),
                (_buffer = _buffer.slice(consumed.length)));
          }
          return { visibleChunk: visibleChunk, reasoningChunk: reasoningChunk };
        },
        flushVisibleRemainder() {
          if (!_buffer) return '';
          const remainder = _reasoningDepth > 0 ? '' : _buffer;
          return ((_buffer = ''), (_reasoningDepth = 0), remainder);
        },
        reset() {
          ((_buffer = ''), (_reasoningDepth = 0));
        },
      };
    })(),
    _subAgentTracker = createLiveSubAgentRunTracker(replyMediaEl);
  let _hasContent = !1;
  function revealCaret() {
    _hasContent ||
      ((_hasContent = !0), thinkingCaretEl && thinkingCaretEl.removeAttribute('hidden'));
  }
  function setThinkingOpen(open) {
    (thinkingToggleEl?.setAttribute('aria-expanded', open ? 'true' : 'false'),
      thinkingBodyEl && (thinkingBodyEl.hidden = !open));
  }
  function setThinkingState(nextState) {
    ((_thinkingState = nextState),
      thinkingShellEl &&
        (thinkingShellEl.classList.remove(
          'agent-thinking-shell--working',
          'agent-thinking-shell--complete',
          'agent-thinking-shell--error',
        ),
        thinkingShellEl.classList.add(`agent-thinking-shell--${nextState}`)));
  }
  function renderReasoning(force = !1) {
    if (!thinkingTraceEl || !thinkingTraceContentEl) return;
    const text = _reasoning.trim();
    if (((thinkingTraceEl.hidden = !text), !text)) return;
    const now = Date.now();
    (!force && now - _lastReasoningRenderAt < 80) ||
      ((_lastReasoningRenderAt = now), (thinkingTraceContentEl.textContent = text));
  }
  function appendReasoningChunk(chunk) {
    const text = String(chunk ?? '');
    return (
      !!text && ((_reasoning += text), revealCaret(), setThinkingOpen(!0), renderReasoning(), !0)
    );
  }
  return (
    thinkingToggleEl?.addEventListener('click', () => {
      _hasContent && setThinkingOpen(!('true' === thinkingToggleEl.getAttribute('aria-expanded')));
    }),
    {
      row: row,
      push(line) {
        (revealCaret(),
          (_hasContent && 'true' === thinkingToggleEl?.getAttribute('aria-expanded')) ||
            setThinkingOpen(!0));
        const item = buildLogItem(line);
        return (
          logEl.appendChild(item),
          requestAnimationFrame(() => item.classList.add('agent-log-item--in')),
          smoothScrollToBottom(),
          {
            done: (success = !0, nextLine = '') => {
              const dot = item.querySelector('.agent-log-dot');
              dot &&
                ((dot.className = success ? 'agent-log-icon-success' : 'agent-log-icon-error'),
                (dot.innerHTML = success
                  ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                  : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'));
              const text = item.querySelector('.agent-log-text');
              (text &&
                (nextLine && (text.textContent = nextLine),
                (text.style.color = success ? 'var(--text-secondary)' : '#ef4444')),
                success || setThinkingState('error'));
            },
          }
        );
      },
      showToolOutput(markdown) {
        const block = document.createElement('div');
        ((block.className = 'agent-tool-output-block'),
          (block.innerHTML = renderMarkdown(markdown)),
          toolOutputEl.appendChild(block),
          smoothScrollToBottom());
      },
      streamThinking(chunk) {
        appendReasoningChunk(chunk) && smoothScrollToBottom();
      },
      showPhotoGallery({ query: query, total: total, photos: photos = [] }) {
        photos.length &&
          (_replyAttachments.push(
            clonePhotoGalleryAttachment({ query: query, total: total, photos: photos }),
          ),
          replyMediaEl.appendChild(
            createPhotoGalleryElement({ query: query, total: total, photos: photos }),
          ),
          smoothScrollToBottom());
      },
      showSubAgentRun(run) {
        run &&
          (_replyAttachments.push(cloneSubAgentRunAttachment(run)),
          replyMediaEl.appendChild(createSubAgentRunElement(run)),
          smoothScrollToBottom());
      },
      getToolExecutionHooks: (toolName) => ({
        signal: null,
        onSubAgentEvent:
          'spawn_sub_agents' === String(toolName ?? '')
            ? (event) => {
                (_subAgentTracker.onEvent(event), smoothScrollToBottom());
              }
            : null,
      }),
      stream(chunk) {
        _streamActive ||
          ((_streamActive = !0),
          replyTextEl.classList.add('is-streaming'),
          (_cursorEl = document.createElement('span')),
          (_cursorEl.className = 'stream-cursor'));
        const { visibleChunk: visibleChunk, reasoningChunk: reasoningChunk } =
            _streamFilter.appendChunk(chunk),
          didUpdateReasoning = appendReasoningChunk(reasoningChunk);
        if ((visibleChunk && (_accumulated += visibleChunk), !visibleChunk && !didUpdateReasoning))
          return;
        const now = Date.now();
        if (now - _lastRenderAt < 80) {
          smoothScrollToBottom();
          return;
        }
        _lastRenderAt = now;
        const openFence = parseOpenFence(_accumulated);
        if (openFence) {
          // Only re-render the stable prefix when it actually changes
          if (openFence.stablePart !== _lastStableText) {
            _lastStableText = openFence.stablePart;
            _stableEl.innerHTML = renderMarkdown(openFence.stablePart);
          }
          // Surgical textContent update on the live code block — zero DOM rebuild
          let codeEl = _codeStreamEl.querySelector('code');
          if (!codeEl) {
            const display = openFence.lang || 'code';
            _codeStreamEl.innerHTML =
              `<div class="code-wrapper is-streaming"><div class="code-header"><span class="code-lang">${display}</span><div class="code-actions"></div></div>` +
              `<pre><code${openFence.lang ? ` class="language-${openFence.lang}"` : ''}></code></pre></div>`;
            codeEl = _codeStreamEl.querySelector('code');
          }
          codeEl.textContent = openFence.code;
          _codeStreamEl.appendChild(_cursorEl);
        } else {
          // No open fence — all accumulated content is stable prose/complete blocks
          // Keep it in _stableEl only; never touch replyTextEl.innerHTML during streaming
          if (_accumulated !== _lastStableText) {
            _lastStableText = _accumulated;
            _stableEl.innerHTML = renderMarkdown(_accumulated);
          }
          if (_codeStreamEl.innerHTML !== '') _codeStreamEl.innerHTML = '';
          _stableEl.appendChild(_cursorEl);
        }
        smoothScrollToBottom();
      },
      clearReply() {
        ((_streamActive = !1),
          (_accumulated = ''),
          _streamFilter.reset(),
          _cursorEl?.remove(),
          (_cursorEl = null),
          (_lastStableText = null),
          (_stableEl.innerHTML = ''),
          (_codeStreamEl.innerHTML = ''),
          // finalize() replaces replyTextEl.innerHTML, detaching our sub-containers.
          // Re-mount them so the next stream() call can use them cleanly.
          replyTextEl.contains(_stableEl) || replyTextEl.appendChild(_stableEl),
          replyTextEl.contains(_codeStreamEl) || replyTextEl.appendChild(_codeStreamEl),
          replyTextEl.classList.remove('is-streaming'),
          (actionsEl.style.display = 'none'));
      },
      finalize(markdown, usage, provider, modelId) {
        _streamFilter.reset();
        const safeMarkdown = stripAssistantReasoningTags(markdown) || '(empty response)';
        logEl.querySelectorAll('.agent-log-dot').forEach((dot) => {
          ((dot.className = 'agent-log-icon-success'),
            (dot.innerHTML =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'));
        });
        ((_accumulated = safeMarkdown),
          renderReasoning(!0),
          _cursorEl?.remove(),
          (_cursorEl = null),
          replyTextEl.classList.remove('is-streaming'),
          'error' !== _thinkingState && setThinkingState('complete'),
          (replyTextEl.innerHTML = renderMarkdown(safeMarkdown)),
          (actionsEl.style.display = 'flex'),
          attachCopyEvent(actionsEl.querySelector('.copy-msg-btn'), safeMarkdown));
        attachStarEvent(actionsEl.querySelector('.star-msg-btn'), row, null);
        const speakBtnF = actionsEl.querySelector('.speak-msg-btn');
        if (speakBtnF) speakBtnF.onclick = () => toggleSpeak(safeMarkdown, speakBtnF);
        _hasContent &&
          'true' === thinkingToggleEl?.getAttribute('aria-expanded') &&
          setThinkingOpen(!1);
        const retryBtn = actionsEl.querySelector('.retry-msg-btn');
        if (
          (retryBtn &&
            retryBtn.addEventListener('click', async () => {
              if (state.isTyping) return;
              const rows = Array.from(chatMessages.querySelectorAll('.message-row')),
                rowIdx = rows.indexOf(row);
              -1 !== rowIdx &&
                (rows.slice(rowIdx).forEach((r) => r.remove()),
                (state.messages = state.messages.slice(0, rowIdx)),
                await doSendFromStateFn());
            }),
          usage)
        ) {
          const footer = buildTokenFooter(usage, provider, modelId, Date.now() - _startTime);
          footer && row.querySelector('.content-wrapper')?.appendChild(footer);
        }
        smoothScrollToBottom();
      },
      set(markdown) {
        _streamFilter.reset();
        const safeMarkdown = stripAssistantReasoningTags(markdown) || '(empty response)';
        ((_accumulated = safeMarkdown),
          renderReasoning(!0),
          _cursorEl?.remove(),
          (_cursorEl = null),
          replyTextEl.classList.remove('is-streaming'),
          'error' !== _thinkingState && setThinkingState('complete'),
          (replyTextEl.innerHTML = renderMarkdown(safeMarkdown)),
          (actionsEl.style.display = 'flex'),
          attachCopyEvent(actionsEl.querySelector('.copy-msg-btn'), safeMarkdown));
        attachStarEvent(actionsEl.querySelector('.star-msg-btn'), row, null);
        const speakBtnS = actionsEl.querySelector('.speak-msg-btn');
        if (speakBtnS) speakBtnS.onclick = () => toggleSpeak(safeMarkdown, speakBtnS);
        smoothScrollToBottom();
      },
      setAborted() {
        const trailingVisible = _streamFilter.flushVisibleRemainder();
        if (
          (trailingVisible && (_accumulated += trailingVisible),
          (_accumulated = stripAssistantReasoningTags(_accumulated)),
          renderReasoning(!0),
          _cursorEl?.remove(),
          (_cursorEl = null),
          replyTextEl.classList.remove('is-streaming'),
          logEl.querySelectorAll('.agent-log-dot').forEach((dot) => {
            ((dot.className = 'agent-log-icon-success'),
              (dot.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'));
          }),
          'error' !== _thinkingState && setThinkingState('complete'),
          _accumulated)
        ) {
          replyTextEl.innerHTML = renderMarkdown(_accumulated);
          const badge = document.createElement('span');
          ((badge.className = 'generation-stopped-badge'),
            (badge.textContent = '⏹ stopped'),
            replyTextEl.appendChild(badge));
        } else
          replyTextEl.innerHTML =
            '<span class="generation-stopped-inline">Generation stopped.</span>';
        ((actionsEl.style.display = 'flex'),
          _accumulated && attachCopyEvent(actionsEl.querySelector('.copy-msg-btn'), _accumulated));
        attachStarEvent(actionsEl.querySelector('.star-msg-btn'), row, null);
        if (_accumulated) {
          const speakBtnA = actionsEl.querySelector('.speak-msg-btn');
          if (speakBtnA) speakBtnA.onclick = () => toggleSpeak(_accumulated, speakBtnA);
        }
        smoothScrollToBottom();
      },
      getAttachments() {
        const subAgentAttachments = _subAgentTracker.getAttachments();
        return [..._replyAttachments, ...subAgentAttachments].map((attachment) =>
          'subagent_run' === attachment.type
            ? cloneSubAgentRunAttachment(attachment)
            : 'photo_gallery' === attachment.type
              ? clonePhotoGalleryAttachment(attachment)
              : { ...attachment },
        );
      },
    }
  );
}
export async function onChatMessagesClick(e) {
  const copyCodeBtn = e.target.closest('.copy-code-btn');
  if (copyCodeBtn) {
    const wrapper = copyCodeBtn.closest('.code-wrapper'),
      codeEl = wrapper?.querySelector('code');
    if (!codeEl) return;
    try {
      await navigator.clipboard.writeText(codeEl.textContent);
      const orig = copyCodeBtn.innerHTML;
      ((copyCodeBtn.innerHTML = `${checkIcon()} Copied`),
        (copyCodeBtn.style.color = 'var(--accent)'),
        setTimeout(() => {
          ((copyCodeBtn.innerHTML = orig), (copyCodeBtn.style.color = ''));
        }, 2e3));
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }
  const previewCodeBtn = e.target.closest('.preview-code-btn');
  if (previewCodeBtn) {
    const wrapper = previewCodeBtn.closest('.code-wrapper'),
      codeEl = wrapper?.querySelector('code');
    if (!codeEl) return;
    return void openHtmlPreviewModal(codeEl.textContent);
  }
  const dlCodeBtn = e.target.closest('.download-code-btn');
  if (dlCodeBtn) {
    const wrapper = dlCodeBtn.closest('.code-wrapper'),
      codeEl = wrapper?.querySelector('code');
    if (!codeEl) return;
    const lang = dlCodeBtn.dataset.lang || 'txt',
      ext =
        {
          javascript: 'js',
          js: 'js',
          typescript: 'ts',
          ts: 'ts',
          python: 'py',
          py: 'py',
          html: 'html',
          css: 'css',
          json: 'json',
          bash: 'sh',
          shell: 'sh',
          sh: 'sh',
          sql: 'sql',
          java: 'java',
          kotlin: 'kt',
          swift: 'swift',
          rust: 'rs',
          go: 'go',
          cpp: 'cpp',
          c: 'c',
          php: 'php',
          ruby: 'rb',
          yaml: 'yaml',
          yml: 'yml',
          xml: 'xml',
          markdown: 'md',
          md: 'md',
          jsx: 'jsx',
          tsx: 'tsx',
          vue: 'vue',
          scss: 'scss',
          sass: 'sass',
          less: 'less',
        }[lang.toLowerCase()] ||
        lang ||
        'txt';
    try {
      const blob = new Blob([codeEl.textContent], { type: 'text/plain' }),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
      ((a.href = url),
        (a.download = `code.${ext}`),
        document.body.appendChild(a),
        a.click(),
        document.body.removeChild(a),
        URL.revokeObjectURL(url));
      const orig = dlCodeBtn.innerHTML;
      ((dlCodeBtn.innerHTML = `${checkIcon()} Saved`),
        (dlCodeBtn.style.color = 'var(--accent)'),
        setTimeout(() => {
          ((dlCodeBtn.innerHTML = orig), (dlCodeBtn.style.color = ''));
        }, 2e3));
    } catch (err) {
      console.error('Failed to download code:', err);
    }
  }
}
const INTERNAL_ASSISTANT_TOOL_PATTERNS = [
  /^\s*I\s+(?:used|called|ran|invoked)\s+(?:the\s+)?[A-Za-z0-9_.\-\s/]+\s+tool\b[\s.,;:!?\u2026]*$/i,
  /^\s*Tool result for\b/i,
  /^\s*Internal execution context for the assistant only\b/i,
];
function stripAssistantReasoningTags(text) {
  const value = String(text ?? '');
  return value
    ? value
        .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, ' ')
        .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, ' ')
        .replace(/<analysis\b[^>]*>[\s\S]*?<\/analysis>/gi, ' ')
        .replace(/<\/?(?:think|thinking|analysis)\b[^>]*>/gi, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : '';
}
export function normalizeMessage(msg) {
  const role = msg?.role ?? 'user';
  return {
    role: role,
    content:
      'assistant' === role
        ? stripAssistantReasoningTags(msg?.content ?? '')
        : String(msg?.content ?? ''),
    attachments: Array.isArray(msg?.attachments)
      ? msg.attachments.filter(isSupportedAttachment)
      : [],
    ...(msg?.starred ? { starred: true } : {}),
  };
}

// ── Star / highlight helper ────────────────────────────────────────────────
import { saveCurrentChat } from '../Data/ChatPersistence.js';

function applyStarToRows(assistantRow, isStarred) {
  assistantRow.classList.toggle('is-starred', isStarred);
}

export function attachStarEvent(starBtn, assistantRow, msgRef) {
  if (!starBtn) return;
  // Resolve message ref from state at click time if not directly provided
  starBtn.onclick = () => {
    const rows = Array.from(chatMessages.querySelectorAll('.message-row'));
    const rowIdx = rows.indexOf(assistantRow);
    // Find the corresponding state message (assistant messages only)
    const assistantRows = rows.filter((r) => r.classList.contains('assistant'));
    const assistantIdx = assistantRows.indexOf(assistantRow);
    // Map to state index — count assistant messages in state
    let stateMsg = null;
    if (assistantIdx >= 0) {
      let found = 0;
      for (const m of state.messages) {
        if (m.role === 'assistant') {
          if (found === assistantIdx) {
            stateMsg = m;
            break;
          }
          found++;
        }
      }
    }
    const nowStarred = !assistantRow.classList.contains('is-starred');
    if (stateMsg) stateMsg.starred = nowStarred ? true : undefined;

    applyStarToRows(assistantRow, nowStarred);
    starBtn.innerHTML = starIcon(nowStarred);
    starBtn.classList.toggle('star-msg-btn--active', nowStarred);
    starBtn.title = nowStarred ? 'Unstar this exchange' : 'Star this exchange';
    saveCurrentChat().catch(() => {});
  };
}
function isInternalAssistantToolLeak(text) {
  const value = String(text ?? '').trim();
  return !!value && INTERNAL_ASSISTANT_TOOL_PATTERNS.some((pattern) => pattern.test(value));
}
export function isInternalHiddenMessage(msg) {
  return (
    !!msg &&
    ('assistant' === msg.role
      ? isInternalAssistantToolLeak(msg.content)
      : 'user' === msg.role &&
        /^\s*(?:Tool result for|Internal execution context for the assistant only)\b/i.test(
          String(msg.content ?? ''),
        ))
  );
}
export function sanitizeAssistantReply(text) {
  const value = stripAssistantReasoningTags(text);
  if (!value) return '(empty response)';
  if (!isInternalAssistantToolLeak(value)) return value;
  const recovered = (function (text) {
    return String(text ?? '')
      .replace(/\[TERMINAL:[^\]]+\]/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  })(value);
  return recovered.length >= 32 && !isInternalAssistantToolLeak(recovered)
    ? recovered
    : 'I ran into an internal formatting issue while preparing the answer. Please try again.';
}
export function sanitizeMessagesForUI(messages = []) {
  return messages.map(normalizeMessage).filter((message) => !isInternalHiddenMessage(message));
}
export function appendMessage(
  role,
  content,
  addToState = !0,
  scroll = !0,
  attachments = [],
  doSendFromStateFn = () => {},
  starred = false,
) {
  const msg = normalizeMessage({
    role: role,
    content: content,
    attachments: attachments,
    ...(starred ? { starred: true } : {}),
  });
  if (isInternalHiddenMessage(msg)) return null;
  addToState && state.messages.push(msg);
  const row = document.createElement('div');
  if (((row.className = `message-row ${msg.role}`), 'user' === msg.role)) {
    const actions = document.createElement('div');
    actions.className = 'message-actions user-actions';
    const copyBtn = document.createElement('button');
    ((copyBtn.className = 'action-btn copy-msg-btn'),
      (copyBtn.title = 'Copy Message'),
      (copyBtn.innerHTML = copyIcon()),
      attachCopyEvent(copyBtn, msg.content));
    const editBtn = document.createElement('button');
    ((editBtn.className = 'action-btn edit-msg-btn'),
      (editBtn.title = 'Edit Message'),
      (editBtn.innerHTML = editIcon()));
    const retryBtn = document.createElement('button');
    ((retryBtn.className = 'action-btn retry-msg-btn'),
      (retryBtn.title = 'Retry'),
      (retryBtn.innerHTML = retryIcon()),
      actions.append(copyBtn, editBtn, retryBtn),
      row.appendChild(actions));
    const bubble = document.createElement('div');
    if (((bubble.className = 'bubble'), msg.attachments.length > 0)) {
      bubble.classList.add('has-attachments');
      const gallery = document.createElement('div');
      ((gallery.className = 'bubble-attachments'),
        msg.attachments.forEach((a) => {
          'image' === a.type
            ? gallery.appendChild(buildImageFrame(a, 'bubble-attachment'))
            : 'file' === a.type && gallery.appendChild(buildFileFrame(a, 'bubble-attachment'));
        }),
        bubble.appendChild(gallery));
    }
    let textEl = null;
    (msg.content &&
      ((textEl = document.createElement('div')),
      (textEl.className = 'bubble-text'),
      appendTextWithLineBreaks(textEl, msg.content),
      bubble.appendChild(textEl)),
      row.appendChild(bubble),
      editBtn.addEventListener('click', () => {
        if (state.isTyping) return;
        (row.classList.add('is-editing'),
          (actions.style.opacity = '0'),
          (actions.style.pointerEvents = 'none'));
        const originalContent = msg.content,
          editArea = document.createElement('textarea');
        ((editArea.className = 'bubble-edit-textarea'),
          (editArea.value = originalContent),
          textEl ? textEl.replaceWith(editArea) : bubble.appendChild(editArea),
          (editArea.style.height = `${Math.max(editArea.scrollHeight, 60)}px`),
          editArea.focus(),
          editArea.setSelectionRange(editArea.value.length, editArea.value.length),
          editArea.addEventListener('input', () => {
            ((editArea.style.height = 'auto'),
              (editArea.style.height = `${editArea.scrollHeight}px`));
          }));
        const warning = document.createElement('div');
        ((warning.className = 'bubble-edit-warning'),
          (warning.innerHTML =
            '\n        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>\n        </svg>\n        Editing will remove all messages after this point\n      '),
          bubble.appendChild(warning));
        const editActions = document.createElement('div');
        ((editActions.className = 'bubble-edit-actions'),
          (editActions.innerHTML =
            '\n        <button class="bubble-edit-cancel">Cancel</button>\n        <button class="bubble-edit-save">Save &amp; Send</button>\n      '),
          bubble.appendChild(editActions));
        const cancelBtn = editActions.querySelector('.bubble-edit-cancel'),
          saveBtn = editActions.querySelector('.bubble-edit-save');
        (cancelBtn.addEventListener('click', () => {
          ((bubble.style.transition =
            'max-width 0.22s var(--ease-out-expo), width 0.22s var(--ease-out-expo), opacity 0.15s ease'),
            (bubble.style.opacity = '0.6'),
            setTimeout(() => {
              ((bubble.style.opacity = ''),
                (bubble.style.transition = ''),
                textEl ? editArea.replaceWith(textEl) : editArea.remove(),
                warning.remove(),
                editActions.remove(),
                row.classList.remove('is-editing'),
                (actions.style.opacity = ''),
                (actions.style.pointerEvents = ''));
            }, 180));
        }),
          saveBtn.addEventListener('click', async () => {
            const newText = editArea.value.trim();
            if (!newText || state.isTyping) return;
            const rows = Array.from(chatMessages.querySelectorAll('.message-row')),
              rowIdx = rows.indexOf(row);
            -1 !== rowIdx &&
              ((msg.content = newText),
              state.messages[rowIdx] &&
                (state.messages[rowIdx] = { ...state.messages[rowIdx], content: newText }),
              rows.slice(rowIdx + 1).forEach((r) => r.remove()),
              (state.messages = state.messages.slice(0, rowIdx + 1)),
              (textEl = document.createElement('div')),
              (textEl.className = 'bubble-text'),
              appendTextWithLineBreaks(textEl, newText),
              editArea.replaceWith(textEl),
              warning.remove(),
              editActions.remove(),
              row.classList.remove('is-editing'),
              attachCopyEvent(copyBtn, newText),
              (actions.style.opacity = ''),
              (actions.style.pointerEvents = ''),
              updateTimeline(),
              await doSendFromStateFn());
          }));
      }),
      retryBtn.addEventListener('click', async () => {
        if (state.isTyping) return;
        const rows = Array.from(chatMessages.querySelectorAll('.message-row')),
          rowIdx = rows.indexOf(row);
        -1 !== rowIdx &&
          (rows.slice(rowIdx + 1).forEach((r) => r.remove()),
          (state.messages = state.messages.slice(0, rowIdx + 1)),
          updateTimeline(),
          await doSendFromStateFn());
      }));
  } else {
    row.innerHTML = `\n      ${assistantIcon()}\n      <div class="content-wrapper">\n        <div class="content"></div>\n        <div class="message-actions assistant-actions">\n          <button class="action-btn copy-msg-btn" title="Copy Message">${copyIcon()}</button>\n          <button class="action-btn speak-msg-btn" title="Speak">${speakIcon()}</button>\n          <button class="action-btn retry-msg-btn" title="Retry">${retryIcon()}</button>\n          <button class="action-btn star-msg-btn${msg.starred ? ' star-msg-btn--active' : ''}" title="${msg.starred ? 'Unstar this exchange' : 'Star this exchange'}">${starIcon(!!msg.starred)}</button>\n        </div>\n      </div>`;
    if (msg.starred) {
      row.classList.add('is-starred');
      // We'll highlight the preceding user row after the row is appended
    }
    const contentEl = row.querySelector('.content');
    if (msg.attachments.length > 0) {
      const richMediaEl = document.createElement('div');
      ((richMediaEl.className = 'agent-reply-media'),
        msg.attachments.forEach((attachment) => {
          'subagent_run' === attachment.type
            ? richMediaEl.appendChild(createSubAgentRunElement(attachment))
            : 'photo_gallery' === attachment.type
              ? richMediaEl.appendChild(createPhotoGalleryElement(attachment))
              : 'image' === attachment.type
                ? richMediaEl.appendChild(buildImageFrame(attachment, 'bubble-attachment'))
                : 'file' === attachment.type &&
                  richMediaEl.appendChild(buildFileFrame(attachment, 'bubble-attachment'));
        }),
        richMediaEl.childElementCount > 0 && contentEl.appendChild(richMediaEl));
    }
    const textEl = document.createElement('div');
    textEl.className = 'assistant-text-content';
    textEl.innerHTML = renderMarkdown(msg.content);
    contentEl.appendChild(textEl);
    attachCopyEvent(row.querySelector('.copy-msg-btn'), msg.content);
    const speakBtnH = row.querySelector('.speak-msg-btn');
    if (speakBtnH) speakBtnH.onclick = () => toggleSpeak(msg.content, speakBtnH);
    attachStarEvent(row.querySelector('.star-msg-btn'), row, msg);
    row.querySelector('.retry-msg-btn')?.addEventListener('click', async () => {
      if (state.isTyping) return;
      const rows = Array.from(chatMessages.querySelectorAll('.message-row')),
        rowIdx = rows.indexOf(row);
      -1 !== rowIdx &&
        (rows.slice(rowIdx).forEach((r) => r.remove()),
        (state.messages = state.messages.slice(0, rowIdx)),
        updateTimeline(),
        await doSendFromStateFn());
    });
  }
  chatMessages.appendChild(row);
  scroll && smoothScrollToBottom();
  'user' === msg.role && setTimeout(updateTimeline, 60);
  return row;
}
