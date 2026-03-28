// ─────────────────────────────────────────────
//  App.js  (main process entry point)
//
//  This file is intentionally thin. All business logic
//  lives in Packages/Main/. Add features by:
//    1. Creating a service in Packages/Main/Services/
//    2. Creating an IPC handler file in Packages/Main/IPC/
//    3. Registering it below.
// ─────────────────────────────────────────────

import { app, BrowserWindow } from 'electron';
import fs from 'fs';

// ── Infrastructure ────────────────────────────────────────────────────
import Paths                from './Packages/Main/Core/Paths.js';
import { create as createWindow } from './Packages/Main/Core/Window.js';
import { isFirstRun }       from './Packages/Main/Services/UserService.js';
import { AutomationEngine } from './Packages/Automation/Core/AutomationEngine.js';
import { ConnectorEngine }  from './Packages/Connectors/Core/ConnectorEngine.js';
import { AgentsEngine }  from './Packages/Agents/Core/AgentsEngine.js';
import { ChannelEngine } from './Packages/Channels/Core/ChannelEngine.js';

// ── IPC handler modules ───────────────────────────────────────────────
import * as SetupIPC      from './Packages/Main/IPC/SetupIPC.js';
import * as UserIPC       from './Packages/Main/IPC/UserIPC.js';
import * as SystemIPC     from './Packages/Main/IPC/SystemIPC.js';
import * as ChatIPC       from './Packages/Main/IPC/ChatIPC.js';
import * as ProjectIPC    from './Packages/Main/IPC/ProjectIPC.js';
import * as AutomationIPC from './Packages/Main/IPC/AutomationIPC.js';
import * as ConnectorIPC  from './Packages/Main/IPC/ConnectorIPC.js';
import * as GmailIPC      from './Packages/Main/IPC/GmailIPC.js';
import * as GithubIPC     from './Packages/Main/IPC/GithubIPC.js';
import * as WindowIPC     from './Packages/Main/IPC/WindowIPC.js';
import * as SkillsIPC     from './Packages/Main/IPC/SkillsIPC.js';
import * as PersonasIPC   from './Packages/Main/IPC/PersonasIPC.js';
import * as UsageIPC      from './Packages/Main/IPC/UsageIPC.js';
import * as AgentsIPC    from './Packages/Main/IPC/AgentsIPC.js';
import * as TerminalIPC   from './Packages/Main/IPC/TerminalIPC.js';
import * as MCPIPC        from './Packages/Main/IPC/MCPIPC.js';
import * as BrowserPreviewIPC from './Packages/Main/IPC/BrowserPreviewIPC.js';
import * as ChannelsIPC   from './Packages/Main/IPC/ChannelsIPC.js';
import {
  BUILTIN_BROWSER_USER_AGENT,
  getBrowserPreviewService,
} from './Packages/Main/Services/BrowserPreviewService.js';

/* ══════════════════════════════════════════
   ENGINES  (module-level refs, instantiated inside whenReady)
══════════════════════════════════════════ */
let automationEngine = null;
let agentsEngine     = null;
let channelEngine    = null;

// Keep the in-app browser closer to a regular desktop Chrome profile for sites that
// are picky about Electron defaults or break under HTTP/2.
app.commandLine.appendSwitch('disable-http2');
app.commandLine.appendSwitch('lang', 'en-US');
app.userAgentFallback = BUILTIN_BROWSER_USER_AGENT;

/* ══════════════════════════════════════════
   APP LIFECYCLE
══════════════════════════════════════════ */
app.whenReady().then(async () => {
  // Ensure required directories exist before anything else
  if (!fs.existsSync(Paths.DATA_DIR))  fs.mkdirSync(Paths.DATA_DIR,  { recursive: true });
  if (!fs.existsSync(Paths.CHATS_DIR)) fs.mkdirSync(Paths.CHATS_DIR, { recursive: true });
  if (!fs.existsSync(Paths.PROJECTS_DIR)) fs.mkdirSync(Paths.PROJECTS_DIR, { recursive: true });

  // ── Engines (created here so module parse stays instant) ────────────────
  const connectorEngine  = new ConnectorEngine(Paths.CONNECTORS_FILE);
  automationEngine = new AutomationEngine(Paths.AUTOMATIONS_FILE, connectorEngine);
  agentsEngine     = new AgentsEngine(Paths.AGENTS_FILE, connectorEngine);
  channelEngine    = new ChannelEngine(Paths.CHANNELS_FILE);

  // ── IPC registration ─────────────────────────────────────────────────────
  SetupIPC.register();
  UserIPC.register();
  SystemIPC.register(connectorEngine);
  ChatIPC.register();
  ProjectIPC.register();
  AutomationIPC.register(automationEngine);
  ConnectorIPC.register(connectorEngine);
  GmailIPC.register(connectorEngine);
  GithubIPC.register(connectorEngine);
  WindowIPC.register();
  BrowserPreviewIPC.register(getBrowserPreviewService());
  SkillsIPC.register();
  PersonasIPC.register();
  UsageIPC.register();
  AgentsIPC.register(agentsEngine, automationEngine);
  TerminalIPC.register();
  MCPIPC.register();
  ChannelsIPC.register(channelEngine);

  automationEngine.start();
  agentsEngine.start();
  channelEngine.start();

  // Show the window immediately — don't block on MCP
  const startPage = isFirstRun() ? Paths.SETUP_PAGE : Paths.INDEX_PAGE;
  const mainWindow = createWindow(startPage);
  getBrowserPreviewService().attachToWindow(mainWindow);

  // Hand the window reference to the channel engine so it can
  // dispatch incoming messages to the renderer's full AI pipeline
  channelEngine.setWindow(mainWindow);

  // MCP auto-connect runs in the background AFTER the window is up
  MCPIPC.autoConnect().catch(err => {
    console.warn('[App] MCP auto-connect failed:', err.message);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow(isFirstRun() ? Paths.SETUP_PAGE : Paths.INDEX_PAGE);
      getBrowserPreviewService().attachToWindow(win);
    }
  });
});

app.on('window-all-closed', () => {
  automationEngine?.stop();
  agentsEngine?.stop();
  channelEngine?.stop();
  if (process.platform !== 'darwin') app.quit();
});
