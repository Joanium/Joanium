import { speakIcon, pauseIcon } from '../Features/UI/ChatIcons.js';

// ---------------------------------------------------------------------------
// Text cleaning — strip everything the user shouldn't hear
// ---------------------------------------------------------------------------

function stripForSpeech(markdown) {
  return (
    String(markdown ?? '')
      // Fenced code blocks (``` ... ```)
      .replace(/```[\s\S]*?```/g, ' ')
      // Inline code (`...`)
      .replace(/`[^`]*`/g, ' ')
      // Markdown headers (# ## ###)
      .replace(/^#{1,6}\s+/gm, '')
      // Bold/italic (**text**, *text*, __text__, _text_)
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // Blockquotes
      .replace(/^>\s+/gm, '')
      // Horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // Markdown links — keep the label, drop the URL
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // Bare URLs
      .replace(/https?:\/\/\S+/g, '')
      // HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Bullet / numbered list markers
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      // Collapse whitespace
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim()
  );
}

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let _activeBtn = null; // the button currently playing / paused
let _isPaused = false; // true when speechSynthesis is paused

function _resetActiveBtn() {
  if (_activeBtn) {
    _activeBtn.innerHTML = speakIcon();
    _activeBtn.title = 'Speak';
    _activeBtn.classList.remove('speak-btn--active');
    _activeBtn = null;
  }
  _isPaused = false;
}

function _onEnd() {
  _resetActiveBtn();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Toggle speech for a given assistant message.
 *
 * - Same button clicked while playing  → pause
 * - Same button clicked while paused   → resume
 * - Different button clicked           → cancel previous, start new
 *
 * @param {string} text  Raw markdown text of the message.
 * @param {HTMLElement} btn  The speak button element.
 */
export function toggleSpeak(text, btn) {
  const synth = window.speechSynthesis;
  if (!synth) return;

  // Toggle pause / resume on the SAME active button
  if (_activeBtn === btn) {
    if (_isPaused) {
      synth.resume();
      _isPaused = false;
      btn.innerHTML = pauseIcon();
      btn.title = 'Pause';
    } else {
      synth.pause();
      _isPaused = true;
      btn.innerHTML = speakIcon();
      btn.title = 'Resume';
    }
    return;
  }

  // Cancel whatever was running before (different message)
  synth.cancel();
  _resetActiveBtn();

  const cleanText = stripForSpeech(text);
  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.onend = _onEnd;
  utterance.onerror = _onEnd;

  _activeBtn = btn;
  _isPaused = false;
  btn.innerHTML = pauseIcon();
  btn.title = 'Pause';
  btn.classList.add('speak-btn--active');

  synth.speak(utterance);
}

/**
 * Stop all speech immediately. Call on page unmount / new chat.
 */
export function cancelSpeak() {
  window.speechSynthesis?.cancel();
  _resetActiveBtn();
}
