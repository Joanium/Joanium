// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Shared/Sidebar.js
//
//  Renders the shared sidebar + theme panel + avatar panel
//  into whatever page imports it.
//
//  Usage (in Main.js, Automations.js, or any future page):
//
//    import { initSidebar } from '../Shared/Sidebar.js';
//
//    initSidebar({
//      activePage: 'chat',          // 'chat' | 'library' | 'automations'
//      onNewChat:   () => { ... },  // called when the + button is clicked
//      onLibrary:   () => { ... },  // called when the library button is clicked
//      onAutomations: () => { ... },// called when automations button is clicked
//      onSettings:  () => { ... },  // called when avatar-panel "Settings" is clicked
//    });
//
//  The function mounts HTML into #sidebar, #theme-panel, and #avatar-panel
//  (all of which must already exist in the page's DOM — see the stub below).
//  It also wires every interactive element so the caller never has to.
//
//  Minimal stub to add to any HTML page
//  (paste inside #body-wrap, before your <main>):
//
//    <!-- populated by Sidebar.js -->
//    <aside id="sidebar"></aside>
//    <div  id="theme-panel"></div>
//    <div  id="avatar-panel"></div>
// ─────────────────────────────────────────────

/* ══════════════════════════════════════════
   ICONS  (reusable SVG strings)
══════════════════════════════════════════ */
const ICON = {
  logo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
           <path d="M12 2L8 6H4v4L2 12l2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4L12 2z" stroke-width="1.5"/>
         </svg>`,

  newChat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
            </svg>`,

  library: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M4 4h4v16H4zM10 4h10v7H10zM10 15h10v5H10z" stroke-linejoin="round"/>
            </svg>`,

  automations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z" stroke-linejoin="round"/>
                </svg>`,

  theme: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41
                     M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                  stroke-linecap="round"/>
          </svg>`,

  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                   <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
                 </svg>`,
};

/* ══════════════════════════════════════════
   THEME DATA
══════════════════════════════════════════ */
const THEMES = [
  { id: 'dark',      label: 'Dark',      swatchClass: 'swatch-dark'      },
  { id: 'light',     label: 'Light',     swatchClass: 'swatch-light'     },
  { id: 'midnight',  label: 'Midnight',  swatchClass: 'swatch-midnight'  },
  { id: 'forest',    label: 'Forest',    swatchClass: 'swatch-forest'    },
  { id: 'pinky',     label: 'Pinky',     swatchClass: 'swatch-pinky'     },
];

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function getInitials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] ?? 'OW').slice(0, 2).toUpperCase();
}

function applyTheme(theme, animate = true) {
  const valid = THEMES.map(t => t.id);
  if (!valid.includes(theme)) theme = 'dark';

  if (animate) {
    const flash = document.createElement('div');
    flash.style.cssText =
      'position:fixed;inset:0;z-index:9999;background:var(--accent-glow);' +
      'pointer-events:none;animation:themeFlash .35s ease forwards;';
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
  }

  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ow-theme', theme);

  document.querySelectorAll('.theme-option, .ap-theme-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === theme);
  });
}

/* ══════════════════════════════════════════
   HTML BUILDERS
══════════════════════════════════════════ */
function buildSidebarHTML(activePage) {
  const btn = (view, icon, tip) => {
    const isActive = view === activePage ? ' active' : '';
    return `<button class="sidebar-btn${isActive}" data-view="${view}" data-tip="${tip}" title="${tip}">
              ${icon}
            </button>`;
  };

  return `
    <div class="sidebar-logo" title="openworld">${ICON.logo}</div>

    <div class="sidebar-divider"></div>

    ${btn('chat',        ICON.newChat,     'New chat')}
    ${btn('library',     ICON.library,     'Library')}
    ${btn('automations', ICON.automations, 'Automations')}

    <div class="sidebar-spacer"></div>

    <button class="sidebar-btn theme-toggle" id="theme-toggle-btn"
            data-tip="Switch theme" title="Switch theme">
      ${ICON.theme}
    </button>

    <button class="sidebar-avatar" id="sidebar-avatar-btn"
            data-tip="Account" title="Account">OW</button>
  `;
}

function buildThemePanelHTML() {
  return THEMES.map(t => `
    <button class="theme-option" data-theme="${t.id}">
      <span class="theme-swatch ${t.swatchClass}"></span>${t.label}
    </button>
  `).join('');
}

function buildAvatarPanelHTML() {
  return `
    <div class="ap-header">
      <div class="ap-badge" id="avatar-panel-badge">OW</div>
      <div class="ap-user-info">
        <span class="ap-name"    id="avatar-panel-name">User</span>
        <span class="ap-subtitle">openworld account</span>
      </div>
    </div>

    <div class="ap-divider"></div>

    <button id="avatar-settings-btn" class="ap-settings-btn" type="button">
      <span class="ap-settings-copy">
        <span class="ap-settings-title">Settings</span>
        <span class="ap-settings-subtitle">Manage your profile, providers, and connectors</span>
      </span>
      ${ICON.chevronRight}
    </button>

    <button id="avatar-about-btn" class="ap-settings-btn" type="button"
            style="margin-top:8px;">
      <span class="ap-settings-copy">
        <span class="ap-settings-title">About</span>
        <span class="ap-settings-subtitle">Version info, credits, and support the project</span>
      </span>
      ${ICON.chevronRight}
    </button>
  `;
}

/* ══════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════ */

/**
 * Mount and wire the shared sidebar.
 *
 * @param {object} opts
 * @param {'chat'|'library'|'automations'} [opts.activePage='chat']
 * @param {() => void} [opts.onNewChat]       - handler for the + (new chat) button
 * @param {() => void} [opts.onLibrary]       - handler for the library button
 * @param {() => void} [opts.onAutomations]   - handler for the automations button
 * @param {() => void} [opts.onSettings]      - handler for avatar-panel → Settings
 * @param {() => void} [opts.onAbout]         - handler for avatar-panel → About
 */
export function initSidebar({
  activePage    = 'chat',
  onNewChat     = () => {},
  onLibrary     = () => {},
  onAutomations = () => {},
  onSettings    = () => {},
  onAbout       = () => {},
} = {}) {

  /* ── 1. Inject keyframe once ── */
  if (!document.getElementById('ow-sidebar-style')) {
    const style = document.createElement('style');
    style.id = 'ow-sidebar-style';
    style.textContent = '@keyframes themeFlash{0%{opacity:.3}100%{opacity:0}}';
    document.head.appendChild(style);
  }

  /* ── 2. Mount HTML ── */
  const sidebarEl     = document.getElementById('sidebar');
  const themePanelEl  = document.getElementById('theme-panel');
  const avatarPanelEl = document.getElementById('avatar-panel');

  if (!sidebarEl)     throw new Error('[Sidebar] Missing #sidebar element in the DOM.');
  if (!themePanelEl)  throw new Error('[Sidebar] Missing #theme-panel element in the DOM.');
  if (!avatarPanelEl) throw new Error('[Sidebar] Missing #avatar-panel element in the DOM.');

  sidebarEl.innerHTML     = buildSidebarHTML(activePage);
  themePanelEl.innerHTML  = buildThemePanelHTML();
  avatarPanelEl.innerHTML = buildAvatarPanelHTML();

  /* ── 3. Apply saved theme (no flash on load) ── */
  applyTheme(localStorage.getItem('ow-theme') || 'dark', false);

  /* ── 4. Wire navigation buttons ── */
  sidebarEl.querySelectorAll('.sidebar-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'chat')        { onNewChat();     return; }
      if (view === 'library')     { onLibrary();     return; }
      if (view === 'automations') { onAutomations(); return; }
    });
  });

  /* ── 5. Theme panel ── */
  const themeToggleBtn = document.getElementById('theme-toggle-btn');

  themeToggleBtn?.addEventListener('click', e => {
    e.stopPropagation();
    themePanelEl.classList.toggle('open');
    avatarPanelEl.classList.remove('open');
  });

  themePanelEl.querySelectorAll('.theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
      applyTheme(opt.dataset.theme);
      themePanelEl.classList.remove('open');
    });
  });

  /* ── 6. Avatar panel ── */
  const avatarBtn = document.getElementById('sidebar-avatar-btn');

  avatarBtn?.addEventListener('click', e => {
    e.stopPropagation();
    avatarPanelEl.classList.toggle('open');
    themePanelEl.classList.remove('open');
  });

  document.getElementById('avatar-settings-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    avatarPanelEl.classList.remove('open');
    onSettings();
  });

  document.getElementById('avatar-about-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    avatarPanelEl.classList.remove('open');
    onAbout();
  });

  /* ── 7. Close panels on outside click ── */
  document.addEventListener('click', e => {
    if (!avatarPanelEl.contains(e.target) && e.target !== avatarBtn)
      avatarPanelEl.classList.remove('open');
    if (!themePanelEl.contains(e.target) && e.target !== themeToggleBtn)
      themePanelEl.classList.remove('open');
  });

  /* ── 8. Keyboard shortcut: Escape closes panels ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      avatarPanelEl.classList.remove('open');
      themePanelEl.classList.remove('open');
    }
  });

  /* ── 9. Populate user name / initials from Electron if available ── */
  (async () => {
    try {
      const user = await window.electronAPI?.getUser?.();
      const name = String(user?.name ?? '').trim() || 'User';
      setUser(name);
    } catch {
      /* not in Electron — leave defaults */
    }
  })();

  /* ── Return helpers so callers can update the sidebar ── */
  return { setUser, setActivePage };

  /* ── Helpers ── */
  function setUser(name) {
    const displayName = String(name ?? '').trim() || 'User';
    const initials    = getInitials(displayName);
    const avatarBtnEl = document.getElementById('sidebar-avatar-btn');
    if (avatarBtnEl) { avatarBtnEl.textContent = initials; avatarBtnEl.title = displayName; }
    const badge = document.getElementById('avatar-panel-badge');
    const nameEl = document.getElementById('avatar-panel-name');
    if (badge)  badge.textContent  = initials;
    if (nameEl) nameEl.textContent = displayName;
  }

  function setActivePage(page) {
    document.querySelectorAll('#sidebar .sidebar-btn[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === page);
    });
  }
}
