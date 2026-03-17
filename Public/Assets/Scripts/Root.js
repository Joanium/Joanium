/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
export const state = {
    messages: [],
    isTyping: false,
    theme: localStorage.getItem('ow-theme') || 'light',
    providers: [],
    selectedProvider: null,
    selectedModel: null,
    currentChatId: null,
    userName: '',
    userInitials: 'OW',
};

/* ══════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════ */
export const textarea = document.getElementById('chat-input');
export const sendBtn = document.getElementById('send-btn');
export const welcome = document.getElementById('welcome');
export const chatView = document.getElementById('chat-view');
export const chatMessages = document.getElementById('chat-messages');
export const chips = document.querySelectorAll('.chip');
export const sidebarBtns = document.querySelectorAll('.sidebar-btn[data-view]');
export const themeBtn = document.getElementById('theme-toggle-btn');
export const themePanel = document.getElementById('theme-panel');
export const themeOptions = document.querySelectorAll('.theme-option');
export const modelSelectorBtn = document.getElementById('model-selector-btn');
export const modelDropdown = document.getElementById('model-dropdown');
export const modelLabel = document.getElementById('model-label');

// Library
export const libraryPanel = document.getElementById('library-panel');
export const libraryClose = document.getElementById('library-close');
export const librarySearch = document.getElementById('library-search');
export const chatList = document.getElementById('chat-list');

// Avatar panel
export const avatarBtn = document.getElementById('sidebar-avatar-btn');
export const avatarPanel = document.getElementById('avatar-panel');
export const avatarPanelName = document.getElementById('avatar-panel-name');
export const avatarPanelBadge = document.getElementById('avatar-panel-badge');

/* ── Window controls ── */
document.getElementById('btn-minimize')?.addEventListener('click', () => window.electronAPI?.minimize());
document.getElementById('btn-maximize')?.addEventListener('click', () => window.electronAPI?.maximize());
document.getElementById('btn-close')?.addEventListener('click', () => window.electronAPI?.close());