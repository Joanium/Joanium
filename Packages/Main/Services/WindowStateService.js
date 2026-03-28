import fs from 'fs';
import { screen } from 'electron';
import Paths from '../Core/Paths.js';

const DEFAULT_BOUNDS = {
  width: 1100,
  height: 720,
};

const DEFAULT_STATE = {
  bounds: DEFAULT_BOUNDS,
  isMaximized: false,
  isFullScreen: false,
};

function ensureDataDir() {
  if (!fs.existsSync(Paths.DATA_DIR)) {
    fs.mkdirSync(Paths.DATA_DIR, { recursive: true });
  }
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function clampBounds(rawBounds = {}) {
  const primaryWorkArea = screen.getPrimaryDisplay().workArea;
  const width = Math.max(DEFAULT_BOUNDS.width, Math.round(rawBounds.width ?? DEFAULT_BOUNDS.width));
  const height = Math.max(DEFAULT_BOUNDS.height, Math.round(rawBounds.height ?? DEFAULT_BOUNDS.height));
  const probe = {
    x: Math.round(rawBounds.x ?? primaryWorkArea.x),
    y: Math.round(rawBounds.y ?? primaryWorkArea.y),
    width,
    height,
  };
  const display = screen.getDisplayMatching(probe);
  const workArea = display?.workArea ?? primaryWorkArea;
  const maxX = workArea.x + Math.max(0, workArea.width - width);
  const maxY = workArea.y + Math.max(0, workArea.height - height);
  const centeredX = Math.round(workArea.x + (workArea.width - width) / 2);
  const centeredY = Math.round(workArea.y + (workArea.height - height) / 2);

  return {
    width,
    height,
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
    if (!fs.existsSync(Paths.WINDOW_STATE_FILE)) {
      return { ...DEFAULT_STATE, bounds: { ...DEFAULT_BOUNDS } };
    }

    const raw = JSON.parse(fs.readFileSync(Paths.WINDOW_STATE_FILE, 'utf-8'));
    return {
      bounds: clampBounds(raw?.bounds ?? {}),
      isMaximized: raw?.isMaximized === true,
      isFullScreen: raw?.isFullScreen === true,
    };
  } catch {
    return { ...DEFAULT_STATE, bounds: { ...DEFAULT_BOUNDS } };
  }
}

function getPersistedBounds(win) {
  if (!win || win.isDestroyed()) return { ...DEFAULT_BOUNDS };

  const bounds =
    typeof win.getNormalBounds === 'function' && (win.isMaximized() || win.isFullScreen())
      ? win.getNormalBounds()
      : win.getBounds();

  return clampBounds(bounds);
}

function writeWindowState(win) {
  ensureDataDir();
  const nextState = {
    bounds: getPersistedBounds(win),
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
  };
  fs.writeFileSync(Paths.WINDOW_STATE_FILE, JSON.stringify(nextState, null, 2), 'utf-8');
}

export function attachWindowStatePersistence(win) {
  if (!win) return;

  let saveTimer = null;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      writeWindowState(win);
    }, 150);
  };

  const flushSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    writeWindowState(win);
  };

  win.on('resize', scheduleSave);
  win.on('move', scheduleSave);
  win.on('maximize', scheduleSave);
  win.on('unmaximize', scheduleSave);
  win.on('enter-full-screen', scheduleSave);
  win.on('leave-full-screen', scheduleSave);
  win.on('close', flushSave);
  win.on('closed', () => {
    if (saveTimer) clearTimeout(saveTimer);
  });
}
