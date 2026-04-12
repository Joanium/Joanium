import { state } from '../../System/State.js';
import { initSidebar } from '../../Pages/Shared/Navigation/Sidebar.js';
import { initAboutModal } from '../../Modals/AboutModal.js';
import { initLibraryModal } from '../../Modals/LibraryModal.js';
import { initProjectsModal } from '../../Modals/ProjectsModal.js';
import { initSettingsModal } from '../../Modals/SettingsModal.js';
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
  _about = null;
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
      (console.error('[App] Failed to load page:', page, err),
        (outlet.innerHTML = `<div style="padding:40px;color:var(--text-muted);font-family:var(--font-ui)">\n      Failed to load page — ${err.message}\n    </div>`));
    }
  }
}
async function openFreshChat() {
  (!state.activeProject &&
    state.workspacePath &&
    ((state.workspacePath = null),
    window.dispatchEvent(
      new CustomEvent('ow:workspace-changed', { detail: { workspacePath: null } }),
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
      new CustomEvent('ow:project-changed', { detail: { project: state.activeProject } }),
    ),
    await _projects?.refreshProjects?.(),
    !0
  );
}
async function leaveProject() {
  ((state.activeProject = null),
    (state.workspacePath = null),
    await openFreshChat(),
    window.dispatchEvent(new CustomEvent('ow:project-changed', { detail: { project: null } })));
}
(async function () {
  try {
    const boot = await getFeatureBoot();
    boot.pages?.length && registerFeaturePages(boot.pages);
  } catch {}
  (await discoverPages(),
    Object.assign(PAGES, buildPagesMap()),
    document
      .getElementById('btn-minimize')
      ?.addEventListener('click', () => window.electronAPI?.send('window-minimize')),
    document
      .getElementById('btn-maximize')
      ?.addEventListener('click', () => window.electronAPI?.send('window-maximize')),
    document
      .getElementById('btn-close')
      ?.addEventListener('click', () => window.electronAPI?.send('window-close')),
    (_settings = initSettingsModal()),
    (_about = initAboutModal()),
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
  const user = await _settings.loadUser().catch(() => null);
  if (
    (_sidebar.setUser(user?.name ?? ''),
    window.addEventListener('ow:user-profile-updated', (e) => {
      _sidebar.setUser(e.detail?.name ?? '');
    }),
    window.electronAPI?.on?.('navigate', (page) => navigate(page)),
    (window.appNavigate = navigate),
    !document.getElementById('_app-transition-style'))
  ) {
    const s = document.createElement('style');
    ((s.id = '_app-transition-style'),
      (s.textContent =
        '\n      .page-transition-loading {\n        height: 100%;\n        background: var(--bg-primary, #111);\n      }\n    '),
      document.head.appendChild(s));
  }
  await openFreshChat();
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
