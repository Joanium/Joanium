// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Shared/LibraryModal.js
//
//  Self-contained Library (chat history) modal.
//  Injects its own HTML, wires all events, handles
//  search + delete, and exports open / close / isOpen.
//
//  Usage (any page):
//    import { initLibraryModal } from '../Shared/LibraryModal.js';
//
//    const library = initLibraryModal({
//      onChatSelect: (chatId) => loadChat(chatId),
//    });
//    // then: library.open() / library.close() / library.isOpen()
// ─────────────────────────────────────────────

/* ══════════════════════════════════════════
   HTML TEMPLATE
══════════════════════════════════════════ */
function buildHTML() {
  return /* html */`
    <div id="library-modal-backdrop">
      <div id="library-panel" role="dialog" aria-modal="true"
           aria-labelledby="library-modal-title">

        <div class="settings-modal-header">
          <div class="settings-modal-copy">
            <h2 id="library-modal-title">Revisit your chats</h2>
          </div>
          <button class="settings-modal-close" id="library-close"
                  type="button" aria-label="Close library">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12"
                    stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>

        <div class="settings-modal-body library-modal-body">
          <div class="library-search-shell">
            <div class="lp-search-wrap">
              <svg class="lp-search-icon" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" aria-hidden="true">
                <circle cx="11" cy="11" r="7"/>
                <path d="M16.5 16.5L21 21" stroke-linecap="round"/>
              </svg>
              <input type="text" id="library-search"
                     placeholder="Search chats…"
                     autocomplete="off" spellcheck="false"/>
            </div>
          </div>
          <div class="library-list-shell">
            <div id="chat-list" class="lp-list"></div>
          </div>
        </div>

      </div>
    </div>
  `;
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatChatDate(date) {
  const now  = new Date();
  const diff = now - date;
  const DAY  = 86_400_000;
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (diff < DAY)     return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 7 * DAY) return DAYS[date.getDay()];
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/* ══════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════ */
export function initLibraryModal({ onChatSelect = () => {} } = {}) {

  /* ── 1. Inject HTML (only once) ── */
  if (!document.getElementById('library-modal-backdrop')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = buildHTML();
    document.body.appendChild(wrap.firstElementChild);
  }

  /* ── 2. Element refs (resolved after injection) ── */
  const backdrop    = () => document.getElementById('library-modal-backdrop');
  const closeBtn    = () => document.getElementById('library-close');
  const searchInput = () => document.getElementById('library-search');
  const chatListEl  = () => document.getElementById('chat-list');

  /* ── 3. Render ── */
  function renderChatList(chats, filter = '') {
    const list  = chatListEl();
    if (!list) return;
    const query    = filter.toLowerCase().trim();
    const filtered = query
      ? chats.filter(c => (c.title || '').toLowerCase().includes(query))
      : chats;

    if (!filtered.length) {
      list.innerHTML = `<div class="lp-empty">${
        query ? 'No matching chats' : 'No chats yet.<br>Start a conversation!'
      }</div>`;
      return;
    }

    list.innerHTML = '';

    filtered.forEach(chat => {
      const dateText = chat.updatedAt ? formatChatDate(new Date(chat.updatedAt)) : '';
      const item     = document.createElement('div');
      item.className = 'lp-item';
      item.dataset.id = escapeHtml(chat.id);

      const info = document.createElement('div');
      info.className = 'lp-item-info';
      info.innerHTML = `
        <div class="lp-item-title">${escapeHtml(chat.title || 'Untitled chat')}</div>
        <div class="lp-item-meta">${escapeHtml(dateText)}</div>`;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'lp-delete-btn';
      deleteBtn.title = 'Delete chat';
      deleteBtn.setAttribute('aria-label', 'Delete chat');
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;

      deleteBtn.addEventListener('click', async e => {
        e.stopPropagation();
        await window.electronAPI?.deleteChat(chat.id);
        await refreshChatList();
      });

      item.append(info, deleteBtn);
      list.appendChild(item);
    });
  }

  async function refreshChatList() {
    const list = chatListEl();
    try {
      const chats = (await window.electronAPI?.getChats()) ?? [];
      renderChatList(chats, searchInput()?.value ?? '');
      return chats;
    } catch {
      if (list) list.innerHTML = '<div class="lp-empty">Could not load chats</div>';
      return [];
    }
  }

  /* ── 4. Wire events ── */
  function wireEvents() {
    closeBtn()?.addEventListener('click', close);

    backdrop()?.addEventListener('click', e => {
      if (e.target === backdrop()) close();
    });

    searchInput()?.addEventListener('input', async () => {
      const chats = (await window.electronAPI?.getChats()) ?? [];
      renderChatList(chats, searchInput().value);
    });

    chatListEl()?.addEventListener('click', e => {
      const item = e.target.closest('.lp-item');
      if (item && !e.target.closest('.lp-delete-btn')) {
        onChatSelect(item.dataset.id);
        close();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen()) close();
    });
  }

  wireEvents();

  /* ── 5. Sync body class helper ── */
  function syncBodyClass() {
    const hasOpen = Boolean(
      document.querySelector(
        '#settings-modal-backdrop.open, #library-modal-backdrop.open'
      )
    );
    document.body.classList.toggle('modal-open', hasOpen);
  }

  /* ── 6. Public API ── */
  async function open() {
    document.querySelector('[data-view="library"]')?.classList.add('active');
    backdrop()?.classList.add('open');
    syncBodyClass();
    await refreshChatList();
    requestAnimationFrame(() => searchInput()?.focus());
  }

  function close() {
    backdrop()?.classList.remove('open');
    document.querySelector('[data-view="library"]')?.classList.remove('active');
    syncBodyClass();
  }

  function isOpen() {
    return backdrop()?.classList.contains('open') ?? false;
  }

  return { open, close, isOpen };
}
