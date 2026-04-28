import { t } from '../../../System/I18n/index.js';
import { getInitials } from '../../../System/Utils.js';
const ICON_chevronRight =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">\n                   <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n                 </svg>',
  THEMES = [
    { id: 'dark', label: 'Dark', swatchClass: 'swatch-dark' },
    { id: 'light', label: 'Light', swatchClass: 'swatch-light' },
    { id: 'midnight', label: 'Midnight', swatchClass: 'swatch-midnight' },
    { id: 'forest', label: 'Forest', swatchClass: 'swatch-forest' },
    { id: 'pinky', label: 'Pinky', swatchClass: 'swatch-pinky' },
    { id: 'sunset', label: 'Sunset', swatchClass: 'swatch-sunset' },
    { id: 'ocean', label: 'Ocean', swatchClass: 'swatch-ocean' },
  ];
function applyTheme(theme, animate = !0) {
  if ((THEMES.map((t) => t.id).includes(theme) || (theme = 'dark'), animate)) {
    const flash = document.createElement('div');
    ((flash.className = 'theme-flash'),
      document.body.appendChild(flash),
      flash.addEventListener('animationend', () => flash.remove()));
  }
  (document.documentElement.setAttribute('data-theme', theme),
    localStorage.setItem('ow-theme', theme),
    document.querySelectorAll('.theme-option, .ap-theme-option').forEach((opt) => {
      opt.classList.toggle('active', opt.dataset.theme === theme);
    }));
  // Keep the Windows native caption-button overlay colour-matched to the active theme.
  try {
    const s = getComputedStyle(document.documentElement);
    const color = s.getPropertyValue('--titlebar-bg').trim();
    const symbolColor = s.getPropertyValue('--text-muted').trim();
    if (color && symbolColor)
      window.electronAPI?.send('window-set-titlebar-overlay', { color, symbolColor, height: 36 });
  } catch {}
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
  const sidebarEl = document.getElementById('sidebar'),
    themePanelEl = document.getElementById('theme-panel'),
    avatarPanelEl = document.getElementById('avatar-panel');
  if (!sidebarEl) throw new Error('[Sidebar] Missing #sidebar element in the DOM.');
  if (!themePanelEl) throw new Error('[Sidebar] Missing #theme-panel element in the DOM.');
  if (!avatarPanelEl) throw new Error('[Sidebar] Missing #avatar-panel element in the DOM.');
  ((sidebarEl.innerHTML = (function (activePage, navigation = {}) {
    const nav = { top: navigation.top ?? [], bottom: navigation.bottom ?? [] },
      btn = (id, icon, tip, i18nKey = '') =>
        `<button class="sidebar-btn${id === activePage ? ' active' : ''}" data-view="${id}" data-tip="${tip}"${i18nKey ? ` data-i18n-key="${i18nKey}"` : ''}>\n              ${icon}\n            </button>`,
      topButtons = nav.top
        .filter((item) => !SPECIAL_BUTTON_IDS.has(item.id))
        .map((item) => btn(item.id, item.icon, t(item.label), item.label))
        .join('\n    '),
      bottomButtons = nav.bottom
        .map((item) => btn(item.id, item.icon, t(item.label), item.label))
        .join('\n    ');
    return `\n    ${btn('chat', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>\n            </svg>', t('sidebar.newChat'))}\n    ${btn('library', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" stroke-linecap="round" stroke-linejoin="round"/>\n              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke-linecap="round" stroke-linejoin="round"/>\n            </svg>', t('sidebar.library'))}\n    ${btn('projects', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>\n            </svg>', t('sidebar.projects'))}\n    ${topButtons}\n\n    <div class="sidebar-spacer"></div>\n\n    ${bottomButtons}\n\n    <button class="sidebar-btn theme-toggle" id="theme-toggle-btn"\n            data-tip="${t('sidebar.switchTheme')}">\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke-linecap="round" stroke-linejoin="round"/>\n          </svg>\n    </button>\n\n    <button class="sidebar-avatar" id="sidebar-avatar-btn"\n            data-tip="${t('sidebar.account')}">JO</button>\n  `;
  })(activePage, navigation)),
    (themePanelEl.innerHTML = THEMES.map(
      (t) =>
        `\n    <button class="theme-option" data-theme="${t.id}">\n      <span class="theme-swatch ${t.swatchClass}"></span>${t.label}\n    </button>\n  `,
    ).join('')),
    (avatarPanelEl.innerHTML = `\n    <div class="ap-header">\n      <div class="ap-badge" id="avatar-panel-badge">JO</div>\n      <div class="ap-user-info">\n        <span class="ap-name"    id="avatar-panel-name">User</span>\n        <span class="ap-subtitle">${t('sidebar.joAccount')}</span>\n      </div>\n    </div>\n\n    <div class="ap-divider"></div>\n\n    <button id="avatar-settings-btn" class="ap-settings-btn" type="button">\n      <span class="ap-settings-copy">\n        <span class="ap-settings-title">${t('sidebar.settings')}</span>\n        <span class="ap-settings-subtitle">${t('sidebar.settingsSubtitle')}</span>\n      </span>\n      ${ICON_chevronRight}\n    </button>\n\n    <button id="avatar-about-btn" class="ap-settings-btn ap-settings-btn--about" type="button">\n      <span class="ap-settings-copy">\n        <span class="ap-settings-title">${t('sidebar.about')}</span>\n        <span class="ap-settings-subtitle">${t('sidebar.aboutSubtitle')}</span>\n      </span>\n      ${ICON_chevronRight}\n    </button>\n  `),
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
    // Update sidebar text when the app language changes
    window.addEventListener('jo:language-changed', () => {
      // Special sidebar buttons (keys are literal i18n keys)
      const viewKeys = {
        chat: 'sidebar.newChat',
        library: 'sidebar.library',
        projects: 'sidebar.projects',
      };
      for (const [view, key] of Object.entries(viewKeys)) {
        const btn = sidebarEl.querySelector(`[data-view="${view}"]`);
        if (btn) {
          btn.dataset.tip = t(key);
        }
      }
      // Dynamic page nav buttons — label stored as an i18n key in data-i18n-key
      sidebarEl.querySelectorAll('.sidebar-btn[data-i18n-key]').forEach((btn) => {
        const translated = t(btn.dataset.i18nKey);
        btn.dataset.tip = translated;
      });
      // Theme toggle
      const themeBtn = document.getElementById('theme-toggle-btn');
      if (themeBtn) {
        themeBtn.dataset.tip = t('sidebar.switchTheme');
      }
      // Avatar button
      const avatarBtn2 = document.getElementById('sidebar-avatar-btn');
      if (avatarBtn2) {
        avatarBtn2.dataset.tip = t('sidebar.account');
      }
      // Avatar panel strings
      const sub = avatarPanelEl.querySelector('.ap-subtitle');
      if (sub) sub.textContent = t('sidebar.joAccount');
      const settingsTitle = avatarPanelEl.querySelector('#avatar-settings-btn .ap-settings-title');
      if (settingsTitle) settingsTitle.textContent = t('sidebar.settings');
      const settingsSub = avatarPanelEl.querySelector('#avatar-settings-btn .ap-settings-subtitle');
      if (settingsSub) settingsSub.textContent = t('sidebar.settingsSubtitle');
      const aboutTitle = avatarPanelEl.querySelector('#avatar-about-btn .ap-settings-title');
      if (aboutTitle) aboutTitle.textContent = t('sidebar.about');
      const aboutSub = avatarPanelEl.querySelector('#avatar-about-btn .ap-settings-subtitle');
      if (aboutSub) aboutSub.textContent = t('sidebar.aboutSubtitle');
    }),
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
      initials = getInitials(displayName),
      avatarBtnEl = document.getElementById('sidebar-avatar-btn');
    avatarBtnEl && (avatarBtnEl.textContent = initials);
    const badge = document.getElementById('avatar-panel-badge'),
      nameEl = document.getElementById('avatar-panel-name');
    (badge && (badge.textContent = initials), nameEl && (nameEl.textContent = displayName));
  }
}
