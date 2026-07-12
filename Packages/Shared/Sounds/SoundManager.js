import { invokeIpc } from '../Ipc/RendererIpc.js';

const SOUNDS = {
  'sidebar-click': { file: '../../../Assets/Sounds/SidebarClick.mp3', volume: 1 },
  completion: { file: '../../../Assets/Sounds/Notification.mp3', volume: 1 },
  type: { file: '../../../Assets/Sounds/Type.wav', volume: 1 },
};

const MIN_DURATION_MS = 3000;

const cache = new Map();
let completionAborted = false;
let soundEffectsEnabled = true;

async function refreshSoundEffectsSetting() {
  try {
    const settings = await invokeIpc('app-settings:get');
    soundEffectsEnabled = settings?.soundEffects !== false;
  } catch {
    soundEffectsEnabled = true;
  }
  return soundEffectsEnabled;
}

function ensure(name) {
  if (cache.has(name)) return cache.get(name);
  const def = SOUNDS[name];
  if (!def) return null;
  try {
    const url = new URL(def.file, import.meta.url).toString();
    const audio = new Audio(url);
    audio.volume = def.volume ?? 1;
    audio.preload = 'auto';
    audio.load();
    cache.set(name, audio);
    return audio;
  } catch {
    return null;
  }
}

export function initSounds() {
  for (const name of Object.keys(SOUNDS)) ensure(name);
  void refreshSoundEffectsSetting();
}

export async function play(name) {
  if (!(await refreshSoundEffectsSetting())) return;
  const s = ensure(name);
  if (!s) return;
  s.currentTime = 0;
  void s.play().catch(() => {});
}

export function markCompletionAborted() {
  completionAborted = true;
}

export async function playCompletion(startTimeMs) {
  const wasAborted = completionAborted;
  completionAborted = false;

  if (wasAborted || Date.now() - startTimeMs < MIN_DURATION_MS) return;
  if (!(await refreshSoundEffectsSetting())) return;

  const s = ensure('completion');
  if (!s) return;
  s.currentTime = 0;
  void s.play().catch(() => {});
}
