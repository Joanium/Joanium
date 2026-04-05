import { app, BrowserWindow } from 'electron';
import fs from 'fs';

import * as MCPIPC from '#features/MCP/IPC/MCPIPC.js';
import { boot, startEngines, stopEngines } from '#main/Boot.js';
import Paths from '#main/Core/Paths.js';
import { create as createWindow } from '#main/Core/Window.js';
import { BUILTIN_BROWSER_USER_AGENT } from '#main/Services/BrowserPreviewService.js';
import { isFirstRun } from '#main/Services/UserService.js';

app.commandLine.appendSwitch('disable-http2');
app.commandLine.appendSwitch('lang', 'en-US');
app.userAgentFallback = BUILTIN_BROWSER_USER_AGENT;

let engines = null;

app.whenReady().then(async () => {
  if (!fs.existsSync(Paths.DATA_DIR)) fs.mkdirSync(Paths.DATA_DIR, { recursive: true });
  if (!fs.existsSync(Paths.CHATS_DIR)) fs.mkdirSync(Paths.CHATS_DIR, { recursive: true });
  if (!fs.existsSync(Paths.PROJECTS_DIR)) fs.mkdirSync(Paths.PROJECTS_DIR, { recursive: true });
  if (!fs.existsSync(Paths.FEATURES_DATA_DIR))
    fs.mkdirSync(Paths.FEATURES_DATA_DIR, { recursive: true });

  engines = await boot();
  startEngines(engines);

  const { featureRegistry, channelEngine, browserPreviewService, agentsEngine } = engines;

  const startPage = isFirstRun() ? Paths.SETUP_PAGE : Paths.INDEX_PAGE;
  const mainWindow = createWindow(startPage);
  browserPreviewService.attachToWindow(mainWindow);
  channelEngine.setWindow(mainWindow);
  agentsEngine?.attachWindow?.(mainWindow);
  featureRegistry.attachWindow(mainWindow);

  MCPIPC.autoConnect().catch((err) => console.warn('[App] MCP auto-connect failed:', err.message));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow(isFirstRun() ? Paths.SETUP_PAGE : Paths.INDEX_PAGE);
      browserPreviewService.attachToWindow(win);
      channelEngine.setWindow(win);
      agentsEngine?.attachWindow?.(win);
      featureRegistry.attachWindow(win);
    }
  });
});

app.on('window-all-closed', () => {
  if (engines) stopEngines(engines);
  if (process.platform !== 'darwin') app.quit();
});
