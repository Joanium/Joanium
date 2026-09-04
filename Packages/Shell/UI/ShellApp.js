import strings from '../I18n/en.js';
import { createElement, formatText } from '../../Shared/Utils/DomUtils.js';
import { collapseWhitespace, getNameInitials } from '../../Shared/Utils/StringUtils.js';
import { toFileUrl } from '../../Shared/Utils/UrlUtils.js';
import { invokeIpc, onIpc } from '../../Shared/Ipc/RendererIpc.js';
import { createIcon, iconMarkup } from '../../Shared/Icons/Icons.js';
import { EVENTS } from '../../Shared/Events/RendererEvents.js';
import { createChatView } from '../../Chat/UI/ChatApp.js';
import { createHistoryPanel } from '../../History/UI/HistoryPanel.js';
import { createChannelsPanel } from '../../Channels/UI/ChannelsPanel.js';
import { createChannelGateway } from '../../Channels/UI/ChannelGateway.js';
import { createEventsPanel } from '../../Events/UI/EventsPanel.js';
import { createProjectsPanel } from '../../Projects/UI/ProjectsPanel.js';
import { createMemoryPanel } from '../../Memory/UI/MemoryPanel.js';
import { createTemplatesPanel } from '../../Templates/UI/TemplatesPanel.js';
import { createAgentsPanel } from '../../Agents/UI/AgentsPanel.js';
import { createAgentGateway } from '../../Agents/UI/AgentGateway.js';
import { createCleanupGateway } from '../../Memory/UI/CleanupGateway.js';
import { createSkillsPanel } from '../../Skills/UI/SkillsPanel.js';
import { createPersonasPanel } from '../../Personas/UI/PersonasPanel.js';
import { createMarketplacePanel } from '../../Marketplace/UI/MarketplacePanel.js';
import { createLeaderboardPanel } from '../../Leaderboard/UI/LeaderboardPanel.js';
import { attachCustomScrollbar } from '../../Shared/CustomScrollbar/CustomScrollbar.js';
import { initSounds, play } from '../../Shared/Sounds/SoundManager.js';
import { createUsagePanel } from '../../Usage/UI/UsagePanel.js';
import { createUserPanel } from '../../User/UI/UserPanel.js';
import { createAboutPanel } from '../../About/UI/AboutPanel.js';
import { createAppSettingsPanel } from '../../AppSettings/UI/AppSettingsPanel.js';
import { createMemorySettingsPanel } from '../../AppSettings/UI/MemorySettingsPanel.js';
import { mountLockScreen } from '../../Security/UI/LockScreen.js';
import { createSecurityPanel } from '../../Security/UI/SecurityPanel.js';
import { createAutoLockTimer } from '../../Security/UI/AutoLockTimer.js';
import { resolveSecurityStatus } from '../../Security/UI/SecurityGuard.js';
import { createThemePanel } from '../../Themes/UI/ThemePanel.js';
import { loadAndApplyThemeState, stripNativeTooltips } from '../../Themes/UI/ThemeController.js';
import { createMCPPanel } from '../../MCP/UI/MCPPanel.js';
import { createProvidersPanel } from '../../Providers/UI/ProvidersPanel.js';
import { createConnectorsPanel } from '../../Toolset/UI/ConnectorsPanel.js';
import { registerShortcuts } from './Shortcuts.js';
import { createShortcutsPanel } from './ShortcutsPanel.js';
import { createSlashCommandsPanel } from '../../SlashCommands/UI/SlashCommandsPanel.js';
import { mountBirthdayCard } from '../../User/UI/BirthdayCard.js';
import { createSpotlightSearch } from '../../Shared/Spotlight/SpotlightSearch.js';

function disposeElementTree(root) {
  if (!root) {
    return;
  }

  for (const child of root.children) {
    disposeElementTree(child);
  }

  root._dispose?.();
}

async function bootstrap() {
  stripNativeTooltips();
  await loadAndApplyThemeState();
  // ── Security lock gate ─────────────────────────────────────────────────────
  // Must resolve before ANY UI is built. resolveSecurityStatus() performs
  // tamper detection: if Security.json was cleared externally and a valid
  // backup exists in sessionStorage / localStorage, it restores the file
  // before deciding whether to show the lock screen.
  try {
    const secStatus = await resolveSecurityStatus();
    if (secStatus.enabled) {
      await mountLockScreen(strings.security, secStatus);
    }
  } catch {
    // Security package not ready or disabled — proceed normally.
  }

  // ── Auto-lock timer ────────────────────────────────────────────────────
  // Created here so it is in scope for buildSettingsPanel below.
  // The timer listens to window activity events and fires onLock when idle.
  // ── Lock helper ───────────────────────────────────────────────────────────
  // Shared by the auto-lock timer, the /lock slash command, and the shortcut.
  async function lockNow() {
    try {
      // resolveSecurityStatus() performs tamper detection at runtime: if
      // Security.json was cleared or emptied since boot, the sessionStorage
      // backup is used to restore it before deciding whether to lock.  This
      // guards against mid-session file tampering, not just boot-time tampering.
      const status = await resolveSecurityStatus();
      if (!status.enabled) {
        // Security not configured — show a guest lock screen that unlocks on any keystroke.
        await mountLockScreen(strings.security, { ...status, guestMode: true });
        return;
      }
      autoLockTimer.pause();
      await mountLockScreen(strings.security, status);
      await autoLockTimer.refresh();
    } catch {
      // Non-fatal.
    }
  }

  const autoLockTimer = createAutoLockTimer({
    onLock: () => lockNow(),
  });
  autoLockTimer.start();

  const payload = await invokeIpc('shell:bootstrap');
  const appSettings = await invokeIpc('app-settings:get').catch(() => ({}));
  const root = document.getElementById('app');
  let profile = payload.user?.profile ?? {};
  let activeProject = null;
  let activePersona = null;

  // Load the persisted active persona from User.json before anything renders
  try {
    activePersona = await invokeIpc('personas:get-active-persona');
  } catch {
    // non-fatal — ChatApp has its own Joana fallback
  }
  let activeRouteId = appSettings.defaultView ?? 'chat';
  let activeTabEl = null;
  let chatView = null;
  let settingsPanel = null;
  let avatarInitials = null;
  let avatarImg = null;
  let sidebarAvatarContent = null;
  const channelGateway = createChannelGateway(strings.channels, {
    chatStrings: strings.chat,
    getActivePersona: () => activePersona,
  });

  const agentGateway = createAgentGateway(strings.agents, {
    chatStrings: strings.chat,
    getActivePersona: () => activePersona,
  });

  const cleanupGateway = createCleanupGateway();

  const routeViews = new Map();
  const routeViewPromises = new Map();
  const tabElements = new Map();
  let navigationToken = 0;
  channelGateway.start();
  agentGateway.start();
  cleanupGateway.start();
  initSounds();

  const { initOfflineMonitor } = await import('../../Shared/OfflineMonitor/OfflineMonitor.js');
  initOfflineMonitor();

  const shell = createElement('main', 'chat-shell');
  const sidebar = createElement('nav', 'chat-sidebar');
  const sidebarTabs = createElement('div', 'chat-sidebar__tabs');
  const tabIndicator = createElement('div', 'chat-sidebar__indicator');
  const stage = createElement('section', 'chat-stage');
  const canvas = createElement('div', 'chat-stage__canvas');
  const dragRegion = createElement('div', 'chat-shell__drag-region');
  shell.append(dragRegion);

  function moveIndicatorToTab(tabEl, animate) {
    if (!tabEl) return;
    if (!animate) {
      tabIndicator.style.transition = 'none';
    }

    const tabsRect = sidebarTabs.getBoundingClientRect();
    const tabRect = tabEl.getBoundingClientRect();
    tabIndicator.style.top = `${tabRect.top - tabsRect.top}px`;
    tabIndicator.style.height = `${tabRect.height}px`;

    if (!animate) {
      tabIndicator.offsetHeight;
      tabIndicator.style.transition = '';
    }
  }

  function setActiveProject(project) {
    activeProject = project
      ? {
          id: project.id,
          name: project.name ?? '',
          icon: project.icon ?? '',
          info: project.info ?? '',
          folderPath: project.folderPath ?? project.rootPath ?? '',
          rootPath: project.rootPath ?? project.folderPath ?? '',
          coverImagePath: project.coverImagePath ?? '',
        }
      : null;

    chatView?.setActiveProject(activeProject);
  }

  function setActivePersona(persona) {
    activePersona = persona ?? null;
    chatView?.setActivePersona(activePersona);

    // Persist the choice — falling back to Joana when deactivated
    const ref = persona
      ? { namespace: persona.namespace, filename: persona.filename }
      : { namespace: 'Joanium', filename: 'Joana.md' };
    void invokeIpc('personas:set-active-persona', ref.namespace, ref.filename);
  }

  async function ensureChatView() {
    if (!chatView) {
      chatView = await createChatView(strings.chat, {
        getActiveProject: () => activeProject,
        onActiveProjectChange: setActiveProject,
        getActivePersona: () => activePersona,
        onActivePersonaChange: setActivePersona,
        getProfile: () => profile,
        onNavigate: showRoute,
        onOpenSettings: showSettingsPanel,
        onLockApp: lockNow,
      });
      canvas.append(chatView.element);
      routeViews.set('chat', {
        element: chatView.element,
        onShow: () => chatView.focusComposer(),
      });
    }

    return chatView;
  }

  function mountSearchListPanel(panel) {
    const element = panel.build();
    canvas.append(element);
    return {
      element,
      onShow: () => panel.populateList(element._listEl, element._search.getValue().trim()),
    };
  }

  const routeDefinitions = [
    {
      id: 'chat',
      icon: 'tabChat',
      create: async () => {
        await ensureChatView();
        return routeViews.get('chat');
      },
    },
    {
      id: 'history',
      icon: 'tabHistory',
      create: async () => {
        const panel = createHistoryPanel(strings.history, {
          onNewChat: async () => {
            const chat = await ensureChatView();
            chat.clearConversation();
            await showRoute('chat');
            chat.focusComposer();
          },
          onLoadSession: async (id) => {
            const chat = await ensureChatView();
            await chat.loadSession(id);
            await showRoute('chat');
            chat.focusComposer();
          },
          onForkSession: async (id) => {
            const chat = await ensureChatView();
            await chat.loadSession(id);
            await showRoute('chat');
            chat.focusComposer();
          },
          getCurrentSessionId: () => chatView?.getCurrentSessionId() ?? null,
          getActiveProject: () => activeProject,
        });
        const element = panel.build();
        canvas.append(element);
        return {
          element,
          onShow: async () => {
            element._search.clear();
            await panel.populateList(element._contentEl);
          },
        };
      },
    },
    {
      id: 'projects',
      icon: 'tabProjects',
      create: async () => {
        const panel = createProjectsPanel(strings.projects, {
          onOpenProject: async (project) => {
            setActiveProject(project);
            const chat = await ensureChatView();
            chat.clearConversation();
            await showRoute('chat');
            chat.focusComposer();
          },
          getActiveProject: () => activeProject,
        });
        return mountSearchListPanel(panel);
      },
    },
    {
      id: 'memory',
      icon: 'tabMemory',
      create: async () => {
        const panel = createMemoryPanel(strings.memory);
        const element = panel.build();
        canvas.append(element);
        return {
          element,
          onShow: () => panel.onShow(),
        };
      },
    },
    {
      id: 'templates',
      icon: 'tabTemplates',
      create: async () => {
        return mountSearchListPanel(createTemplatesPanel(strings.templates));
      },
    },
    {
      id: 'agents',
      icon: 'tabAgents',
      create: async () => {
        return mountSearchListPanel(createAgentsPanel(strings.agents));
      },
    },
    {
      id: 'skills',
      icon: 'tabSkills',
      create: async () => {
        return mountSearchListPanel(createSkillsPanel(strings.skills));
      },
    },
    {
      id: 'personas',
      icon: 'tabPersonas',
      create: async () => {
        const panel = createPersonasPanel(strings.personas, {
          getActivePersona: () => activePersona,
          onActivatePersona: setActivePersona,
        });
        return mountSearchListPanel(panel);
      },
    },
    {
      id: 'marketplace',
      icon: 'tabMarketplace',
      create: async () => {
        return mountSearchListPanel(createMarketplacePanel(strings.marketplace));
      },
    },
    {
      id: 'leaderboard',
      icon: 'tabLeaderboard',
      hideTab: true,
      create: async () => {
        return mountSearchListPanel(createLeaderboardPanel(strings.leaderboard));
      },
    },
    {
      id: 'events',
      icon: 'tabEvents',
      create: async () => {
        const panel = createEventsPanel(strings.events);
        const element = panel.build();
        canvas.append(element);
        return {
          element,
          onShow: () => panel.populate(),
        };
      },
    },
    {
      id: 'usage',
      icon: 'tabUsage',
      create: async () => {
        const panel = createUsagePanel(strings.usage);
        canvas.append(panel.element);
        return {
          element: panel.element,
          onShow: () => panel.onShow(),
        };
      },
    },
  ];

  const routeById = new Map(routeDefinitions.map((route) => [route.id, route]));
  if (!routeById.has(activeRouteId)) {
    activeRouteId = 'chat';
  }

  async function ensureRouteView(routeId) {
    if (routeViews.has(routeId)) {
      return routeViews.get(routeId);
    }

    if (routeViewPromises.has(routeId)) {
      return routeViewPromises.get(routeId);
    }

    const route = routeById.get(routeId);
    if (!route) {
      throw new Error(`Unknown route "${routeId}".`);
    }

    const viewPromise = route
      .create()
      .then((view) => {
        view.element.hidden = true;
        routeViews.set(routeId, view);
        return view;
      })
      .finally(() => {
        routeViewPromises.delete(routeId);
      });

    routeViewPromises.set(routeId, viewPromise);
    return viewPromise;
  }

  function hideAllViews() {
    for (const view of routeViews.values()) {
      view.element.hidden = true;
    }

    if (settingsPanel) {
      settingsPanel.hidden = true;
    }
  }

  function isSettingsOpen() {
    return Boolean(settingsPanel && !settingsPanel.hidden);
  }

  async function showRoute(routeId) {
    const nextRouteId = routeById.has(routeId) ? routeId : 'chat';
    const token = ++navigationToken;
    const view = await ensureRouteView(nextRouteId);

    if (token !== navigationToken) {
      return;
    }

    // Detach the native BrowserView before hiding the chat panel so it stops
    // painting over whatever panel the user is switching to.
    if (activeRouteId === 'chat' && nextRouteId !== 'chat') {
      chatView?.pauseBrowserPreview();
    }

    hideAllViews();
    view.element.hidden = false;
    activeRouteId = nextRouteId;
    sidebarAvatar.classList.remove('chat-sidebar__avatar--active');

    // Re-attach and re-sync the native BrowserView now that chat is visible.
    if (nextRouteId === 'chat') {
      chatView?.resumeBrowserPreview();
    }

    const tab = tabElements.get(nextRouteId);
    if (tab && tab !== activeTabEl) {
      activeTabEl?.classList.remove('chat-sidebar__tab--active');
      tab.classList.add('chat-sidebar__tab--active');
      activeTabEl = tab;
      moveIndicatorToTab(tab, true);
    }

    await view.onShow?.();
  }

  // ── Avatar sync ───────────────────────────────────────────────────────────
  // Keeps the sidebar button in sync with the current profile.
  // Shows a photo when profile.avatarPath is set; falls back to initials.

  function syncAvatar() {
    if (profile.avatarPath) {
      // Build a cache-busted URL so the browser reloads when the file changes
      // (the destination path is always Data/Avatar.<ext>).
      const src = toFileUrl(profile.avatarPath) + '?t=' + Date.now();

      if (avatarImg) {
        avatarImg.src = src;
      } else {
        // First time switching from initials → photo
        avatarImg = createElement('img', 'chat-sidebar__avatar-img');
        avatarImg.src = src;
        avatarImg.alt = '';
        sidebarAvatarContent.replaceChildren(avatarImg);
        avatarInitials = null;
      }
    } else {
      if (avatarImg) {
        // Switching from photo → initials
        avatarInitials = createElement(
          'span',
          'chat-sidebar__avatar-initials',
          getNameInitials(profile.name),
        );
        sidebarAvatarContent.replaceChildren(avatarInitials);
        avatarImg = null;
      } else if (avatarInitials) {
        // Just updating the name initials
        avatarInitials.textContent = getNameInitials(profile.name);
      }
    }
  }

  async function showSettingsPanel(initialSubMenu = 'user') {
    const token = ++navigationToken;

    if (activeRouteId === 'chat') {
      chatView?.pauseBrowserPreview();
    }

    hideAllViews();

    if (!settingsPanel) {
      settingsPanel = buildSettingsPanel();
      canvas.append(settingsPanel);
    }

    if (token !== navigationToken) {
      return;
    }

    settingsPanel.hidden = false;
    sidebarAvatar.classList.add('chat-sidebar__avatar--active');
    await settingsPanel._activateSubMenu?.(initialSubMenu);
  }

  function buildSettingsPanel() {
    const panel = createElement('div', 'chat-settings');
    const header = createElement('div', 'chat-settings__header');
    const body = createElement('div', 'chat-settings__body');
    const nav = createElement('nav', 'chat-settings__nav');
    const navItems = createElement('div', 'chat-settings__nav-items');
    const main = createElement('div', 'chat-settings__main');
    const mainHeading = createElement('h2', 'chat-settings__main-heading');

    const pageLabels = {
      user: strings.settings.nav.user,
      app: strings.settings.nav.app,
      memory: strings.settings.nav.memory,
      channels: strings.settings.nav.channels,
      connectors: strings.settings.nav.connectors,
      providers: strings.settings.nav.providers,
      appearance: strings.settings.nav.appearance,
      mcp: strings.settings.nav.mcp,
      shortcuts: strings.settings.nav.shortcuts,
      slashCommands: strings.settings.nav.slashCommands,
      security: strings.settings.nav.security,
      about: strings.settings.nav.about,
    };

    header.append(createElement('h2', 'chat-settings__title', strings.settings.title));

    async function activateSubMenu(id) {
      navItems.querySelectorAll('.chat-settings__nav-item').forEach((item) => {
        item.classList.toggle('chat-settings__nav-item--active', item._settingsSubId === id);
      });

      for (const child of Array.from(main.children)) {
        disposeElementTree(child);
      }

      mainHeading.textContent = pageLabels[id] ?? '';
      if (id === 'about') {
        main.replaceChildren();
      } else {
        main.replaceChildren(mainHeading);
      }

      if (id === 'user') {
        main.append(
          createUserPanel(strings.user, {
            getProfile: () => profile,
            onProfileSaved: (savedProfile) => {
              profile = savedProfile ?? profile;
              syncAvatar();
            },
            onAvatarChanged: (avatarPath) => {
              profile = { ...profile, avatarPath };
              syncAvatar();
            },
          }),
        );
      }

      if (id === 'app') {
        main.append(createAppSettingsPanel(strings.appSettings));
      }

      if (id === 'memory') {
        main.append(createMemorySettingsPanel(strings.appSettings));
      }

      if (id === 'channels') {
        const panel = createChannelsPanel(strings.channels);
        const element = panel.build();
        element.hidden = false;
        main.append(element);
        await panel.populate();
      }

      if (id === 'providers') {
        const panel = createProvidersPanel(strings.providers);
        main.append(panel.build());
        await panel.populate();
      }

      if (id === 'connectors') {
        const panel = createConnectorsPanel(strings.connectors);
        main.append(panel.build());
        await panel.populate();
      }

      if (id === 'shortcuts') {
        main.append(createShortcutsPanel(strings.shortcuts));
      }

      if (id === 'slashCommands') {
        main.append(await createSlashCommandsPanel(strings.slashCommands.panel));
      }

      if (id === 'appearance') {
        main.append(createThemePanel(strings.themes));
      }
      if (id === 'mcp') {
        main.append(createMCPPanel(strings.mcp));
      }
      if (id === 'security') {
        main.append(
          createSecurityPanel(strings.security, {
            onSecurityChanged: () => {
              void autoLockTimer.refresh();
            },
          }),
        );
      }

      if (id === 'about') {
        const aboutPanel = createAboutPanel(strings.about);
        main.append(aboutPanel.element);
        await aboutPanel.populate();
      }
    }

    for (const menu of [
      { id: 'user', label: strings.settings.nav.user, icon: iconMarkup.tabPersonas },
      { id: 'app', label: strings.settings.nav.app, icon: iconMarkup.power },
      { id: 'memory', label: strings.settings.nav.memory, icon: iconMarkup.tabMemory },
      { id: 'channels', label: strings.settings.nav.channels, icon: iconMarkup.tabChannels },
      { id: 'connectors', label: strings.settings.nav.connectors, icon: iconMarkup.network },
      { id: 'providers', label: strings.settings.nav.providers, icon: iconMarkup.verified },
      { id: 'appearance', label: strings.settings.nav.appearance, icon: iconMarkup.palette },
      { id: 'mcp', label: strings.settings.nav.mcp, icon: iconMarkup.network },
      { id: 'shortcuts', label: strings.settings.nav.shortcuts, icon: iconMarkup.keyboard },
      { id: 'slashCommands', label: strings.settings.nav.slashCommands, icon: iconMarkup.terminal },
      { id: 'security', label: strings.settings.nav.security, icon: iconMarkup.lock },
      { id: 'about', label: strings.settings.nav.about, icon: iconMarkup.info },
    ]) {
      const item = createElement('button', 'chat-settings__nav-item');
      item.type = 'button';
      item._settingsSubId = menu.id;
      const iconEl = createElement('span', 'chat-settings__nav-item-icon');
      iconEl.innerHTML = menu.icon;
      item.append(iconEl, createElement('span', 'chat-settings__nav-item-label', menu.label));
      item.addEventListener('click', () => {
        void activateSubMenu(menu.id);
      });
      navItems.append(item);
    }

    nav.append(navItems);
    body.append(nav, main);

    attachCustomScrollbar(body, main, { right: 8, top: 4, bottom: 4, minThumb: 24 });

    panel.append(header, body);
    panel._activateSubMenu = activateSubMenu;
    return panel;
  }

  sidebarTabs.append(tabIndicator);

  for (const route of routeDefinitions) {
    if (route.hideTab) continue;
    const isActive = route.id === activeRouteId;
    const tab = createElement(
      'button',
      `chat-sidebar__tab${isActive ? ' chat-sidebar__tab--active' : ''}`,
    );
    tab.type = 'button';
    tab.setAttribute('aria-label', strings.tabs[route.id]);
    tab.append(createIcon(route.icon, 'chat-sidebar__tab-icon'));
    tab.addEventListener('click', () => {
      void play('sidebar-click');

      if (route.id === activeRouteId && isSettingsOpen()) {
        void showRoute(route.id);
        return;
      }

      if (route.id !== activeRouteId || isSettingsOpen()) {
        void showRoute(route.id);
        return;
      }

      if (route.id === 'chat') {
        chatView?.clearConversation();
      }
    });

    tabElements.set(route.id, tab);
    if (isActive) {
      activeTabEl = tab;
    }
    sidebarTabs.append(tab);
  }

  const avatarDivider = createElement('div', 'chat-sidebar__avatar-divider');
  const sidebarAvatar = createElement('button', 'chat-sidebar__avatar');
  sidebarAvatar.type = 'button';
  sidebarAvatar.setAttribute('aria-label', strings.profile);
  const avatarProgress = createElement('span', 'chat-sidebar__avatar-progress');
  avatarProgress.setAttribute('aria-hidden', 'true');
  sidebarAvatarContent = createElement('span', 'chat-sidebar__avatar-content');

  // Initial render — show photo if we already have one, otherwise initials.
  if (profile.avatarPath) {
    avatarImg = createElement('img', 'chat-sidebar__avatar-img');
    avatarImg.src = toFileUrl(profile.avatarPath);
    avatarImg.alt = '';
    sidebarAvatarContent.append(avatarImg);
  } else {
    avatarInitials = createElement(
      'span',
      'chat-sidebar__avatar-initials',
      getNameInitials(profile.name),
    );
    sidebarAvatarContent.append(avatarInitials);
  }

  sidebarAvatar.append(avatarProgress, sidebarAvatarContent);

  function syncUpdateDownloadProgress(updateState) {
    const isDownloading = updateState?.status === 'downloading';
    const rawPercent = Number(updateState?.progress?.percent);
    const percent = Number.isFinite(rawPercent) ? Math.min(100, Math.max(0, rawPercent)) : 0;

    avatarProgress.style.setProperty('--download-progress', `${percent * 3.6}deg`);
    avatarProgress.classList.toggle('chat-sidebar__avatar-progress--visible', isDownloading);
  }

  syncUpdateDownloadProgress(appSettings.autoUpdateState);
  onIpc('auto-update:state', syncUpdateDownloadProgress);

  sidebarAvatar.addEventListener('click', () => {
    void play('sidebar-click');

    if (settingsPanel && !settingsPanel.hidden) {
      void showRoute(activeRouteId);
    } else {
      void showSettingsPanel();
    }
  });

  sidebarTabs.append(avatarDivider, sidebarAvatar);
  sidebar.append(sidebarTabs);
  stage.append(canvas);
  shell.append(sidebar, stage, dragRegion);
  root.replaceChildren(shell);

  // ── Memory sync indicator ─────────────────────────────────────────────────
  // Listens for EVENTS.MEMORY_SYNC events dispatched by ChatApp. When active,
  // adds a primary-color dot to the memory tab and swaps its aria-label to the sync
  // message so the existing CSS ::after tooltip shows the message on hover.
  {
    const memoryTab = tabElements.get('memory');
    let memoryTabOriginalLabel = memoryTab?.getAttribute('aria-label') ?? '';
    let memorySyncDot = null;

    window.addEventListener(EVENTS.MEMORY_SYNC, (event) => {
      if (!memoryTab) return;
      const { active, message } = event.detail ?? {};
      if (active) {
        if (!memorySyncDot) {
          memoryTabOriginalLabel = memoryTab.getAttribute('aria-label') ?? memoryTabOriginalLabel;
          memorySyncDot = createElement(
            'span',
            'chat-sidebar__status-dot chat-sidebar__memory-dot',
          );
          memoryTab.append(memorySyncDot);
        }
        memoryTab.setAttribute('aria-label', message ?? memoryTabOriginalLabel);
        memorySyncDot.setAttribute('aria-label', message ?? memoryTabOriginalLabel);
      } else {
        memoryTab.setAttribute('aria-label', memoryTabOriginalLabel);
        memorySyncDot?.remove();
        memorySyncDot = null;
      }
    });
  }

  {
    const agentsTab = tabElements.get('agents');
    const activeAgents = new Map();
    let agentsTabOriginalLabel = agentsTab?.getAttribute('aria-label') ?? '';
    let agentRunDot = null;

    function syncAgentRunIndicator() {
      if (!agentsTab) return;
      const names = [...activeAgents.values()].filter(Boolean);

      if (names.length > 0) {
        const label =
          names.length === 1
            ? formatText(strings.agents.gateway.runningLabel, { agent: names[0] })
            : formatText(strings.agents.gateway.runningManyLabel, { agents: names.join(', ') });
        if (!agentRunDot) {
          agentsTabOriginalLabel = agentsTab.getAttribute('aria-label') ?? agentsTabOriginalLabel;
          agentRunDot = createElement('span', 'chat-sidebar__status-dot chat-sidebar__agent-dot');
          agentsTab.append(agentRunDot);
        }
        agentRunDot.setAttribute('aria-label', label);
        return;
      }

      agentsTab.setAttribute('aria-label', agentsTabOriginalLabel);
      agentRunDot?.remove();
      agentRunDot = null;
    }

    window.addEventListener('joanium:agent-run', (event) => {
      if (!agentsTab) return;
      const detail = event.detail ?? {};
      const id = String(detail.id ?? '').trim();
      if (!id) return;

      if (detail.active) {
        activeAgents.set(
          id,
          collapseWhitespace(detail.name) || strings.agents.gateway.runningFallback,
        );
      } else {
        activeAgents.delete(id);
      }

      syncAgentRunIndicator();
    });
  }

  // Dismiss the boot loader now that the shell is in the DOM.
  // Fire-and-forget: fade out over 300ms then remove.
  const bootLoader = document.getElementById('boot-loader');
  if (bootLoader) {
    bootLoader.style.transition = 'opacity 300ms ease';
    bootLoader.style.opacity = '0';
    setTimeout(() => bootLoader.remove(), 300);
  }

  await showRoute(appSettings.defaultView ?? 'chat');
  requestAnimationFrame(() => moveIndicatorToTab(activeTabEl, false));

  // ── Birthday card ──────────────────────────────────────────────────────────
  // Checks today's date against the user's date of birth and shows a
  // celebratory overlay with confetti when it's a match. No-ops silently
  // when it isn't the user's birthday.
  mountBirthdayCard(strings.user.birthday, { profile });

  // Arm the auto-lock timer now that the shell is fully rendered.
  void autoLockTimer.refresh();

  // ── Spotlight search ────────────────────────────────────────────────
  // Global Ctrl+F / Cmd+F universal search overlay.
  const spotlightProviders = [
    {
      id: 'conversations',
      label: 'Conversations',
      search: async (query) => {
        try {
          const sessions = await invokeIpc(
            'history:search-sessions',
            query,
            activeProject?.id ?? null,
          );
          return (Array.isArray(sessions) ? sessions : []).slice(0, 8).map((s) => ({
            id: s.id,
            label: s.title || 'Untitled conversation',
            hint: s.snippet
              ? s.snippet.slice(0, 50)
              : s.updatedAt
                ? new Date(s.updatedAt).toLocaleDateString()
                : '',
            onSelect: async () => {
              const chat = await ensureChatView();
              await chat.loadSession(s.id);
              await showRoute('chat');
              chat.focusComposer();
            },
          }));
        } catch {
          return [];
        }
      },
    },
    {
      id: 'current-chat',
      label: 'Current Chat',
      search: async (query) => {
        const chatEl = routeViews.get('chat')?.element;
        if (!chatEl || chatEl.hidden) return [];
        const q = query.toLowerCase();
        const bubbles = chatEl.querySelectorAll('.chat-message__bubble');
        const results = [];
        for (const bubble of bubbles) {
          const text = bubble.textContent ?? '';
          if (text.toLowerCase().includes(q)) {
            const idx = text.toLowerCase().indexOf(q);
            const start = Math.max(0, idx - 30);
            const end = Math.min(text.length, idx + q.length + 50);
            let snippet = text.slice(start, end).trim();
            if (start > 0) snippet = `\u2026${snippet}`;
            if (end < text.length) snippet = `${snippet}\u2026`;
            const msgEl = bubble.closest('.chat-message');
            const isUser = msgEl?.classList.contains('chat-message--user');
            results.push({
              id: `chat-${results.length}`,
              label: snippet,
              hint: isUser ? 'You' : 'Assistant',
              onSelect: () => {
                msgEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                msgEl?.classList.add('chat-message--highlighted');
                setTimeout(() => msgEl?.classList.remove('chat-message--highlighted'), 2000);
              },
            });
          }
        }
        return results.slice(0, 6);
      },
    },
    {
      id: 'memory',
      label: 'Memory',
      search: async (query) => {
        try {
          const list = await invokeIpc('memory:list');
          const q = query.toLowerCase();
          return (Array.isArray(list) ? list : [])
            .filter(
              (m) =>
                String(m.filename ?? m.name ?? '')
                  .toLowerCase()
                  .includes(q) ||
                String(m.content ?? '')
                  .toLowerCase()
                  .includes(q),
            )
            .slice(0, 6)
            .map((m) => ({
              id: m.filename ?? m.name,
              label: m.filename ?? m.name ?? 'Memory',
              hint: 'Memory',
              onSelect: () => {
                void showRoute('memory');
              },
            }));
        } catch {
          return [];
        }
      },
    },
    {
      id: 'templates',
      label: 'Templates',
      search: async (query) => {
        try {
          const list = await invokeIpc('templates:list-templates');
          const q = query.toLowerCase();
          return (Array.isArray(list) ? list : [])
            .filter(
              (t) =>
                String(t.name ?? '')
                  .toLowerCase()
                  .includes(q) ||
                String(t.prompt ?? '')
                  .toLowerCase()
                  .includes(q),
            )
            .slice(0, 6)
            .map((t) => ({
              id: t.id ?? t.name,
              label: t.name ?? 'Template',
              hint: 'Template',
              onSelect: () => {
                void showRoute('templates');
              },
            }));
        } catch {
          return [];
        }
      },
    },
    {
      id: 'skills',
      label: 'Skills',
      search: async (query) => {
        try {
          const list = await invokeIpc('skills:list-skills');
          const q = query.toLowerCase();
          return (Array.isArray(list) ? list : [])
            .filter((s) =>
              String(s.name ?? '')
                .toLowerCase()
                .includes(q),
            )
            .slice(0, 6)
            .map((s) => ({
              id: s.filename ?? s.name,
              label: s.name ?? 'Skill',
              hint: 'Skill',
              onSelect: () => {
                void showRoute('skills');
              },
            }));
        } catch {
          return [];
        }
      },
    },
    {
      id: 'personas',
      label: 'Personas',
      search: async (query) => {
        try {
          const list = await invokeIpc('personas:list-personas');
          const q = query.toLowerCase();
          return (Array.isArray(list) ? list : [])
            .filter((p) =>
              String(p.name ?? '')
                .toLowerCase()
                .includes(q),
            )
            .slice(0, 6)
            .map((p) => ({
              id: p.filename ?? p.name,
              label: p.name ?? 'Persona',
              hint: 'Persona',
              onSelect: () => {
                void showRoute('personas');
              },
            }));
        } catch {
          return [];
        }
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      search: async (query) => {
        const pages = [
          { id: 'user', label: 'User Profile' },
          { id: 'app', label: 'App Settings' },
          { id: 'memory', label: 'Memory Settings' },
          { id: 'channels', label: 'Channels' },
          { id: 'connectors', label: 'Connectors' },
          { id: 'providers', label: 'Providers' },
          { id: 'appearance', label: 'Appearance' },
          { id: 'mcp', label: 'MCP Servers' },
          { id: 'shortcuts', label: 'Keyboard Shortcuts' },
          { id: 'slashCommands', label: 'Slash Commands' },
          { id: 'security', label: 'Security' },
          { id: 'about', label: 'About' },
        ];
        const q = query.toLowerCase();
        return pages
          .filter((p) => p.label.toLowerCase().includes(q))
          .slice(0, 6)
          .map((p) => ({
            id: `settings-${p.id}`,
            label: p.label,
            hint: 'Settings',
            onSelect: () => {
              void showSettingsPanel(p.id);
            },
          }));
      },
    },
    {
      id: 'navigate',
      label: 'Navigation',
      search: async (query) => {
        const routes = [
          { id: 'chat', label: 'Chat' },
          { id: 'history', label: 'Chat History' },
          { id: 'projects', label: 'Projects' },
          { id: 'memory', label: 'Memory' },
          { id: 'templates', label: 'Templates' },
          { id: 'agents', label: 'Agents' },
          { id: 'skills', label: 'Skills' },
          { id: 'personas', label: 'Personas' },
          { id: 'marketplace', label: 'Marketplace' },
          { id: 'events', label: 'Events' },
          { id: 'usage', label: 'Usage' },
        ];
        const q = query.toLowerCase();
        return routes
          .filter((r) => r.label.toLowerCase().includes(q))
          .slice(0, 5)
          .map((r) => ({
            id: `nav-${r.id}`,
            label: r.label,
            hint: 'Navigate',
            onSelect: () => {
              void showRoute(r.id);
            },
          }));
      },
    },
  ];

  const spotlight = createSpotlightSearch({
    providers: spotlightProviders,
  });
  document.body.append(spotlight.element);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // Registered after the initial route is shown so all route creators exist.
  // Ctrl+key and Ctrl+Shift+key combos fire regardless of focus so they work
  // even when the chat composer textarea is active.
  registerShortcuts([
    {
      id: 'newChat',
      combo: { ctrl: true, key: 'n' },
      handler: async () => {
        const chat = await ensureChatView();
        chat.clearConversation();
        await showRoute('chat');
        chat.focusComposer();
      },
    },
    {
      id: 'history',
      combo: { ctrl: true, key: 'h' },
      handler: () => {
        void showRoute('history');
      },
    },
    {
      id: 'events',
      combo: { ctrl: true, key: 'e' },
      handler: () => {
        void showRoute('events');
      },
    },
    {
      id: 'projects',
      combo: { ctrl: true, shift: true, key: 'r' },
      handler: () => {
        void showRoute('projects');
      },
    },
    {
      id: 'memory',
      combo: { ctrl: true, shift: true, key: 'm' },
      handler: () => {
        void showRoute('memory');
      },
    },
    {
      id: 'templates',
      combo: { ctrl: true, key: 't' },
      handler: () => {
        void showRoute('templates');
      },
    },
    {
      id: 'agents',
      combo: { ctrl: true, shift: true, key: 'g' },
      handler: () => {
        void showRoute('agents');
      },
    },
    {
      id: 'skills',
      combo: { ctrl: true, shift: true, key: 's' },
      handler: () => {
        void showRoute('skills');
      },
    },
    {
      id: 'personas',
      combo: { ctrl: true, shift: true, key: 'p' },
      handler: () => {
        void showRoute('personas');
      },
    },
    {
      id: 'marketplace',
      combo: { ctrl: true, key: 'm' },
      handler: () => {
        void showRoute('marketplace');
      },
    },
    {
      id: 'usage',
      combo: { ctrl: true, key: 'u' },
      handler: () => {
        void showRoute('usage');
      },
    },
    {
      id: 'lock',
      combo: { ctrl: true, key: 'l' },
      handler: () => {
        void lockNow();
      },
    },
    {
      id: 'settings',
      combo: { ctrl: true, key: ',' },
      handler: () => {
        void showSettingsPanel();
      },
    },
    {
      id: 'channels',
      combo: { ctrl: true, shift: true, key: 'l' },
      handler: () => {
        void showSettingsPanel('channels');
      },
    },
    {
      id: 'spotlight',
      combo: { ctrl: true, key: 'f' },
      handler: () => {
        spotlight.toggle();
      },
    },
  ]);
}

bootstrap().catch((error) => {
  console.error('[Joanium] Shell failed to boot:', error);
});
