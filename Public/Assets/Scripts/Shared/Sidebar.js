const ICON = {

  newChat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
            </svg>`,

  library: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M4 4h4v16H4zM10 4h10v7H10zM10 15h10v5H10z" stroke-linejoin="round"/>
            </svg>`,

  projects: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
               <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke-linecap="round" stroke-linejoin="round"/>
               <path d="M8 11h8M8 15h5" stroke-linecap="round"/>
             </svg>`,

  automations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z" stroke-linejoin="round"/>
                </svg>`,

  skills: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
             <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                   stroke-linecap="round" stroke-linejoin="round"/>
           </svg>`,

  personas: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
               <circle cx="12" cy="8" r="4"/>
               <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/>
             </svg>`,

  events: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
             <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>`,

  usage: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4" stroke-linecap="round"/>
          </svg>`,

  agents: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/>
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

// THEME DATA
const THEMES = [
  { id: 'dark', label: 'Dark', swatchClass: 'swatch-dark' },
  { id: 'light', label: 'Light', swatchClass: 'swatch-light' },
  { id: 'midnight', label: 'Midnight', swatchClass: 'swatch-midnight' },
  { id: 'forest', label: 'Forest', swatchClass: 'swatch-forest' },
  { id: 'pinky', label: 'Pinky', swatchClass: 'swatch-pinky' },
];

// HELPERS
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

// HTML BUILDERS
function buildSidebarHTML(activePage) {
  const btn = (view, icon, tip) => {
    const isActive = view === activePage ? ' active' : '';
    return `<button class="sidebar-btn${isActive}" data-view="${view}" data-tip="${tip}" title="${tip}">
              ${icon}
            </button>`;
  };

  return `
    ${btn('chat', ICON.newChat, 'New chat')}
    ${btn('library', ICON.library, 'Library')}
    ${btn('projects', ICON.projects, 'Projects')}
    ${btn('automations', ICON.automations, 'Automations')}
    ${btn('agents', ICON.agents, 'Agents')}
    ${btn('skills', ICON.skills, 'Skills')}
    ${btn('personas', ICON.personas, 'Personas')}

    <div class="sidebar-spacer"></div>

    ${btn('events', ICON.events, 'Events')}
    ${btn('usage', ICON.usage, 'Usage')}

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
        <span class="ap-subtitle">Evelina account</span>
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

// MAIN EXPORT

/**
 * Mount and wire the shared sidebar.
 *
 * @param {object} opts
 * @param {'chat'|'library'|'projects'|'automations'|'agents'|'skills'|'personas'|'events'|'usage'} [opts.activePage='chat']
 * @param {() => void} [opts.onNewChat]
 * @param {() => void} [opts.onLibrary]
 * @param {() => void} [opts.onProjects]
 * @param {() => void} [opts.onAutomations]
 * @param {() => void} [opts.onAgents]
 * @param {() => void} [opts.onSkills]
 * @param {() => void} [opts.onPersonas]
 * @param {() => void} [opts.onEvents]
 * @param {() => void} [opts.onUsage]
 * @param {() => void} [opts.onSettings]
 * @param {() => void} [opts.onAbout]
 */
export function initSidebar({
  activePage = 'chat',
  onNewChat = () => { },
  onLibrary = () => { },
  onProjects = () => { },
  onAutomations = () => { },
  onAgents = () => { },
  onSkills = () => { },
  onPersonas = () => { },
  onEvents = () => { },
  onUsage = () => { },
  onSettings = () => { },
  onAbout = () => { },
} = {}) {

  // Inject keyframe once
  if (!document.getElementById('ow-sidebar-style')) {
    const style = document.createElement('style');
    style.id = 'ow-sidebar-style';
    style.textContent = '@keyframes themeFlash{0%{opacity:.3}100%{opacity:0}}';
    document.head.appendChild(style);
  }

  // Mount HTML
  const sidebarEl = document.getElementById('sidebar');
  const themePanelEl = document.getElementById('theme-panel');
  const avatarPanelEl = document.getElementById('avatar-panel');

  if (!sidebarEl) throw new Error('[Sidebar] Missing #sidebar element in the DOM.');
  if (!themePanelEl) throw new Error('[Sidebar] Missing #theme-panel element in the DOM.');
  if (!avatarPanelEl) throw new Error('[Sidebar] Missing #avatar-panel element in the DOM.');

  sidebarEl.innerHTML = buildSidebarHTML(activePage);
  themePanelEl.innerHTML = buildThemePanelHTML();
  avatarPanelEl.innerHTML = buildAvatarPanelHTML();

  // Apply saved theme (no flash on load)
  applyTheme(localStorage.getItem('ow-theme') || 'dark', false);

  // Wire navigation buttons
  sidebarEl.querySelectorAll('.sidebar-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'chat') { onNewChat(); return; }
      if (view === 'library') { onLibrary(); return; }
      if (view === 'projects') { onProjects(); return; }
      if (view === 'automations') { onAutomations(); return; }
      if (view === 'agents') { onAgents(); return; }
      if (view === 'skills') { onSkills(); return; }
      if (view === 'personas') { onPersonas(); return; }
      if (view === 'events') { onEvents(); return; }
      if (view === 'usage') { onUsage(); return; }
    });
  });

  // Theme panel
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

  // Avatar panel
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

  // Close panels on outside click
  document.addEventListener('click', e => {
    if (!avatarPanelEl.contains(e.target) && e.target !== avatarBtn)
      avatarPanelEl.classList.remove('open');
    if (!themePanelEl.contains(e.target) && e.target !== themeToggleBtn)
      themePanelEl.classList.remove('open');
  });

  // Keyboard shortcut: Escape closes panels
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      avatarPanelEl.classList.remove('open');
      themePanelEl.classList.remove('open');
    }
  });

  // Populate user name / initials from Electron if available
  (async () => {
    try {
      const user = await window.electronAPI?.getUser?.();
      const name = String(user?.name ?? '').trim() || 'User';
      setUser(name);
    } catch {
      // not in Electron — leave defaults
    }
  })();

  return { setUser, setActivePage };

  function setUser(name) {
    const displayName = String(name ?? '').trim() || 'User';
    const initials = getInitials(displayName);
    const avatarBtnEl = document.getElementById('sidebar-avatar-btn');
    if (avatarBtnEl) { avatarBtnEl.textContent = initials; avatarBtnEl.title = displayName; }
    const badge = document.getElementById('avatar-panel-badge');
    const nameEl = document.getElementById('avatar-panel-name');
    if (badge) badge.textContent = initials;
    if (nameEl) nameEl.textContent = displayName;
  }

  function setActivePage(page) {
    document.querySelectorAll('#sidebar .sidebar-btn[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === page);
    });
  }
}
