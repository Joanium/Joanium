import { state } from '../System/State.js';
import { escapeHtml, timeAgo } from '../System/Utils.js';
import { createModal } from '../System/ModalFactory.js';
function currentChatScope() {
  return state.activeProject ? { projectId: state.activeProject.id } : {};
}
export function initLibraryModal({ onChatSelect: onChatSelect = () => {} } = {}) {
  const searchInput = () => document.getElementById('library-search'),
    chatListEl = () => document.getElementById('chat-list');
  function syncHeader() {
    const title = document.getElementById('library-modal-title');
    title &&
      (title.textContent = state.activeProject
        ? `${state.activeProject.name} chats`
        : 'Revisit your chats');
  }
  function renderChatList(chats, filter = '') {
    const list = chatListEl();
    if (!list) return;
    const query = filter.toLowerCase().trim(),
      filtered = query ? chats.filter((c) => (c.title || '').toLowerCase().includes(query)) : chats;
    filtered.length
      ? ((list.innerHTML = ''),
        filtered.forEach((chat) => {
          const item = document.createElement('div');
          ((item.className = 'lp-item'), (item.dataset.id = escapeHtml(chat.id)));
          const info = document.createElement('div');
          ((info.className = 'lp-item-info'),
            (info.innerHTML = `\n        <div class="lp-item-title">${escapeHtml(chat.title || 'Untitled chat')}</div>\n        <div class="chat-time">${timeAgo(new Date(chat.updatedAt))}</div>`));
          const deleteBtn = document.createElement('button');
          ((deleteBtn.className = 'lp-delete-btn'),
            (deleteBtn.title = 'Delete chat'),
            deleteBtn.setAttribute('aria-label', 'Delete chat'),
            (deleteBtn.innerHTML =
              '\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"\n                stroke-linecap="round" stroke-linejoin="round"/>\n        </svg>'),
            deleteBtn.addEventListener('click', async (e) => {
              (e.stopPropagation(),
                await window.electronAPI?.invoke('delete-chat', chat.id, currentChatScope()),
                await refreshChatList());
            }),
            item.append(info, deleteBtn),
            list.appendChild(item));
        }))
      : (list.innerHTML = `<div class="lp-empty">${query ? 'No matching chats' : state.activeProject ? 'No chats for this project yet.<br>Start a conversation in this workspace.' : 'No chats yet.<br>Start a conversation!'}</div>`);
  }
  async function refreshChatList() {
    const list = chatListEl();
    try {
      syncHeader();
      const chats = (await window.electronAPI?.invoke('get-chats', currentChatScope())) ?? [];
      return (renderChatList(chats, searchInput()?.value ?? ''), chats);
    } catch {
      return (list && (list.innerHTML = '<div class="lp-empty">Could not load chats</div>'), []);
    }
  }
  const modal = createModal({
    backdropId: 'library-modal-backdrop',
    html: '\n    <div id="library-modal-backdrop">\n      <div id="library-panel" role="dialog" aria-modal="true"\n           aria-labelledby="library-modal-title">\n\n        <div class="settings-modal-header">\n          <div class="settings-modal-copy">\n            <h2 id="library-modal-title">Revisit your chats</h2>\n          </div>\n          <button class="settings-modal-close" id="library-close"\n                  type="button" aria-label="Close library">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">\n              <path d="M18 6L6 18M6 6l12 12"\n                    stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n            </svg>\n          </button>\n        </div>\n\n        <div class="settings-modal-body library-modal-body">\n          <div class="library-search-shell">\n            <div class="lp-search-wrap">\n              <svg class="lp-search-icon" viewBox="0 0 24 24"\n                   fill="none" stroke="currentColor" aria-hidden="true">\n                <circle cx="11" cy="11" r="7"/>\n                <path d="M16.5 16.5L21 21" stroke-linecap="round"/>\n              </svg>\n              <input type="text" id="library-search"\n                     placeholder="Search chats…"\n                     autocomplete="off" spellcheck="false"/>\n            </div>\n          </div>\n          <div class="library-list-shell">\n            <div id="chat-list" class="lp-list"></div>\n          </div>\n        </div>\n\n      </div>\n    </div>\n  ',
    closeBtnSelector: '#library-close',
    onInit(backdrop) {
      searchInput()?.addEventListener('input', async () => {
        renderChatList(
          (await window.electronAPI?.invoke('get-chats', currentChatScope())) ?? [],
          searchInput()?.value ?? '',
        );
      });
      const chatList = chatListEl();
      (chatList?.addEventListener('click', (e) => {
        const item = e.target.closest('.lp-item');
        item &&
          !e.target.closest('.lp-delete-btn') &&
          (onChatSelect(item.dataset.id), modal.close());
      }),
        window.addEventListener('ow:project-changed', () => {
          (syncHeader(), modal.isOpen() && refreshChatList());
        }));
    },
  });
  return {
    open: async function () {
      (syncHeader(),
        document.querySelector('[data-view="library"]')?.classList.add('active'),
        modal.open(),
        await refreshChatList(),
        requestAnimationFrame(() => searchInput()?.focus()));
    },
    close: function () {
      (document.querySelector('[data-view="library"]')?.classList.remove('active'), modal.close());
    },
    isOpen: modal.isOpen,
  };
}
