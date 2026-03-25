export let textarea            = null;
export let sendBtn             = null;
export let attachmentBtn       = null;
export let folderBtn           = null;
export let composerAttachments = null;
export let composerHint        = null;

// ── Chat view ────────────────────────────────
export let welcome      = null;
export let chatView     = null;
export let chatMessages = null;
export let chips        = [];  // NodeList → start empty, not null, so .forEach works
export let projectContextBar    = null;
export let projectContextTitle  = null;
export let projectContextPath   = null;
export let projectContextInfo   = null;
export let projectOpenFolderBtn = null;
export let projectExitBtn       = null;

// ── Sidebar ───────────────────────────────────
export let sidebarBtns  = [];
export let themeBtn     = null;
export let themePanel   = null;
export let themeOptions = [];

// ── Model selector ────────────────────────────
export let modelSelectorBtn = null;
export let modelDropdown    = null;
export let modelLabel       = null;

// ── Library ───────────────────────────────────
export let libraryBackdrop = null;
export let libraryPanel    = null;
export let libraryClose    = null;
export let librarySearch   = null;
export let chatList        = null;

// ── Avatar panel ──────────────────────────────
export let avatarBtn         = null;
export let avatarPanel       = null;
export let avatarPanelName   = null;
export let avatarPanelBadge  = null;
export let avatarSettingsBtn = null;

// ── Settings modal ────────────────────────────
export let settingsModalBackdrop = null;
export let settingsModal         = null;
export let settingsModalClose    = null;

/**
 * Call this inside the Chat page's mount() function,
 * AFTER injecting the Chat HTML into the outlet.
 * All imported bindings will update immediately.
 */
export function initDOM() {
  textarea            = document.getElementById('chat-input');
  sendBtn             = document.getElementById('send-btn');
  attachmentBtn       = document.getElementById('attachment-btn');
  folderBtn           = document.getElementById('folder-btn');
  composerAttachments = document.getElementById('composer-attachments');
  composerHint        = document.getElementById('composer-hint');

  welcome             = document.getElementById('welcome');
  chatView            = document.getElementById('chat-view');
  chatMessages        = document.getElementById('chat-messages');
  chips               = Array.from(document.querySelectorAll('.chip'));
  projectContextBar    = document.getElementById('project-context-bar');
  projectContextTitle  = document.getElementById('project-context-title');
  projectContextPath   = document.getElementById('project-context-path');
  projectContextInfo   = document.getElementById('project-context-info');
  projectOpenFolderBtn = document.getElementById('project-open-folder-btn');
  projectExitBtn       = document.getElementById('project-exit-btn');

  sidebarBtns  = Array.from(document.querySelectorAll('.sidebar-btn[data-view]'));
  themeBtn     = document.getElementById('theme-toggle-btn');
  themePanel   = document.getElementById('theme-panel');
  themeOptions = Array.from(document.querySelectorAll('.theme-option'));

  modelSelectorBtn = document.getElementById('model-selector-btn');
  modelDropdown    = document.getElementById('model-dropdown');
  modelLabel       = document.getElementById('model-label');

  libraryBackdrop = document.getElementById('library-modal-backdrop');
  libraryPanel    = document.getElementById('library-panel');
  libraryClose    = document.getElementById('library-close');
  librarySearch   = document.getElementById('library-search');
  chatList        = document.getElementById('chat-list');

  avatarBtn         = document.getElementById('sidebar-avatar-btn');
  avatarPanel       = document.getElementById('avatar-panel');
  avatarPanelName   = document.getElementById('avatar-panel-name');
  avatarPanelBadge  = document.getElementById('avatar-panel-badge');
  avatarSettingsBtn = document.getElementById('avatar-settings-btn');

  settingsModalBackdrop = document.getElementById('settings-modal-backdrop');
  settingsModal         = document.getElementById('settings-modal');
  settingsModalClose    = document.getElementById('settings-modal-close');
}

/** Keep body.modal-open in sync with whether any modal is open. */
export const syncModalOpenState = () => {
  const hasOpen = Boolean(
    document.querySelector(
      '#settings-modal-backdrop.open, #library-modal-backdrop.open, #projects-modal-backdrop.open, #global-confirm-backdrop.open, #edit-project-backdrop.open'
    )
  );
  document.body.classList.toggle('modal-open', hasOpen);
};
