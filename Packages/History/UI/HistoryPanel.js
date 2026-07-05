import { createElement, formatText, setupDismissListeners } from '../../Shared/Utils/DomUtils.js';
import { collapseWhitespace } from '../../Shared/Utils/StringUtils.js';
import { invokeIpc } from '../../Shared/Ipc/RendererIpc.js';
import { createSearchBar } from '../../Shared/SearchBar/SearchBar.js';
import { createIcon } from '../../Shared/Icons/Icons.js';
import { createPanelHeader } from '../../Shared/PanelHeader/PanelHeader.js';
import { attachCustomScrollbar } from '../../Shared/CustomScrollbar/CustomScrollbar.js';
import { formatRelativeSessionTime, getRelativeDayGroup } from '../../Shared/Utils/DateUtils.js';

// ---------------------------------------------------------------------------
// Export format helpers
// ---------------------------------------------------------------------------

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatAsJson(session) {
  return JSON.stringify(session, null, 2);
}

function formatAsXml(session) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<chat>'];
  lines.push(`  <title>${escapeXml(session.title || '')}</title>`);
  lines.push(`  <id>${escapeXml(session.id || '')}</id>`);
  lines.push(`  <createdAt>${escapeXml(session.createdAt || '')}</createdAt>`);
  lines.push(`  <updatedAt>${escapeXml(session.updatedAt || '')}</updatedAt>`);
  lines.push('  <messages>');
  for (const msg of session.messages || []) {
    lines.push('    <message>');
    lines.push(`      <role>${escapeXml(msg.role || '')}</role>`);
    lines.push(`      <content>${escapeXml(msg.content || '')}</content>`);
    if (msg.thinking) lines.push(`      <thinking>${escapeXml(msg.thinking)}</thinking>`);
    if (msg.modelLabel) lines.push(`      <model>${escapeXml(msg.modelLabel)}</model>`);
    if (msg.providerLabel) lines.push(`      <provider>${escapeXml(msg.providerLabel)}</provider>`);
    lines.push('    </message>');
  }
  lines.push('  </messages>');
  lines.push('</chat>');
  return lines.join('\n');
}

function formatAsMarkdown(session) {
  const lines = [`# ${session.title || 'Chat'}`, ''];
  lines.push(`*Exported from Joanium — ${session.updatedAt || ''}*`, '');
  for (const msg of session.messages || []) {
    const role = msg.role === 'user' ? '**You**' : `**${msg.modelLabel || 'Assistant'}**`;
    lines.push(`### ${role}`, '', msg.content || '', '');
    if (msg.thinking) {
      lines.push('<details><summary>Thinking</summary>', '', msg.thinking, '', '</details>', '');
    }
  }
  return lines.join('\n');
}

function formatAsPlainText(session) {
  const lines = [session.title || 'Chat', '='.repeat((session.title || 'Chat').length), ''];
  for (const msg of session.messages || []) {
    const role = msg.role === 'user' ? 'You' : msg.modelLabel || 'Assistant';
    lines.push(`[${role}]`, msg.content || '', '');
  }
  return lines.join('\n');
}

function formatAsHtml(session) {
  const lines = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    `  <title>${escapeHtml(session.title || 'Chat')}</title>`,
    '  <style>',
    '    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }',
    '    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }',
    '    .meta { color: #888; font-size: 0.85rem; margin-bottom: 2rem; }',
    '    .msg { margin-bottom: 1.25rem; }',
    '    .msg-user { background: #f0f0f0; border-radius: 8px; padding: 0.75rem 1rem; }',
    '    .msg-assistant { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 0.75rem 1rem; }',
    '    .role { font-weight: 600; font-size: 0.8rem; text-transform: uppercase; color: #666; margin-bottom: 0.25rem; }',
    '    .content { white-space: pre-wrap; line-height: 1.5; }',
    '    details { margin-top: 0.5rem; font-size: 0.9rem; color: #555; }',
    '  </style>',
    '</head>',
    '<body>',
    `  <h1>${escapeHtml(session.title || 'Chat')}</h1>`,
    `  <div class="meta">Exported from Joanium — ${escapeHtml(session.updatedAt || '')}</div>`,
  ];
  for (const msg of session.messages || []) {
    const roleLabel = msg.role === 'user' ? 'You' : msg.modelLabel || 'Assistant';
    const cls = msg.role === 'user' ? 'msg-user' : 'msg-assistant';
    lines.push(`  <div class="msg ${cls}">`);
    lines.push(`    <div class="role">${escapeHtml(roleLabel)}</div>`);
    lines.push(`    <div class="content">${escapeHtml(msg.content || '')}</div>`);
    if (msg.thinking) {
      lines.push('    <details><summary>Thinking</summary>');
      lines.push(`      <div class="content">${escapeHtml(msg.thinking)}</div>`);
      lines.push('    </details>');
    }
    lines.push('  </div>');
  }
  lines.push('</body>', '</html>');
  return lines.join('\n');
}

const EXPORT_FORMATS = [
  {
    key: 'json',
    labelKey: 'exportJson',
    icon: 'fileJson',
    ext: '.json',
    mime: 'application/json',
    format: formatAsJson,
  },
  {
    key: 'xml',
    labelKey: 'exportXml',
    icon: 'fileXml',
    ext: '.xml',
    mime: 'application/xml',
    format: formatAsXml,
  },
  {
    key: 'markdown',
    labelKey: 'exportMarkdown',
    icon: 'fileMd',
    ext: '.md',
    mime: 'text/markdown',
    format: formatAsMarkdown,
  },
  {
    key: 'plaintext',
    labelKey: 'exportPlainText',
    icon: 'fileText',
    ext: '.txt',
    mime: 'text/plain',
    format: formatAsPlainText,
  },
  {
    key: 'html',
    labelKey: 'exportHtml',
    icon: 'fileHtml',
    ext: '.html',
    mime: 'text/html',
    format: formatAsHtml,
  },
];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function getSessionGroup(isoString) {
  return getRelativeDayGroup(isoString);
}

function formatSessionTime(isoString) {
  return formatRelativeSessionTime(isoString);
}

// ---------------------------------------------------------------------------
// createHistoryPanel
//
// Factory that builds and manages the History sidebar panel.
//
// Parameters:
//   strings  — the `history` i18n namespace (strings.history from caller)
//   options  — {
//     onNewChat()              — callback: start a fresh conversation
//     onLoadSession(id)        — callback: restore a saved session into chat
//     onForkSession(id)        — callback: open a freshly-forked session in chat
//     getCurrentSessionId()    — getter: returns the active session ID (or null)
//     getActiveProject()       — getter: returns the active project (or null)
//   }
//
// Returns:
//   build()        — builds and returns the panel HTMLElement (call once)
//   populateList() — re-fetches and re-renders session cards into the panel
// ---------------------------------------------------------------------------

export function createHistoryPanel(
  strings,
  { onNewChat, onLoadSession, onForkSession, getCurrentSessionId, getActiveProject } = {},
) {
  // ── Export popup (singleton) ────────────────────────────────────────────

  const exportPopup = createElement('div', 'chat-history__export-popup');
  document.body.append(exportPopup);
  let exportDisposeListeners = null;

  function closeExportPopup() {
    exportPopup.classList.remove('chat-history__export-popup--open');
    exportDisposeListeners?.();
    exportDisposeListeners = null;
  }

  function openExportPopup(session, triggerEl) {
    exportPopup.replaceChildren();

    const header = createElement('div', 'chat-history__export-popup__header');
    header.append(createIcon('share', 'chat-history__export-popup__header-icon'));
    header.append(createElement('span', 'chat-history__export-popup__title', strings.share));
    exportPopup.append(header);

    const formatList = createElement('div', 'chat-history__export-popup__formats');

    for (const fmt of EXPORT_FORMATS) {
      const btn = createElement('button', 'chat-history__export-popup__format-btn');
      btn.type = 'button';
      btn.append(createIcon(fmt.icon, 'chat-history__export-popup__format-icon'));
      btn.append(
        createElement('span', 'chat-history__export-popup__format-label', strings[fmt.labelKey]),
      );
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportSession(session, fmt);
        closeExportPopup();
      });
      formatList.append(btn);
    }

    exportPopup.append(formatList);

    // Position relative to trigger
    const rect = triggerEl.getBoundingClientRect();
    const margin = 8;
    exportPopup.style.cssText =
      'transition:none; opacity:0; visibility:hidden; left:-9999px; top:-9999px;';
    exportPopup.classList.remove('chat-history__export-popup--open');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const popupW = exportPopup.offsetWidth || 180;
        const popupH = exportPopup.offsetHeight || 200;
        let left = rect.right + margin;
        if (left + popupW > window.innerWidth - margin) {
          left = rect.left - popupW - margin;
        }
        left = Math.max(margin, left);
        let top = rect.top;
        top = Math.max(margin, Math.min(top, window.innerHeight - popupH - margin));

        exportPopup.style.cssText = `left:${left}px; top:${top}px;`;
        exportPopup.classList.add('chat-history__export-popup--open');
      });
    });

    // Dismiss listeners
    disposeExportListeners();
    const onDocClick = (e) => {
      if (!exportPopup.contains(e.target) && !triggerEl.contains(e.target)) {
        closeExportPopup();
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') closeExportPopup();
    };
    exportDisposeListeners = setupDismissListeners(onDocClick, onKey);
  }

  function disposeExportListeners() {
    exportDisposeListeners?.();
    exportDisposeListeners = null;
  }

  // ── Export session to file ─────────────────────────────────────────────

  function triggerDownload(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportSession(session, fmt) {
    try {
      const fullSession = await invokeIpc(
        'history:load-session',
        session.id,
        getActiveProject?.()?.id,
      );
      if (!fullSession) return;
      const content = fmt.format(fullSession);
      const safeTitle = (fullSession.title || 'chat')
        .replace(/[^a-zA-Z0-9-_ ]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      triggerDownload(content, `${safeTitle}${fmt.ext}`, fmt.mime);
    } catch (err) {
      console.error('[Joanium] Failed to export session:', err);
    }
  }

  // ── Session card — inline rename helper ────────────────────────────────

  function startInlineRename(session, titleEl, contentEl, query) {
    const input = document.createElement('input');
    input.className = 'chat-history__card-title-input';
    input.type = 'text';
    input.value = session.title || '';
    input.style.userSelect = 'text';
    input.style.cursor = 'text';

    let committed = false;

    const finish = async (save) => {
      if (committed) return;
      committed = true;
      input.removeEventListener('blur', blurHandler);
      const newTitle = input.value.trim();
      if (save && newTitle && newTitle !== session.title) {
        try {
          await invokeIpc('history:rename-session', session.id, newTitle, getActiveProject?.()?.id);
        } catch (err) {
          console.error('[Joanium] Failed to rename session:', err);
        }
      }
      await populateList(contentEl, query);
    };

    const blurHandler = () => void finish(true);
    input.addEventListener('blur', blurHandler);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // Prevent keys from reaching the parent <button>
      if (e.key === 'Enter') {
        e.preventDefault();
        void finish(true);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        void finish(false);
      }
    });
    // The input lives inside a <button>. Browsers fire a native click on
    // <button> elements when space‑keyup occurs, which would navigate into
    // the chat. Block that by stopping propagation of keyup and click.
    input.addEventListener('keyup', (e) => e.stopPropagation());
    input.addEventListener('click', (e) => e.stopPropagation());

    titleEl.replaceWith(input);
    input.focus();
    input.select();
  }

  // ── Session card builder ───────────────────────────────────────────────

  function buildSessionCard(session, contentEl, query) {
    const card = createElement('div', 'chat-history__card');

    // Body — main click target
    const body = createElement('div', 'chat-history__card-body');
    body.setAttribute('role', 'button');
    body.setAttribute('tabindex', '0');
    body.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void onLoadSession?.(session.id);
      } else if (e.key === ' ') {
        if (e.target.closest('.chat-history__card-title-input')) return;
        e.preventDefault();
        void onLoadSession?.(session.id);
      }
    });

    const msgCount = session.messageCount ?? 0;
    const msgLabel =
      msgCount === 1 ? strings.oneMessage : formatText(strings.messages, { count: msgCount });

    const titleEl = createElement(
      'div',
      'chat-history__card-title',
      session.title || strings.appName,
    );

    // Meta line: message count · time · optional forked-from pill
    const metaEl = createElement('div', 'chat-history__card-meta');
    const metaText = document.createTextNode(
      `${msgLabel} · ${formatSessionTime(session.updatedAt)}`,
    );
    metaEl.append(metaText);

    if (session.forkedFromId) {
      const forkedBadge = createElement('span', 'chat-history__card-forked-badge');
      forkedBadge.append(createIcon('gitBranch', 'chat-history__card-forked-icon'));
      const forkedLabel = document.createElement('span');
      forkedLabel.textContent = session.forkedFromTitle
        ? `${strings.forkedFrom} "${session.forkedFromTitle}"`
        : strings.forkedFrom;
      forkedBadge.append(forkedLabel);

      // Clicking the badge navigates to the original session
      if (session.forkedFromId) {
        forkedBadge.setAttribute('role', 'button');
        forkedBadge.setAttribute('tabindex', '0');
        forkedBadge.setAttribute(
          'aria-label',
          `${strings.forkedFrom}: ${session.forkedFromTitle || session.forkedFromId}`,
        );
        const openOriginal = async (e) => {
          e.stopPropagation();
          // Guard: source may have been deleted since the last list refresh.
          // Try loading it; if it fails, strip the badge and repaint.
          try {
            await invokeIpc('history:load-session', session.forkedFromId, getActiveProject?.()?.id);
            void onLoadSession?.(session.forkedFromId);
          } catch {
            // Source is gone — refresh the list so the badge disappears.
            await populateList(contentEl, query);
          }
        };
        forkedBadge.addEventListener('click', openOriginal);
        forkedBadge.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openOriginal(e);
          }
        });
      }

      metaEl.append(forkedBadge);
    }

    body.append(titleEl, metaEl);
    body.addEventListener('click', (e) => {
      // Don't navigate if the user is interacting with the rename input
      if (e.target.closest('.chat-history__card-title-input')) return;
      void onLoadSession?.(session.id);
    });

    // Actions — visible on hover
    const actions = createElement('div', 'chat-history__card-actions');

    // Pin / Unpin
    const pinBtn = createElement(
      'button',
      `chat-history__card-btn${session.pinned ? ' chat-history__card-btn--pinned' : ''}`,
    );
    pinBtn.type = 'button';
    pinBtn.setAttribute('aria-label', session.pinned ? strings.unpin : strings.pin);
    pinBtn.append(createIcon(session.pinned ? 'pinFill' : 'pin', 'chat-history__card-btn-icon'));
    pinBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await invokeIpc(
          'history:pin-session',
          session.id,
          !session.pinned,
          getActiveProject?.()?.id,
        );
      } catch (err) {
        console.error('[Joanium] Failed to pin session:', err);
      }
      await populateList(contentEl, query);
    });

    // Fork
    const forkBtn = createElement('button', 'chat-history__card-btn');
    forkBtn.type = 'button';
    forkBtn.setAttribute('aria-label', strings.fork);
    forkBtn.append(createIcon('gitBranch', 'chat-history__card-btn-icon'));
    forkBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        // Fork at the end of the conversation (all messages included)
        const forked = await invokeIpc(
          'history:fork-session',
          session.id,
          null, // upToMessageIndex = null means full conversation
          getActiveProject?.()?.id,
        );
        if (forked?.id) {
          // Open the new fork immediately
          await (onForkSession ?? onLoadSession)?.(forked.id);
        }
      } catch (err) {
        console.error('[Joanium] Failed to fork session:', err);
      }
      await populateList(contentEl, query);
    });

    // Rename
    const renameBtn = createElement('button', 'chat-history__card-btn');
    renameBtn.type = 'button';
    renameBtn.setAttribute('aria-label', strings.rename);
    renameBtn.append(createIcon('pencil', 'chat-history__card-btn-icon'));
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startInlineRename(session, titleEl, contentEl, query);
    });

    // Export
    const exportBtn = createElement('button', 'chat-history__card-btn');
    exportBtn.type = 'button';
    exportBtn.setAttribute('aria-label', strings.share);
    exportBtn.append(createIcon('share', 'chat-history__card-btn-icon'));
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openExportPopup(session, exportBtn);
    });

    // Delete
    const deleteBtn = createElement(
      'button',
      'chat-history__card-btn chat-history__card-btn--danger',
    );
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', strings.deleteChat);
    deleteBtn.append(createIcon('trash', 'chat-history__card-btn-icon'));
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await invokeIpc('history:delete-session', session.id, getActiveProject?.()?.id);
        // If the deleted session is currently open, clear the conversation
        if (session.id === getCurrentSessionId?.()) {
          onNewChat?.();
        }
      } catch (err) {
        console.error('[Joanium] Failed to delete session:', err);
      }
      await populateList(contentEl, query);
    });

    actions.append(pinBtn, forkBtn, renameBtn, exportBtn, deleteBtn);
    card.append(body, actions);
    return card;
  }

  // ── populateList — fetches sessions and renders them into contentEl ────

  async function populateList(contentEl, query = '') {
    // Show loading skeletons while fetching
    contentEl.replaceChildren();
    for (let i = 0; i < 3; i++) {
      contentEl.append(createElement('div', 'chat-history__skeleton'));
    }

    const allSessions = await invokeIpc('history:list-sessions', getActiveProject?.()?.id);

    // Filter by query — title match, case-insensitive
    const q = collapseWhitespace(query).toLowerCase();
    const sessions = q
      ? allSessions.filter((s) =>
          collapseWhitespace(s.title ?? '')
            .toLowerCase()
            .includes(q),
        )
      : allSessions;

    contentEl.replaceChildren();

    if (allSessions.length === 0) {
      const empty = createElement('div', 'chat-history__empty');
      empty.append(
        createElement('p', 'chat-history__empty-title', strings.empty),
        createElement('p', 'chat-history__empty-hint', strings.emptyHint),
      );
      contentEl.append(empty);
      return;
    }

    if (sessions.length === 0) {
      const empty = createElement('div', 'chat-history__empty');
      empty.append(
        createElement('p', 'chat-history__empty-title', strings.noResults),
        createElement('p', 'chat-history__empty-hint', strings.noResultsHint),
      );
      contentEl.append(empty);
      return;
    }

    // Pinned sessions go first; non-pinned are grouped by date
    const groups = { pinned: [], today: [], yesterday: [], earlier: [] };
    for (const session of sessions) {
      if (session.pinned) {
        groups.pinned.push(session);
      } else {
        groups[getSessionGroup(session.updatedAt)].push(session);
      }
    }

    const groupLabels = {
      pinned: strings.pinned,
      today: strings.today,
      yesterday: strings.yesterday,
      earlier: strings.earlier,
    };

    for (const [groupKey, groupSessions] of Object.entries(groups)) {
      if (groupSessions.length === 0) continue;

      const section = createElement('div', 'chat-history__section');
      section.append(createElement('div', 'chat-history__section-label', groupLabels[groupKey]));

      for (const session of groupSessions) {
        section.append(buildSessionCard(session, contentEl, query));
      }

      contentEl.append(section);
    }
  }

  // ── build — constructs the panel DOM (called once) ─────────────────────

  function build() {
    const panel = createElement('div', 'chat-history');
    panel.hidden = true;

    // Header row
    const header = createPanelHeader({ title: strings.title, subtitle: strings.subtitle });

    // Search bar + New Chat button row
    const searchWrap = createElement('div', 'chat-history__search-wrap');
    const searchInner = createElement('div', 'chat-history__search-inner');

    const newBtn = createElement('button', 'chat-history__new-btn');
    newBtn.type = 'button';
    newBtn.setAttribute('aria-label', strings.newChat);
    newBtn.append(createIcon('tabChat', 'chat-history__new-icon'));
    newBtn.addEventListener('click', () => onNewChat?.());

    // Delete All button — two-step confirmation
    const deleteAllBtn = createElement('button', 'chat-history__delete-all-btn');
    deleteAllBtn.type = 'button';
    deleteAllBtn.setAttribute('aria-label', strings.deleteAll);
    deleteAllBtn.append(createIcon('trash', 'chat-history__delete-all-icon'));

    let deleteAllConfirmTimeout = null;
    let deleteAllPending = false;

    const resetDeleteAllBtn = () => {
      deleteAllPending = false;
      clearTimeout(deleteAllConfirmTimeout);
      deleteAllBtn.classList.remove('chat-history__delete-all-btn--confirm');
      deleteAllBtn.setAttribute('aria-label', strings.deleteAll);
    };

    deleteAllBtn.addEventListener('click', async () => {
      if (!deleteAllPending) {
        // First click — enter confirm state
        deleteAllPending = true;
        deleteAllBtn.classList.add('chat-history__delete-all-btn--confirm');
        deleteAllBtn.setAttribute('aria-label', strings.deleteAllConfirm);
        deleteAllConfirmTimeout = setTimeout(resetDeleteAllBtn, 2500);
        return;
      }

      // Second click — execute
      resetDeleteAllBtn();
      try {
        await invokeIpc('history:delete-all-sessions', getActiveProject?.()?.id);
        onNewChat?.();
      } catch (err) {
        console.error('[Joanium] Failed to delete all sessions:', err);
      }
      await populateList(contentEl);
    });

    const search = createSearchBar({
      placeholder: strings.search,
      onChange: (value) => void populateList(contentEl, value.trim()),
    });

    searchInner.append(search.element, newBtn, deleteAllBtn);
    searchWrap.append(searchInner);

    // Session list
    const contentEl = createElement('div', 'chat-history__content');
    const contentWrap = createElement('div', 'chat-history__content-wrap');
    Object.assign(contentWrap.style, {
      flex: 1,
      minHeight: 0,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
    });
    contentWrap.append(contentEl);
    attachCustomScrollbar(contentWrap, contentEl, { right: 4, top: 4, bottom: 4, minThumb: 24 });

    panel.append(header, searchWrap, contentWrap);

    // Expose internal refs used by the caller (ChatApp) for refresh + search clear
    panel._contentEl = contentEl;
    panel._search = search;

    return panel;
  }

  return { build, populateList };
}
