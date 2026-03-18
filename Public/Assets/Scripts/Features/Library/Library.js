// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Features/Library/Library.js
//  Chat history panel: open, close, search, render, delete.
// ─────────────────────────────────────────────

import { state }           from '../../Shared/State.js';
import { escapeHtml, formatChatDate } from '../../Shared/Utils.js';
import {
  libraryBackdrop, libraryClose,
  librarySearch, chatList,
  syncModalOpenState,
}                          from '../../Shared/DOM.js';

/* ══════════════════════════════════════════
   RENDER
══════════════════════════════════════════ */
function renderChatList(chats, filter = '') {
  if (!chatList) return;
  const query    = filter.toLowerCase().trim();
  const filtered = query
    ? chats.filter(c => (c.title || '').toLowerCase().includes(query))
    : chats;

  if (!filtered.length) {
    chatList.innerHTML = `<div class="lp-empty">${query ? 'No matching chats' : 'No chats yet.<br>Start a conversation!'}</div>`;
    return;
  }

  chatList.innerHTML = '';

  filtered.forEach(chat => {
    const isActive  = chat.id === state.currentChatId;
    const dateText  = chat.updatedAt ? formatChatDate(new Date(chat.updatedAt)) : '';

    const item = document.createElement('div');
    item.className = `lp-item${isActive ? ' active' : ''}`;
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
    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

    deleteBtn.addEventListener('click', async e => {
      e.stopPropagation();
      await window.electronAPI?.deleteChat(chat.id);
      await refreshChatList();
    });

    item.append(info, deleteBtn);
    chatList.appendChild(item);
  });
}

async function refreshChatList() {
  try {
    const chats = (await window.electronAPI?.getChats()) ?? [];
    renderChatList(chats, librarySearch?.value ?? '');
    return chats;
  } catch {
    if (chatList) chatList.innerHTML = '<div class="lp-empty">Could not load chats</div>';
    return [];
  }
}

/* ══════════════════════════════════════════
   OPEN / CLOSE
══════════════════════════════════════════ */
/** @param {function} closeAvatarPanel */
export async function open(closeAvatarPanel) {
  closeAvatarPanel?.();
  document.querySelector('[data-view="library"]')?.classList.add('active');
  libraryBackdrop?.classList.add('open');
  syncModalOpenState();
  await refreshChatList();
  requestAnimationFrame(() => librarySearch?.focus());
}

export function close() {
  libraryBackdrop?.classList.remove('open');
  document.querySelector('[data-view="library"]')?.classList.remove('active');
  syncModalOpenState();
}

export function isOpen() {
  return libraryBackdrop?.classList.contains('open') ?? false;
}

/* ══════════════════════════════════════════
   INIT (bind UI events)
   @param {function} onChatSelect  – called with chatId when an item is clicked
   @param {function} closeAvatarPanel
══════════════════════════════════════════ */
export function init(onChatSelect, closeAvatarPanel) {
  libraryClose?.addEventListener('click', close);

  libraryBackdrop?.addEventListener('click', e => {
    if (e.target === libraryBackdrop) close();
  });

  librarySearch?.addEventListener('input', async () => {
    const chats = (await window.electronAPI?.getChats()) ?? [];
    renderChatList(chats, librarySearch.value);
  });

  // Delegate click on chat items
  chatList?.addEventListener('click', e => {
    const item = e.target.closest('.lp-item');
    if (item && !e.target.closest('.lp-delete-btn')) {
      onChatSelect(item.dataset.id);
      close();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });
}
