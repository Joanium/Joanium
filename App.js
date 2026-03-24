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
import Paths                from './Packages/Main/Paths.js';
import { create as createWindow } from './Packages/Main/Window.js';
import { isFirstRun }       from './Packages/Main/Services/UserService.js';
import { AutomationEngine } from './Packages/Automation/AutomationEngine.js';
import { ConnectorEngine }  from './Packages/Connectors/ConnectorEngine.js';
import { AgentsEngine }  from './Packages/Agents/AgentsEngine.js';

// ── IPC handler modules ───────────────────────────────────────────────
import * as SetupIPC      from './Packages/Main/IPC/SetupIPC.js';
import * as UserIPC       from './Packages/Main/IPC/UserIPC.js';
import * as SystemIPC     from './Packages/Main/IPC/SystemIPC.js';
import * as ChatIPC       from './Packages/Main/IPC/ChatIPC.js';
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

/* ══════════════════════════════════════════
   ENGINES  (singletons shared across IPC modules)
══════════════════════════════════════════ */
const connectorEngine  = new ConnectorEngine(Paths.CONNECTORS_FILE);
const automationEngine = new AutomationEngine(Paths.AUTOMATIONS_FILE, connectorEngine);
const agentsEngine = new AgentsEngine(Paths.AGENTS_FILE, connectorEngine);

/* ══════════════════════════════════════════
   IPC REGISTRATION
   Each module gets exactly the dependencies it needs.
══════════════════════════════════════════ */
SetupIPC.register();
UserIPC.register();
SystemIPC.register(connectorEngine);
ChatIPC.register();
AutomationIPC.register(automationEngine);
ConnectorIPC.register(connectorEngine);
GmailIPC.register(connectorEngine);
GithubIPC.register(connectorEngine);
WindowIPC.register();
SkillsIPC.register();
PersonasIPC.register();
UsageIPC.register();
AgentsIPC.register(agentsEngine, automationEngine);
TerminalIPC.register();
MCPIPC.register();

/* ══════════════════════════════════════════
   APP LIFECYCLE
══════════════════════════════════════════ */
app.whenReady().then(async () => {
  // Ensure required directories exist before anything else
  if (!fs.existsSync(Paths.DATA_DIR))  fs.mkdirSync(Paths.DATA_DIR,  { recursive: true });
  if (!fs.existsSync(Paths.CHATS_DIR)) fs.mkdirSync(Paths.CHATS_DIR, { recursive: true });

  await MCPIPC.autoConnect().catch(err => {
    console.warn('[App] MCP auto-connect failed:', err.message);
  });

  automationEngine.start();
  agentsEngine.start();

  const startPage = isFirstRun() ? Paths.SETUP_PAGE : Paths.MAIN_PAGE;
  createWindow(startPage);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow(isFirstRun() ? Paths.SETUP_PAGE : Paths.MAIN_PAGE);
  });
});

app.on('window-all-closed', () => {
  automationEngine.stop();
  agentsEngine.stop();
  if (process.platform !== 'darwin') app.quit();
});
