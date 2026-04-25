/**
 * CompletionSound
 *
 * Plays a subtle notification chime when the AI finishes generating a response.
 * Only plays when:
 *   1. The completion sound setting is enabled.
 *   2. The response took longer than MIN_DURATION_MS (avoids chime for instant replies).
 *   3. The generation was NOT aborted by the user.
 *
 * Sound: Notification.mp3 by Universfield from Pixabay
 * https://pixabay.com/sound-effects/494255/
 *
 * NOTE: We intentionally do NOT gate on window focus — this is a desktop app and
 * the chime should play whether you are looking at the window or have alt-tabbed.
 * It is a completion signal, not an OS notification.
 */

// Path is relative to the HTML page (Packages/Pages/Chat/index.html),
// so ../../../ resolves to the project root.
const SOUND_PATH = '../../../Assets/Sounds/Notification.mp3';

// Only play if the response took longer than this — avoids noise for quick replies.
const MIN_DURATION_MS = 3_000;

const VOLUME = 1;

let _audio = null;
let _settingEnabled = true; // optimistic default; loaded from settings on first call

// Tracks whether the current generation was aborted, set in the catch block
// and read in finally so we only ever play once per generation.
let _aborted = false;

/** Pre-create the Audio object so it is ready to fire instantly. */
function _ensureAudio() {
  if (_audio) return;
  try {
    _audio = new Audio(SOUND_PATH);
    _audio.volume = VOLUME;
    _audio.preload = 'auto';
    // Eagerly trigger a load so autoplay policy is satisfied.
    _audio.load();
  } catch (err) {
    console.warn('[CompletionSound] Could not create Audio object:', err);
    _audio = null;
  }
}

/** Load (or refresh) the setting from main process. Non-blocking. */
async function _loadSetting() {
  try {
    const settings = await window.electronAPI?.invoke?.('get-app-settings');
    // Default true: absent value (existing users upgrading) → sound plays.
    _settingEnabled = settings?.completion_sound !== false;
  } catch {
    _settingEnabled = true;
  }
}

/**
 * Update the in-memory flag immediately — called from the Settings modal toggle
 * via the jo:completion-sound-changed event.
 */
export function setCompletionSoundEnabled(enabled) {
  _settingEnabled = Boolean(enabled);
}

/**
 * Call once from chat module init.
 */
export function initCompletionSound() {
  _ensureAudio();
  _loadSetting();

  // Reload setting when the settings modal saves (catches language/provider changes too).
  window.addEventListener('jo:settings-saved', () => {
    _loadSetting();
  });

  // Immediate update when the user flips the Completion Sound toggle.
  window.addEventListener('jo:completion-sound-changed', (e) => {
    _settingEnabled = Boolean(e.detail?.enabled);
  });
}

/**
 * Mark the current generation as aborted. Call this from the AbortError catch branch.
 * The paired playCompletionSound() call in finally will then be a no-op.
 */
export function markSoundAborted() {
  _aborted = true;
}

/**
 * Attempt to play the completion chime.
 * Always call this from the `finally` block — it is safe to call unconditionally.
 *
 * @param {number} startTimeMs  Date.now() captured at generation start.
 */
export function playCompletionSound(startTimeMs) {
  // Consume the abort flag first so it resets for the next generation.
  const wasAborted = _aborted;
  _aborted = false;

  if (wasAborted) return;
  if (!_settingEnabled) return;

  const elapsed = Date.now() - startTimeMs;
  if (elapsed < MIN_DURATION_MS) return;

  if (!_audio) {
    console.warn('[CompletionSound] Audio not initialised.');
    return;
  }

  _audio.currentTime = 0;
  _audio.play().catch((err) => {
    console.warn('[CompletionSound] play() failed:', err.message);
  });
}
