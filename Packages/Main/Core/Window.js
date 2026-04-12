import { BrowserWindow, shell, app } from 'electron';
import Paths from './Paths.js';
import { attachWindowStatePersistence, loadWindowState } from '../Services/WindowStateService.js';
let _win = null;
function applyPageWindowState(win, page, windowState = loadWindowState()) {
  if (win)
    return page === Paths.SETUP_PAGE
      ? (win.isFullScreen() && win.setFullScreen(!1), void win.maximize())
      : void (windowState.isFullScreen
          ? win.setFullScreen(!0)
          : (win.isFullScreen() && win.setFullScreen(!1),
            windowState.isMaximized
              ? win.maximize()
              : (win.isMaximized() && win.unmaximize(),
                windowState.bounds && win.setBounds(windowState.bounds))));
}
export function optimizeApp() {
  app.commandLine.appendSwitch('enable-features', 'BackForwardCache');
}
export function create(page) {
  const windowState = loadWindowState();
  return (
    (_win = new BrowserWindow({
      width: windowState.bounds.width,
      height: windowState.bounds.height,
      x: windowState.bounds.x,
      y: windowState.bounds.y,
      minWidth: 1100,
      minHeight: 720,
      frame: !1,
      titleBarStyle: 'hidden',
      backgroundColor: '#ffffff',
      show: !0,
      webPreferences: {
        preload: Paths.PRELOAD,
        contextIsolation: !0,
        nodeIntegration: !1,
        sandbox: !1,
        backgroundThrottling: !1,
      },
    })),
    _win.loadURL(`file://${page}`),
    applyPageWindowState(_win, page, windowState),
    setImmediate(() => {
      attachWindowStatePersistence(_win);
    }),
    _win.webContents.once('did-finish-load', () => {
      _win?.webContents.send('preload-pages', ['automations', 'agents', 'events', 'skills']);
    }),
    _win.webContents.setWindowOpenHandler(
      ({ url: url }) => (shell.openExternal(url), { action: 'deny' }),
    ),
    _win.webContents.on('before-input-event', (event, input) => {
      if (app.isPackaged) {
        const isReload = (input.control || input.meta) && 'r' === input.key.toLowerCase(),
          isDevTools =
            (input.control || input.meta) && input.shift && 'i' === input.key.toLowerCase(),
          isF5 = 'F5' === input.key,
          isF12 = 'F12' === input.key;
        (isReload || isDevTools || isF5 || isF12) && event.preventDefault();
      }
    }),
    _win
  );
}
export function get() {
  return _win;
}
export function loadPage(page) {
  if (!_win) return;
  if (page === Paths.SETUP_PAGE || page === Paths.INDEX_PAGE) {
    const windowState = loadWindowState();
    return (_win.loadURL(`file://${page}`), void applyPageWindowState(_win, page, windowState));
  }
  const pageKey = (function (filePath) {
    if (!filePath) return null;
    for (const key in PAGE_MAP) if (filePath.includes(key)) return PAGE_MAP[key];
    return null;
  })(page);
  pageKey && _win.webContents.send('navigate', pageKey);
}
const PAGE_MAP = {
  Automations: 'automations',
  Agents: 'agents',
  Events: 'events',
  Skills: 'skills',
  Personas: 'personas',
  Usage: 'usage',
  Chat: 'chat',
};
