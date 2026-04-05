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

// Build the PAGES map from the manifest — populated after async discovery
let PAGES = {};

/* ══════════════════════════════════════════
   ROUTER STATE
══════════════════════════════════════════ */
let _currentPage = null; // page key string
let _currentCleanup = null; // cleanup fn returned by page's mount()
let _sidebar = null;
let _library = null;
let _projects = null;
let _settings = null;
let _about = null;

/* ══════════════════════════════════════════
   NAVIGATE
   This is the single function all navigation
   flows through. Exposed as window.appNavigate
   so page modules can call it without circular
   imports.
══════════════════════════════════════════ */
export async function navigate(page, options = {}) {
  const { startFreshChat = false, pendingChatId = null } = options;

  if (!PAGES[page]) {
    console.warn('[App] Unknown page:', page);
    return;
  }

  if (page === 'chat') {
    window._pendingChatId = pendingChatId;
    window._startFreshChat = Boolean(startFreshChat);
  }

  // Run previous page's cleanup (cancel intervals, remove listeners, etc.)
  if (typeof _currentCleanup === 'function') {
    try {
      _currentCleanup();
    } catch (e) {
      console.warn('[App] cleanup error', e);
    }
    _currentCleanup = null;
  }

  const outlet = document.getElementById('page-outlet');
  if (!outlet) return;

  // Show a minimal loading state to prevent the "bare HTML" flash
  outlet.innerHTML = '<div class="page-transition-loading"></div>';

  try {
    const { load, css } = PAGES[page];

    // Load module and CSS in parallel — both must be ready before mount()
    // so the stylesheet is already applied when HTML is injected (no FOUC).
    const [mod] = await Promise.all([load(), css ? injectCSS(css) : Promise.resolve()]);

    outlet.innerHTML = ''; // clear loading state

    // mount() injects page HTML into outlet, wires up events,
    // and returns an optional cleanup function
    const cleanup = mod.mount(outlet, {
      settings: _settings,
      about: _about,
      library: _library,
      projects: _projects,
      sidebar: _sidebar,
      navigate, // pass navigate so pages don't need to import it
    });

    _currentCleanup = cleanup || null;
    _currentPage = page;

    // Update sidebar active state
    _sidebar?.setActivePage(page);
  } catch (err) {
    console.error('[App] Failed to load page:', page, err);
    outlet.innerHTML = `<div style="padding:40px;color:var(--text-muted);font-family:var(--font-ui)">
      Failed to load page — ${err.message}
    </div>`;
  }
}

async function openFreshChat() {
  if (!state.activeProject && state.workspacePath) {
    state.workspacePath = null;
    window.dispatchEvent(
      new CustomEvent('ow:workspace-changed', {
        detail: { workspacePath: null },
      }),
    );
  }
  await navigate('chat', { startFreshChat: true });
}

/* ══════════════════════════════════════════
   PROJECT HELPERS
   Shared across Chat and Sidebar project flows.
══════════════════════════════════════════ */
async function openProject(project) {
  const validation = await window.electronAPI?.invoke?.('validate-project', project.id);
  if (!validation?.ok || !validation.project) return false;

  let nextProject = validation.project;

  if (!validation.folderExists) {
    // showMissingProjectDialog is handled inside ProjectsModal
    return false;
  } else {
    const touched = await window.electronAPI?.invoke?.('update-project', nextProject.id, {
      lastOpenedAt: new Date().toISOString(),
    });
    if (touched?.ok && touched.project) nextProject = touched.project;
  }

  state.activeProject = nextProject;
  state.workspacePath = nextProject.rootPath;

  // Navigate to chat with the project active
  await openFreshChat();
  window.dispatchEvent(
    new CustomEvent('ow:project-changed', { detail: { project: state.activeProject } }),
  );
  await _projects?.refreshProjects?.();
  return true;
}

async function leaveProject() {
  state.activeProject = null;
  state.workspacePath = null;
  await openFreshChat();
  window.dispatchEvent(new CustomEvent('ow:project-changed', { detail: { project: null } }));
}

/* ══════════════════════════════════════════
   INIT
   Called once when index.html loads.
══════════════════════════════════════════ */
async function init() {
  // ── Register feature-declared pages, then discover all pages ─────────
  try {
    const boot = await getFeatureBoot();
    if (boot.pages?.length) registerFeaturePages(boot.pages);
  } catch {
    /* non-fatal */
  }
  await discoverPages();
  Object.assign(PAGES, buildPagesMap());

  // ── Window controls ─────────────────────────────────────────────────
  document
    .getElementById('btn-minimize')
    ?.addEventListener('click', () => window.electronAPI?.send('window-minimize'));
  document
    .getElementById('btn-maximize')
    ?.addEventListener('click', () => window.electronAPI?.send('window-maximize'));
  document
    .getElementById('btn-close')
    ?.addEventListener('click', () => window.electronAPI?.send('window-close'));

  // ── CRITICAL modals (needed immediately for sidebar avatar) ─────────────
  _settings = initSettingsModal();
  _about = initAboutModal();

  // ── Channel Gateway — process Telegram/WhatsApp messages via agentLoop ─
  initChannelGateway();
  initScheduledAgentGateway();

  // ── Sidebar ─────────────────────────────────────────────────────────
  // Uses a single onNavigate callback for all page nav instead of
  // individual per-page callbacks. The sidebar builds itself from the
  // pages manifest.
  _sidebar = initSidebar({
    activePage: 'chat',
    navigation: buildSidebarNav(),
    onNewChat: () => openFreshChat(),
    onLibrary: () => (_library?.isOpen() ? _library.close() : _library?.open()),
    onProjects: () => (_projects?.isOpen() ? _projects.close() : _projects?.open()),
    onSettings: () => _settings.open(),
    onAbout: () => _about.open(),
    onNavigate: (pageId) => navigate(pageId),
  });

  // ── User hydration ───────────────────────────────────────────────────
  const user = await _settings.loadUser().catch(() => null);
  _sidebar.setUser(user?.name ?? '');

  window.addEventListener('ow:user-profile-updated', (e) => {
    _sidebar.setUser(e.detail?.name ?? '');
  });

  // ── Main-process navigate events ─────────────────────────────────────
  window.electronAPI?.on?.('navigate', (page) => navigate(page));

  // ── Global navigate for page modules ────────────────────────────────
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
  await openFreshChat();

  // ── Lazy modals (deferred until browser is idle) ─────────────────────
  const initDeferredModals = () => {
    _library = initLibraryModal({
      onChatSelect: async (chatId) => {
        _library.close();
        await navigate('chat', { pendingChatId: chatId });
      },
    });
    _projects = initProjectsModal({
      onProjectOpen: openProject,
      onProjectRemoved: leaveProject,
      onClose: () => {
        _sidebar?.setActivePage(_currentPage);
      },
    });
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(initDeferredModals, { timeout: 2000 });
  } else {
    setTimeout(initDeferredModals, 500);
  }

  // SPA navigation now uses in-memory pending chat ids.
  localStorage.removeItem('ow-pending-chat');
}

init().catch((err) => console.error('[App] init failed:', err));
