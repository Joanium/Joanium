import { app, BrowserWindow, shell } from 'electron';
import * as MCPIPC from '#features/MCP/IPC/MCPIPC.js';
import { boot, startEngines, stopEngines } from '#main/Boot.js';
import { ensureDir } from '#main/Core/FileSystem.js';
import Paths from '#main/Core/Paths.js';
import { create as createWindow } from '#main/Core/Window.js';
import { BUILTIN_BROWSER_USER_AGENT } from '#main/Services/BrowserPreviewService.js';
import { initializeContentLibraries } from '#main/Services/ContentLibraryService.js';
import { initializePersonalMemoryLibrary } from '#main/Services/MemoryService.js';
import * as SystemPromptService from '#main/Services/SystemPromptService.js';
import * as UserService from '#main/Services/UserService.js';
import { setupAutoUpdates } from '#main/Services/AutoUpdateService.js';
(app.commandLine.appendSwitch('disable-http2'),
  app.commandLine.appendSwitch('lang', 'en-US'),
  (app.userAgentFallback = BUILTIN_BROWSER_USER_AGENT));
let engines = null,
  enginesStopped = !1;
const REQUIRED_RUNTIME_DIRS = Object.freeze([
  Paths.DATA_DIR,
  Paths.CHATS_DIR,
  Paths.PROJECTS_DIR,
  Paths.FEATURES_DATA_DIR,
  Paths.MEMORIES_DIR,
  Paths.USER_SKILLS_DIR,
  Paths.USER_PERSONAS_DIR,
]);
function attachWindowServices(windowRef, activeEngines) {
  if (!windowRef || !activeEngines) return;
  const {
    featureRegistry: featureRegistry,
    channelEngine: channelEngine,
    browserPreviewService: browserPreviewService,
    agentsEngine: agentsEngine,
  } = activeEngines;
  (browserPreviewService.attachToWindow(windowRef),
    channelEngine.setWindow(windowRef),
    agentsEngine?.attachWindow?.(windowRef),
    featureRegistry.attachWindow(windowRef));
}
function createMainAppWindow(
  activeEngines,
  page = (function () {
    return UserService.isFirstRun() ? Paths.SETUP_PAGE : Paths.INDEX_PAGE;
  })(),
) {
  const windowRef = createWindow(page);
  return (attachWindowServices(windowRef, activeEngines), windowRef);
}
function shutdownEngines() {
  if (engines && !enginesStopped)
    try {
      stopEngines(engines);
    } catch (error) {
      console.error('[App] Failed to stop engines cleanly:', error);
    } finally {
      ((engines = null), (enginesStopped = !0));
    }
}
(app.whenReady().then(async () => {
  try {
    app.on('web-contents-created', (_, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
      });
      contents.on('will-navigate', (event, url) => {
        try {
          const appOrigin = new URL(contents.getURL()).origin;
          if (new URL(url).origin !== appOrigin) {
            event.preventDefault();
            shell.openExternal(url);
          }
        } catch {
          event.preventDefault();
        }
      });
    });
    (app.isPackaged && !process.argv.includes('--dev') && setupAutoUpdates(),
      (function () {
        for (const dir of REQUIRED_RUNTIME_DIRS) ensureDir(dir);
      })(),
      createMainAppWindow(null),
      (async () => {
        (initializeContentLibraries(),
          initializePersonalMemoryLibrary(),
          (engines = await boot()),
          (enginesStopped = !1),
          startEngines(engines));
        for (const windowRef of BrowserWindow.getAllWindows())
          attachWindowServices(windowRef, engines);
        ((async function (activeEngines) {
          if (activeEngines?.connectorEngine && activeEngines?.featureRegistry)
            try {
              await SystemPromptService.get({
                user: UserService.readUser(),
                customInstructions: UserService.readText(Paths.CUSTOM_INSTRUCTIONS_FILE),
                connectorEngine: activeEngines.connectorEngine,
                featureRegistry: activeEngines.featureRegistry,
              });
            } catch (error) {
              console.warn('[App] System prompt warm-up failed:', error.message);
            }
        })(engines).catch(() => {}),
          (function () {
            for (const windowRef of BrowserWindow.getAllWindows())
              windowRef &&
                !windowRef.isDestroyed() &&
                windowRef.webContents?.send?.('backend-ready');
          })(),
          MCPIPC.autoConnect().catch((err) =>
            console.warn('[App] MCP auto-connect failed:', err.message),
          ));
      })().catch((error) => {
        (console.error('[App] Startup failed:', error), shutdownEngines(), app.quit());
      }),
      app.on('activate', () => {
        0 === BrowserWindow.getAllWindows().length && createMainAppWindow(engines);
      }));
  } catch (error) {
    (console.error('[App] Startup failed:', error), shutdownEngines(), app.quit());
  }
}),
  app.on('before-quit', shutdownEngines),
  app.on('window-all-closed', () => {
    'darwin' !== process.platform && (shutdownEngines(), app.quit());
  }));
