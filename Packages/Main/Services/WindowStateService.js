import { screen } from 'electron';
import { ensureParentDir, loadJson, persistJson } from '../Core/FileSystem.js';
import Paths from '../Core/Paths.js';
const DEFAULT_BOUNDS = { width: 1100, height: 720 },
  DEFAULT_STATE = { bounds: DEFAULT_BOUNDS, isMaximized: !1, isFullScreen: !1 };
function createDefaultState() {
  return { ...DEFAULT_STATE, bounds: { ...DEFAULT_BOUNDS } };
}
function isFiniteNumber(value) {
  return Number.isFinite(value);
}
function clampBounds(rawBounds = {}) {
  const primaryWorkArea = screen.getPrimaryDisplay().workArea,
    width = Math.max(DEFAULT_BOUNDS.width, Math.round(rawBounds.width ?? DEFAULT_BOUNDS.width)),
    height = Math.max(DEFAULT_BOUNDS.height, Math.round(rawBounds.height ?? DEFAULT_BOUNDS.height)),
    probe = {
      x: Math.round(rawBounds.x ?? primaryWorkArea.x),
      y: Math.round(rawBounds.y ?? primaryWorkArea.y),
      width: width,
      height: height,
    },
    display = screen.getDisplayMatching(probe),
    workArea = display?.workArea ?? primaryWorkArea,
    maxX = workArea.x + Math.max(0, workArea.width - width),
    maxY = workArea.y + Math.max(0, workArea.height - height),
    centeredX = Math.round(workArea.x + (workArea.width - width) / 2),
    centeredY = Math.round(workArea.y + (workArea.height - height) / 2);
  return {
    width: width,
    height: height,
    x: isFiniteNumber(rawBounds.x)
      ? Math.min(Math.max(Math.round(rawBounds.x), workArea.x), maxX)
      : centeredX,
    y: isFiniteNumber(rawBounds.y)
      ? Math.min(Math.max(Math.round(rawBounds.y), workArea.y), maxY)
      : centeredY,
  };
}
export function loadWindowState() {
  try {
    const raw = loadJson(Paths.WINDOW_STATE_FILE, null);
    return raw
      ? {
          bounds: clampBounds(raw?.bounds ?? {}),
          isMaximized: !0 === raw?.isMaximized,
          isFullScreen: !0 === raw?.isFullScreen,
        }
      : createDefaultState();
  } catch {
    return createDefaultState();
  }
}
function getPersistedBounds(win) {
  return !win || win.isDestroyed()
    ? { ...DEFAULT_BOUNDS }
    : clampBounds(
        'function' == typeof win.getNormalBounds && (win.isMaximized() || win.isFullScreen())
          ? win.getNormalBounds()
          : win.getBounds(),
      );
}
function writeWindowState(win) {
  ensureParentDir(Paths.WINDOW_STATE_FILE);
  const nextState = {
    bounds: getPersistedBounds(win),
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
  };
  persistJson(Paths.WINDOW_STATE_FILE, nextState);
}
export function attachWindowStatePersistence(win) {
  if (!win) return;
  let saveTimer = null;
  const scheduleSave = () => {
    (saveTimer && clearTimeout(saveTimer),
      (saveTimer = setTimeout(() => {
        ((saveTimer = null), writeWindowState(win));
      }, 150)));
  };
  (win.on('resize', scheduleSave),
    win.on('move', scheduleSave),
    win.on('maximize', scheduleSave),
    win.on('unmaximize', scheduleSave),
    win.on('enter-full-screen', scheduleSave),
    win.on('leave-full-screen', scheduleSave),
    win.on('close', () => {
      (saveTimer && (clearTimeout(saveTimer), (saveTimer = null)), writeWindowState(win));
    }),
    win.on('closed', () => {
      saveTimer && clearTimeout(saveTimer);
    }));
}
