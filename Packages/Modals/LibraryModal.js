import { state } from '../System/State.js';
import { t, applyI18n } from '../System/I18n/index.js';
import { escapeHtml, fullDateTime, timeAgo } from '../System/Utils.js';
import { createModal } from '../System/ModalFactory.js';

const PINNED_KEY = 'joanium-pinned-chats';
const MAX_PINS = 3;

function getPinnedIds() {
  try {
    return JSON.parse(localStorage.getItem(PINNED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function savePinnedIds(ids) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
}

function pinChat(chatId) {
  let ids = getPinnedIds();
  if (ids.includes(chatId)) return;
  if (ids.length >= MAX_PINS) {
    ids = ids.slice(1); // remove oldest pin to make room
  }
  ids.push(chatId);
  savePinnedIds(ids);
}

function unpinChat(chatId) {
  savePinnedIds(getPinnedIds().filter((id) => id !== chatId));
}

function currentChatScope() {
  return state.activeProject ? { projectId: state.activeProject.id } : {};
}

export function initLibraryModal({ onChatSelect: onChatSelect = () => {} } = {}) {
  const searchInput = () => document.getElementById('library-search');
  const chatListEl = () => document.getElementById('chat-list');

  function syncHeader() {
    const title = document.getElementById('library-modal-title');
    if (title) {
      title.textContent = state.activeProject
        ? t('library.projectTitle', { name: state.activeProject.name })
        : t('library.title');
    }
  }

  function renderChatList(chats, filter = '') {
    const list = chatListEl();
    if (!list) return;

    const query = filter.toLowerCase().trim();
    const filtered = query
      ? chats.filter((c) => (c.title || '').toLowerCase().includes(query))
      : chats;

    if (!filtered.length) {
      list.innerHTML = `<div class="lp-empty">${
        query
          ? t('library.noMatching')
          : state.activeProject
            ? t('library.noChatsProject')
            : t('library.noChats')
      }</div>`;
      return;
    }

    list.innerHTML = '';
    const pinnedIds = getPinnedIds();
    const pinned = filtered.filter((c) => pinnedIds.includes(c.id));
    const unpinned = filtered.filter((c) => !pinnedIds.includes(c.id));

    function buildItem(chat, isPinned) {
      const item = document.createElement('div');
      item.className = 'lp-item' + (isPinned ? ' lp-item--pinned' : '');
      item.dataset.id = escapeHtml(chat.id);

      const info = document.createElement('div');
      info.className = 'lp-item-info';
      info.innerHTML = `
        <div class="lp-item-title">${escapeHtml(chat.title || 'Untitled chat')}</div>
        <div class="lp-item-datetime">
          <span class="lp-item-timeago">${timeAgo(chat.updatedAt)}</span>
          <span class="lp-item-fulldate">${fullDateTime(chat.updatedAt)}</span>
        </div>`;

      const pinBtn = document.createElement('button');
      pinBtn.className = 'lp-pin-btn' + (isPinned ? ' lp-pin-btn--active' : '');
      pinBtn.title = isPinned ? t('library.unpinChat') : t('library.pinChat');
      pinBtn.setAttribute('aria-label', isPinned ? t('library.unpinChat') : t('library.pinChat'));
      pinBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="17" x2="12" y2="22"/>
          <path d="M5 17h14"/>
          <path d="M15 5h1a2 2 0 0 1 2 2v1a2 2 0 0 1-.586 1.414L15 11.828V15a1 1 0 0 1-.293.707L13 17H11l-1.707-1.293A1 1 0 0 1 9 15v-3.172L6.586 9.414A2 2 0 0 1 6 8V7a2 2 0 0 1 2-2h1"/>
          <line x1="12" y1="2" x2="12" y2="5"/>
        </svg>`;

      pinBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (isPinned) {
          unpinChat(chat.id);
        } else {
          pinChat(chat.id);
        }
        await refreshChatList();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'lp-delete-btn';
      deleteBtn.title = t('library.deleteChat');
      deleteBtn.setAttribute('aria-label', t('library.deleteChat'));
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;

      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        unpinChat(chat.id);
        await window.electronAPI?.invoke('delete-chat', chat.id, currentChatScope());
        await refreshChatList();
      });

      item.append(info, pinBtn, deleteBtn);
      return item;
    }

    if (pinned.length) {
      const pinnedSection = document.createElement('div');
      pinnedSection.className = 'lp-section';
      pinnedSection.innerHTML = `
        <div class="lp-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11">
            <line x1="12" y1="17" x2="12" y2="22"/>
            <path d="M5 17h14"/>
            <path d="M15 5h1a2 2 0 0 1 2 2v1a2 2 0 0 1-.586 1.414L15 11.828V15a1 1 0 0 1-.293.707L13 17H11l-1.707-1.293A1 1 0 0 1 9 15v-3.172L6.586 9.414A2 2 0 0 1 6 8V7a2 2 0 0 1 2-2h1"/>
            <line x1="12" y1="2" x2="12" y2="5"/>
          </svg>
          ${t('library.pinned')} <span class="lp-pin-count">${pinned.length} / ${MAX_PINS}</span>
        </div>`;
      pinned.forEach((chat) => pinnedSection.appendChild(buildItem(chat, true)));
      list.appendChild(pinnedSection);
    }

    if (unpinned.length) {
      const allSection = document.createElement('div');
      allSection.className = 'lp-section';
      if (pinned.length) {
        allSection.innerHTML = `<div class="lp-section-label">${t('library.allChats')}</div>`;
      }
      unpinned.forEach((chat) => allSection.appendChild(buildItem(chat, false)));
      list.appendChild(allSection);
    }
  }

  async function refreshChatList() {
    const list = chatListEl();
    try {
      syncHeader();
      const chats = (await window.electronAPI?.invoke('get-chats', currentChatScope())) ?? [];
      renderChatList(chats, searchInput()?.value ?? '');
      return chats;
    } catch {
      if (list) list.innerHTML = `<div class="lp-empty">${t('library.couldNotLoad')}</div>`;
      return [];
    }
  }

  const modal = createModal({
    backdropId: 'library-modal-backdrop',
    html: `
    <div id="library-modal-backdrop">
      <div id="library-panel" role="dialog" aria-modal="true"
           aria-labelledby="library-modal-title">

        <div class="settings-modal-header">
          <div class="settings-modal-copy">
            <h2 id="library-modal-title" data-i18n="library.title">Revisit your chats</h2>
            <p data-i18n="library.description">${t('library.description')}</p>
          </div>
          <button class="settings-modal-close" id="library-close"
                  type="button" data-i18n-label="library.closeLabel" aria-label="Close library">
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
                     data-i18n-placeholder="library.searchPlaceholder"
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
  `,
    closeBtnSelector: '#library-close',
    onInit(backdrop) {
      searchInput()?.addEventListener('input', async () => {
        renderChatList(
          (await window.electronAPI?.invoke('get-chats', currentChatScope())) ?? [],
          searchInput()?.value ?? '',
        );
      });

      const chatList = chatListEl();
      chatList?.addEventListener('click', (e) => {
        const item = e.target.closest('.lp-item');
        if (item && !e.target.closest('.lp-delete-btn') && !e.target.closest('.lp-pin-btn')) {
          onChatSelect(item.dataset.id);
          modal.close();
        }
      });

      window.addEventListener('jo:project-changed', () => {
        syncHeader();
        if (modal.isOpen()) refreshChatList();
      });

      window.addEventListener('jo:language-changed', () => {
        applyI18n(backdrop);
        syncHeader();
      });
    },
  });

  return {
    open: async function () {
      syncHeader();
      document.querySelector('[data-view="library"]')?.classList.add('active');
      modal.open();
      await refreshChatList();
      requestAnimationFrame(() => searchInput()?.focus());
    },
    close: function () {
      document.querySelector('[data-view="library"]')?.classList.remove('active');
      modal.close();
    },
    isOpen: modal.isOpen,
  };
}
