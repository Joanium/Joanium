import { state }              from './Shared/State.js';
import { initSidebar }        from './Shared/Sidebar.js';
import { initAboutModal }     from './Shared/Modals/AboutModal.js';
import { initLibraryModal }   from './Shared/Modals/LibraryModal.js';
import { initProjectsModal }  from './Shared/Modals/ProjectsModal.js';
import { initSettingsModal }  from './Shared/Modals/SettingsModal.js';
import { syncModalOpenState } from './Shared/DOM.js';

const PAGES = {
  chat:        () => import('./Pages/index.js'),
  automations: () => import('./Pages/Automations.js'),
  agents:      () => import('./Pages/Agents.js'),
  events:      () => import('./Pages/Events.js'),
  skills:      () => import('./Pages/Skills.js'),
  personas:    () => import('./Pages/Personas.js'),
  usage:       () => import('./Pages/Usage.js'),
};

/* ══════════════════════════════════════════
   ROUTER STATE
══════════════════════════════════════════ */
let _currentPage    = null;  // page key string
let _currentCleanup = null;  // cleanup fn returned by page's mount()
let _sidebar        = null;
let _library        = null;
let _projects       = null;
let _settings       = null;
let _about          = null;

/* ══════════════════════════════════════════
   NAVIGATE
   This is the single function all navigation
   flows through. Exposed as window.appNavigate
   so page modules can call it without circular
   imports.
══════════════════════════════════════════ */
export async function navigate(page) {
  if (!PAGES[page]) {
    console.warn('[App] Unknown page:', page);
    return;
  }

  // Run previous page's cleanup (cancel intervals, remove listeners, etc.)
  if (typeof _currentCleanup === 'function') {
    try { _currentCleanup(); } catch (e) { console.warn('[App] cleanup error', e); }
    _currentCleanup = null;
  }

  const outlet = document.getElementById('page-outlet');
  if (!outlet) return;

  // Show a minimal loading state to prevent the "bare HTML" flash
  outlet.innerHTML = '<div class="page-transition-loading"></div>';

  try {
    const mod = await PAGES[page]();
    outlet.innerHTML = ''; // clear loading state

    // mount() injects page HTML into outlet, wires up events,
    // and returns an optional cleanup function
    const cleanup = mod.mount(outlet, {
      settings: _settings,
      about:    _about,
      library:  _library,
      projects: _projects,
      sidebar:  _sidebar,
      navigate, // pass navigate so pages don't need to import it
    });

    _currentCleanup = cleanup || null;
    _currentPage    = page;

    // Update sidebar active state
    _sidebar?.setActivePage(page);

  } catch (err) {
    console.error('[App] Failed to load page:', page, err);
    outlet.innerHTML = `<div style="padding:40px;color:var(--text-muted);font-family:var(--font-ui)">
      Failed to load page — ${err.message}
    </div>`;
  }
}

/* ══════════════════════════════════════════
   PROJECT HELPERS
   Shared across Chat and Sidebar project flows.
══════════════════════════════════════════ */
async function openProject(project) {
  const validation = await window.electronAPI?.validateProject?.(project.id);
  if (!validation?.ok || !validation.project) return false;

  let nextProject = validation.project;

  if (!validation.folderExists) {
    // showMissingProjectDialog is handled inside ProjectsModal
    return false;
  } else {
    const touched = await window.electronAPI?.updateProject?.(nextProject.id, {
      lastOpenedAt: new Date().toISOString(),
    });
    if (touched?.ok && touched.project) nextProject = touched.project;
  }

  state.activeProject  = nextProject;
  state.workspacePath  = nextProject.rootPath;

  // Navigate to chat with the project active
  await navigate('chat');
  window.dispatchEvent(new CustomEvent('ow:project-changed', { detail: { project: state.activeProject } }));
  await _projects?.refreshProjects?.();
  return true;
}

async function leaveProject() {
  state.activeProject = null;
  state.workspacePath = null;
  await navigate('chat');
  window.dispatchEvent(new CustomEvent('ow:project-changed', { detail: { project: null } }));
}

/* ══════════════════════════════════════════
   INIT
   Called once when index.html loads.
══════════════════════════════════════════ */
async function init() {

  // ── Window controls ─────────────────────────────────────────────────
  document.getElementById('btn-minimize')?.addEventListener('click', () => window.electronAPI?.minimize());
  document.getElementById('btn-maximize')?.addEventListener('click', () => window.electronAPI?.maximize());
  document.getElementById('btn-close')?.addEventListener('click',    () => window.electronAPI?.close());

  // ── Self-injecting shared modals ────────────────────────────────────
  // These inject their own HTML on first call, so they don't need
  // entries in index.html. Order matters: settings before sidebar
  // so settings.loadUser() can hydrate the sidebar avatar.
  _settings = initSettingsModal();
  _about    = initAboutModal();

  // Library needs to know which chat scope to use (project or global)
  _library = initLibraryModal({
    onChatSelect: async (chatId) => {
      if (chatId) window._pendingChatId = chatId;
      _library.close();
      await navigate('chat');
    },
  });

  // Projects modal reads its HTML from index.html (not self-injecting).
  // It MUST be initialised here so it's available on every page.
  _projects = initProjectsModal({
    onProjectOpen:    openProject,
    onProjectRemoved: leaveProject,
    onClose: () => { _sidebar?.setActivePage(_currentPage); },
  });

  // ── Sidebar ─────────────────────────────────────────────────────────
  // Initialized ONCE here. All navigation goes through window.appNavigate
  // so pages don't need to import App.js (which would create circular deps).
  _sidebar = initSidebar({
    activePage: 'chat',
    onNewChat:     () => navigate('chat'),
    onLibrary:     () => _library.isOpen() ? _library.close() : _library.open(),
    onProjects:    () => _projects.isOpen() ? _projects.close() : _projects.open(),
    onAutomations: () => navigate('automations'),
    onAgents:      () => navigate('agents'),
    onEvents:      () => navigate('events'),
    onSkills:      () => navigate('skills'),
    onPersonas:    () => navigate('personas'),
    onUsage:       () => navigate('usage'),
    onSettings:    () => _settings.open(),
    onAbout:       () => _about.open(),
  });

  // ── User hydration ───────────────────────────────────────────────────
  const user = await _settings.loadUser().catch(() => null);
  _sidebar.setUser(user?.name ?? '');

  window.addEventListener('ow:user-profile-updated', e => {
    _sidebar.setUser(e.detail?.name ?? '');
  });

  // ── Main-process navigate events ─────────────────────────────────────
  // Lets the Electron main process trigger navigation if ever needed
  // (e.g., after the setup wizard completes and calls launch-main).
  window.electronAPI?.onNavigate?.((page) => navigate(page));

  // ── Global navigate for page modules ────────────────────────────────
  // Pages call window.appNavigate('events') instead of importing App.js
  window.appNavigate = navigate;

  // ── Page-loading style ───────────────────────────────────────────────
  if (!document.getElementById('_app-transition-style')) {
    const s = document.createElement('style');
    s.id = '_app-transition-style';
    s.textContent = `
      .page-transition-loading {
        height: 100%;
        background: var(--bg-primary, #111);
      }
    `;
    document.head.appendChild(s);
  }

  // ── Initial page ─────────────────────────────────────────────────────
  await navigate('chat');

  // SPA navigation now uses in-memory pending chat ids.
  // Clear any stale value left over from the old multipage flow so
  // the app doesn't reopen an old chat on a fresh launch.
  localStorage.removeItem('ow-pending-chat');
}

init().catch(err => console.error('[App] init failed:', err));
