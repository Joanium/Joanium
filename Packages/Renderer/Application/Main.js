import { state } from '../../System/State.js';
import { initI18n, applyI18n, setLanguage } from '../../System/I18n/index.js';
import { initSidebar } from '../../Pages/Shared/Navigation/Sidebar.js';
import { initAboutModal } from '../../Modals/AboutModal.js';
import { initLibraryModal } from '../../Modals/LibraryModal.js';
import { initProjectsModal } from '../../Modals/ProjectsModal.js';
import { initSettingsModal } from '../../Modals/SettingsModal.js';
import { initHelpModal } from '../../Modals/HelpModal.js';
import { injectCSS } from '../../System/Utils/InjectCSS.js';
import { initChannelGateway } from '../../Pages/Channels/Features/Gateway.js';
import { initScheduledAgentGateway } from '../../Pages/Agents/Features/Gateway.js';
import {
  buildSidebarNav,
  discoverPages,
  buildPagesMap,
  registerFeaturePages,
} from './PagesManifest.js';
import { getFeatureBoot } from '../../Features/Core/FeatureBoot.js';
let PAGES = {},
  _currentPage = null,
  _currentCleanup = null,
  _sidebar = null,
  _library = null,
  _projects = null,
  _settings = null,
  _about = null,
  _help = null;

const APP_LOCK_ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];

function initAppLockActivityBridge() {
  if (!window.electronAPI?.send) return;

  let lastPingAt = 0;
  const minPingGapMs = 1000;
  const sendActivity = (force = false) => {
    const now = Date.now();
    if (!force && now - lastPingAt < minPingGapMs) return;
    lastPingAt = now;
    window.electronAPI.send('app-lock-activity');
  };

  const activityHandler = () => sendActivity();
  const visibilityHandler = () => {
    if (document.visibilityState === 'visible') sendActivity(true);
  };
  const focusHandler = () => sendActivity(true);

  APP_LOCK_ACTIVITY_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, activityHandler, { passive: true });
  });
  document.addEventListener('visibilitychange', visibilityHandler);
  window.addEventListener('focus', focusHandler);

  sendActivity(true);
}

export async function navigate(page, options = {}) {
  const { startFreshChat: startFreshChat = !1, pendingChatId: pendingChatId = null } = options;
  if (!PAGES[page]) return void console.warn('[App] Unknown page:', page);
  if (
    ('chat' === page &&
      ((window._pendingChatId = pendingChatId), (window._startFreshChat = Boolean(startFreshChat))),
    'function' == typeof _currentCleanup)
  ) {
    try {
      _currentCleanup();
    } catch (e) {
      console.warn('[App] cleanup error', e);
    }
    _currentCleanup = null;
  }
  const outlet = document.getElementById('page-outlet');
  if (outlet) {
    outlet.innerHTML = '<div class="page-transition-loading"></div>';
    try {
      const { load: load, css: css } = PAGES[page],
        [mod] = await Promise.all([load(), css ? injectCSS(css) : Promise.resolve()]);
      outlet.innerHTML = '';
      const cleanup = mod.mount(outlet, {
        settings: _settings,
        about: _about,
        library: _library,
        projects: _projects,
        sidebar: _sidebar,
        navigate: navigate,
      });
      ((_currentCleanup = cleanup || null), (_currentPage = page), _sidebar?.setActivePage(page));
    } catch (err) {
      console.error('[App] Failed to load page:', page, err);
      const errorEl = document.createElement('div');
      errorEl.className = 'page-load-error';
      errorEl.textContent = `Failed to load page - ${err.message}`;
      outlet.replaceChildren(errorEl);
    }
  }
}
async function openFreshChat() {
  (!state.activeProject &&
    state.workspacePath &&
    ((state.workspacePath = null),
    window.dispatchEvent(
      new CustomEvent('jo:workspace-changed', { detail: { workspacePath: null } }),
    )),
    await navigate('chat', { startFreshChat: !0 }));
}
async function openProject(project) {
  const validation = await window.electronAPI?.invoke?.('validate-project', project.id);
  if (!validation?.ok || !validation.project) return !1;
  let nextProject = validation.project;
  if (!validation.folderExists) return !1;
  {
    const touched = await window.electronAPI?.invoke?.('update-project', nextProject.id, {
      lastOpenedAt: new Date().toISOString(),
    });
    touched?.ok && touched.project && (nextProject = touched.project);
  }
  return (
    (state.activeProject = nextProject),
    (state.workspacePath = nextProject.rootPath),
    await openFreshChat(),
    window.dispatchEvent(
      new CustomEvent('jo:project-changed', { detail: { project: state.activeProject } }),
    ),
    await _projects?.refreshProjects?.(),
    !0
  );
}
async function leaveProject() {
  ((state.activeProject = null),
    (state.workspacePath = null),
    await openFreshChat(),
    window.dispatchEvent(new CustomEvent('jo:project-changed', { detail: { project: null } })));
}
(async function () {
  // ── i18n: sync language from main process before any UI renders ──
  await initI18n();

  try {
    const boot = await getFeatureBoot();
    boot.pages?.length && registerFeaturePages(boot.pages);
  } catch {}
  (await discoverPages(),
    Object.assign(PAGES, buildPagesMap()),
    // Stamp data-platform on <html> so Titlebar.css can branch per-OS
    // (e.g. extra left-padding on macOS for the traffic-light inset)
    window.electronAPI
      ?.invoke?.('get-platform')
      .then((p) => p && document.documentElement.setAttribute('data-platform', p))
      .catch(() => {}),
    (_settings = initSettingsModal()),
    (_about = initAboutModal()),
    (_help = initHelpModal()),
    initAppLockActivityBridge(),
    initChannelGateway(),
    initScheduledAgentGateway(),
    (_sidebar = initSidebar({
      activePage: 'chat',
      navigation: buildSidebarNav(),
      onNewChat: () => openFreshChat(),
      onLibrary: () => (_library?.isOpen() ? _library.close() : _library?.open()),
      onProjects: () => (_projects?.isOpen() ? _projects.close() : _projects?.open()),
      onSettings: () => _settings.open(),
      onAbout: () => _about.open(),
      onNavigate: (pageId) => navigate(pageId),
    })));
  // Apply initial translations to the whole page
  applyI18n(document.body);
  // When language changes (user picks a different lang in Settings), re-apply
  window.addEventListener('jo:language-changed', ({ detail }) => {
    setLanguage(detail.lang);
    applyI18n(document.body);
  });
  const user = await _settings.loadUser().catch(() => null);
  _sidebar.setUser(user?.name ?? '');
  window.addEventListener('jo:user-profile-updated', (e) => {
    _sidebar.setUser(e.detail?.name ?? '');
  });
  window.electronAPI?.on?.('navigate', (page) => navigate(page));
  window.appNavigate = navigate;
  window.appHelp = _help;
  let defaultPage = 'chat';
  try {
    const startupUser = await window.electronAPI?.invoke('get-user');
    defaultPage = startupUser?.preferences?.default_page ?? 'chat';
  } catch {}
  if (defaultPage === 'chat') {
    await openFreshChat();
  } else {
    await navigate(defaultPage);
  }
  const initDeferredModals = () => {
    ((_library = initLibraryModal({
      onChatSelect: async (chatId) => {
        (_library.close(), await navigate('chat', { pendingChatId: chatId }));
      },
    })),
      (_projects = initProjectsModal({
        onProjectOpen: openProject,
        onProjectRemoved: leaveProject,
        onClose: () => {
          _sidebar?.setActivePage(_currentPage);
        },
      })));
  };
  ('function' == typeof requestIdleCallback
    ? requestIdleCallback(initDeferredModals, { timeout: 2e3 })
    : setTimeout(initDeferredModals, 500),
    localStorage.removeItem('ow-pending-chat'));
})().catch((err) => console.error('[App] init failed:', err));

// Shortcuts
// Keyboard
document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  const key = e.key;
  const tag = document.activeElement?.tagName?.toLowerCase();
  const isTyping =
    tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;

  // Ctrl+, → Open Settings (works even from an input)
  if (ctrl && key === ',') {
    e.preventDefault();
    _settings?.open();
    return;
  }

  // Ctrl+/ → Open Help (works even from an input)
  if (ctrl && key === '/') {
    e.preventDefault();
    _help?.open();
    return;
  }

  // All other shortcuts should not fire while typing
  if (isTyping) return;

  if (ctrl && !shift) {
    switch (key) {
      case 'n':
        e.preventDefault();
        openFreshChat();
        return;
      case 'p':
        e.preventDefault();
        _projects?.isOpen() ? _projects.close() : _projects?.open();
        return;
      case 'l':
        e.preventDefault();
        document
          .querySelector('#chat-input, .chat-composer-input, textarea[data-role="chat"]')
          ?.focus();
        return;
    }
  }

  if (ctrl && shift) {
    switch (key) {
      case 'A':
        e.preventDefault();
        navigate('agents');
        return;
      case 'U':
        e.preventDefault();
        navigate('automations');
        return;
      case 'M':
        e.preventDefault();
        navigate('marketplace');
        return;
      case 'S':
        e.preventDefault();
        navigate('skills');
        return;
      case 'P':
        e.preventDefault();
        navigate('personas');
        return;
    }
  }
});
