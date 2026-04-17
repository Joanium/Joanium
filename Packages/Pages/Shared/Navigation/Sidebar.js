const ICON_chevronRight =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">\n                   <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n                 </svg>',
  THEMES = [
    { id: 'dark', label: 'Dark', swatchClass: 'swatch-dark' },
    { id: 'light', label: 'Light', swatchClass: 'swatch-light' },
    { id: 'midnight', label: 'Midnight', swatchClass: 'swatch-midnight' },
    { id: 'forest', label: 'Forest', swatchClass: 'swatch-forest' },
    { id: 'pinky', label: 'Pinky', swatchClass: 'swatch-pinky' },
  ];
function applyTheme(theme, animate = !0) {
  if ((THEMES.map((t) => t.id).includes(theme) || (theme = 'dark'), animate)) {
    const flash = document.createElement('div');
    ((flash.style.cssText =
      'position:fixed;inset:0;z-index:9999;background:var(--accent-glow);pointer-events:none;animation:themeFlash .35s ease forwards;'),
      document.body.appendChild(flash),
      flash.addEventListener('animationend', () => flash.remove()));
  }
  (document.documentElement.setAttribute('data-theme', theme),
    localStorage.setItem('ow-theme', theme),
    document.querySelectorAll('.theme-option, .ap-theme-option').forEach((opt) => {
      opt.classList.toggle('active', opt.dataset.theme === theme);
    }));
}
const SPECIAL_BUTTON_IDS = new Set(['chat', 'library', 'projects']);
export function initSidebar({
  activePage: activePage = 'chat',
  navigation: navigation = { top: [], bottom: [] },
  onNewChat: onNewChat = () => {},
  onLibrary: onLibrary = () => {},
  onProjects: onProjects = () => {},
  onSettings: onSettings = () => {},
  onAbout: onAbout = () => {},
  onNavigate: onNavigate = () => {},
} = {}) {
  if (!document.getElementById('ow-sidebar-style')) {
    const style = document.createElement('style');
    ((style.id = 'ow-sidebar-style'),
      (style.textContent = '@keyframes themeFlash{0%{opacity:.3}100%{opacity:0}}'),
      document.head.appendChild(style));
  }
  const sidebarEl = document.getElementById('sidebar'),
    themePanelEl = document.getElementById('theme-panel'),
    avatarPanelEl = document.getElementById('avatar-panel');
  if (!sidebarEl) throw new Error('[Sidebar] Missing #sidebar element in the DOM.');
  if (!themePanelEl) throw new Error('[Sidebar] Missing #theme-panel element in the DOM.');
  if (!avatarPanelEl) throw new Error('[Sidebar] Missing #avatar-panel element in the DOM.');
  ((sidebarEl.innerHTML = (function (activePage, navigation = {}) {
    const nav = { top: navigation.top ?? [], bottom: navigation.bottom ?? [] },
      btn = (id, icon, tip) =>
        `<button class="sidebar-btn${id === activePage ? ' active' : ''}" data-view="${id}" data-tip="${tip}" title="${tip}">\n              ${icon}\n            </button>`,
      topButtons = nav.top
        .filter((item) => !SPECIAL_BUTTON_IDS.has(item.id))
        .map((item) => btn(item.id, item.icon, item.label))
        .join('\n    '),
      bottomButtons = nav.bottom.map((item) => btn(item.id, item.icon, item.label)).join('\n    ');
    return `\n    ${btn('chat', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n              <path d="M12 5v14M5 12h14" stroke-linecap="round"/>\n            </svg>', 'New chat')}\n    ${btn('library', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n              <path d="M4 4h4v16H4zM10 4h10v7H10zM10 15h10v5H10z" stroke-linejoin="round"/>\n            </svg>', 'Library')}\n    ${btn('projects', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n               <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke-linecap="round" stroke-linejoin="round"/>\n               <path d="M8 11h8M8 15h5" stroke-linecap="round"/>\n             </svg>', 'Projects')}\n    ${topButtons}\n\n    <div class="sidebar-spacer"></div>\n\n    ${bottomButtons}\n\n    <button class="sidebar-btn theme-toggle" id="theme-toggle-btn"\n            data-tip="Switch theme" title="Switch theme">\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n            <circle cx="12" cy="12" r="4"/>\n            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41\n                     M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"\n                  stroke-linecap="round"/>\n          </svg>\n    </button>\n\n    <button class="sidebar-avatar" id="sidebar-avatar-btn"\n            data-tip="Account" title="Account">JO</button>\n  `;
  })(activePage, navigation)),
    (themePanelEl.innerHTML = THEMES.map(
      (t) =>
        `\n    <button class="theme-option" data-theme="${t.id}">\n      <span class="theme-swatch ${t.swatchClass}"></span>${t.label}\n    </button>\n  `,
    ).join('')),
    (avatarPanelEl.innerHTML = `\n    <div class="ap-header">\n      <div class="ap-badge" id="avatar-panel-badge">JO</div>\n      <div class="ap-user-info">\n        <span class="ap-name"    id="avatar-panel-name">User</span>\n        <span class="ap-subtitle">Joanium account</span>\n      </div>\n    </div>\n\n    <div class="ap-divider"></div>\n\n    <button id="avatar-settings-btn" class="ap-settings-btn" type="button">\n      <span class="ap-settings-copy">\n        <span class="ap-settings-title">Settings</span>\n        <span class="ap-settings-subtitle">Manage your profile, providers, and connectors</span>\n      </span>\n      ${ICON_chevronRight}\n    </button>\n\n    <button id="avatar-about-btn" class="ap-settings-btn" type="button"\n            style="margin-top:8px;">\n      <span class="ap-settings-copy">\n        <span class="ap-settings-title">About</span>\n        <span class="ap-settings-subtitle">Version info, credits, and support the project</span>\n      </span>\n      ${ICON_chevronRight}\n    </button>\n  `),
    applyTheme(localStorage.getItem('ow-theme') || 'dark', !1),
    sidebarEl.querySelectorAll('.sidebar-btn[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        'chat' !== view
          ? 'library' !== view
            ? 'projects' !== view
              ? onNavigate(view)
              : onProjects()
            : onLibrary()
          : onNewChat();
      });
    }));
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  (themeToggleBtn?.addEventListener('click', (e) => {
    (e.stopPropagation(),
      themePanelEl.classList.toggle('open'),
      avatarPanelEl.classList.remove('open'));
  }),
    themePanelEl.querySelectorAll('.theme-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        (applyTheme(opt.dataset.theme), themePanelEl.classList.remove('open'));
      });
    }));
  const avatarBtn = document.getElementById('sidebar-avatar-btn');
  return (
    avatarBtn?.addEventListener('click', (e) => {
      (e.stopPropagation(),
        avatarPanelEl.classList.toggle('open'),
        themePanelEl.classList.remove('open'));
    }),
    document.getElementById('avatar-settings-btn')?.addEventListener('click', (e) => {
      (e.stopPropagation(), avatarPanelEl.classList.remove('open'), onSettings());
    }),
    document.getElementById('avatar-about-btn')?.addEventListener('click', (e) => {
      (e.stopPropagation(), avatarPanelEl.classList.remove('open'), onAbout());
    }),
    document.addEventListener('click', (e) => {
      (avatarPanelEl.contains(e.target) ||
        e.target === avatarBtn ||
        avatarPanelEl.classList.remove('open'),
        themePanelEl.contains(e.target) ||
          e.target === themeToggleBtn ||
          themePanelEl.classList.remove('open'));
    }),
    document.addEventListener('keydown', (e) => {
      'Escape' === e.key &&
        (avatarPanelEl.classList.remove('open'), themePanelEl.classList.remove('open'));
    }),
    (async () => {
      try {
        const user = await window.electronAPI?.invoke?.('get-user');
        setUser(String(user?.name ?? '').trim() || 'User');
      } catch {}
    })(),
    {
      setUser: setUser,
      setActivePage: function (page) {
        document.querySelectorAll('#sidebar .sidebar-btn[data-view]').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.view === page);
        });
      },
    }
  );
  function setUser(name) {
    const displayName = String(name ?? '').trim() || 'User',
      initials = (function (name) {
        const parts = String(name ?? '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        return parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : (parts[0] ?? 'JO').slice(0, 2).toUpperCase();
      })(displayName),
      avatarBtnEl = document.getElementById('sidebar-avatar-btn');
    avatarBtnEl && ((avatarBtnEl.textContent = initials), (avatarBtnEl.title = displayName));
    const badge = document.getElementById('avatar-panel-badge'),
      nameEl = document.getElementById('avatar-panel-name');
    (badge && (badge.textContent = initials), nameEl && (nameEl.textContent = displayName));
  }
}
