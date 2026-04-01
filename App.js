import { app, BrowserWindow } from 'electron';
import fs from 'fs';

import Paths from './Packages/Main/Core/Paths.js';
import { create as createWindow } from './Packages/Main/Core/Window.js';
import { isFirstRun } from './Packages/Main/Services/UserService.js';
import { AutomationEngine } from './Packages/Features/Automation/Core/AutomationEngine.js';
import { ConnectorEngine } from './Packages/Features/Connectors/Core/ConnectorEngine.js';
import { AgentsEngine } from './Packages/Features/Agents/Core/AgentsEngine.js';
import { ChannelEngine } from './Packages/Features/Channels/Core/ChannelEngine.js';
import FeatureRegistry from './Packages/Capabilities/Core/FeatureRegistry.js';

import * as SetupIPC from './Packages/Main/IPC/SetupIPC.js';
import * as UserIPC from './Packages/Main/IPC/UserIPC.js';
import * as SystemIPC from './Packages/Main/IPC/SystemIPC.js';
import * as ChatIPC from './Packages/Main/IPC/ChatIPC.js';
import * as ProjectIPC from './Packages/Main/IPC/ProjectIPC.js';
import * as AutomationIPC from './Packages/Main/IPC/AutomationIPC.js';
import * as ConnectorIPC from './Packages/Main/IPC/ConnectorIPC.js';
import * as FeatureIPC from './Packages/Main/IPC/FeatureIPC.js';
import * as WindowIPC from './Packages/Main/IPC/WindowIPC.js';
import * as SkillsIPC from './Packages/Main/IPC/SkillsIPC.js';
import * as PersonasIPC from './Packages/Main/IPC/PersonasIPC.js';
import * as UsageIPC from './Packages/Main/IPC/UsageIPC.js';
import * as AgentsIPC from './Packages/Main/IPC/AgentsIPC.js';
import * as TerminalIPC from './Packages/Main/IPC/TerminalIPC.js';
import * as MCPIPC from './Packages/Main/IPC/MCPIPC.js';
import * as BrowserPreviewIPC from './Packages/Main/IPC/BrowserPreviewIPC.js';
import * as ChannelsIPC from './Packages/Main/IPC/ChannelsIPC.js';
import { BUILTIN_BROWSER_USER_AGENT, getBrowserPreviewService } from './Packages/Main/Services/BrowserPreviewService.js';
import { invalidate as invalidateSystemPrompt } from './Packages/Main/Services/SystemPromptService.js';

let automationEngine = null;
let agentsEngine = null;
let channelEngine = null;
let featureRegistry = null;

app.commandLine.appendSwitch('disable-http2');
app.commandLine.appendSwitch('lang', 'en-US');
app.userAgentFallback = BUILTIN_BROWSER_USER_AGENT;

app.whenReady().then(async () => {
  if (!fs.existsSync(Paths.DATA_DIR)) fs.mkdirSync(Paths.DATA_DIR, { recursive: true });
  if (!fs.existsSync(Paths.CHATS_DIR)) fs.mkdirSync(Paths.CHATS_DIR, { recursive: true });
  if (!fs.existsSync(Paths.PROJECTS_DIR)) fs.mkdirSync(Paths.PROJECTS_DIR, { recursive: true });
  if (!fs.existsSync(Paths.FEATURES_DATA_DIR)) fs.mkdirSync(Paths.FEATURES_DATA_DIR, { recursive: true });

  featureRegistry = await FeatureRegistry.load(Paths.FEATURES_DIR);

  const connectorEngine = new ConnectorEngine(Paths.CONNECTORS_FILE, featureRegistry);
  featureRegistry.setBaseContext({
    connectorEngine,
    paths: Paths,
    invalidateSystemPrompt,
  });

  automationEngine = new AutomationEngine(Paths.AUTOMATIONS_FILE, connectorEngine, featureRegistry);
  agentsEngine = new AgentsEngine(Paths.AGENTS_FILE, connectorEngine, featureRegistry);
  channelEngine = new ChannelEngine(Paths.CHANNELS_FILE);

  SetupIPC.register();
  UserIPC.register();
  SystemIPC.register(connectorEngine, featureRegistry);
  ChatIPC.register();
  ProjectIPC.register();
  AutomationIPC.register(automationEngine);
  ConnectorIPC.register(connectorEngine, featureRegistry);
  FeatureIPC.register(featureRegistry);
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

  const startPage = isFirstRun() ? Paths.SETUP_PAGE : Paths.INDEX_PAGE;
  const mainWindow = createWindow(startPage);
  getBrowserPreviewService().attachToWindow(mainWindow);
  channelEngine.setWindow(mainWindow);
  featureRegistry.attachWindow(mainWindow);

  MCPIPC.autoConnect().catch(err => console.warn('[App] MCP auto-connect failed:', err.message));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow(isFirstRun() ? Paths.SETUP_PAGE : Paths.INDEX_PAGE);
      getBrowserPreviewService().attachToWindow(win);
      channelEngine.setWindow(win);
      featureRegistry.attachWindow(win);
    }
  });
});

app.on('window-all-closed', () => {
  automationEngine?.stop();
  agentsEngine?.stop();
  channelEngine?.stop();
  if (process.platform !== 'darwin') app.quit();
});
