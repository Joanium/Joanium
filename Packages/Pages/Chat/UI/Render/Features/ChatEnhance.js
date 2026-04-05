import { fetchWithTools } from '../../../../../Features/AI/index.js';
import { modelDropdown } from '../../../../Shared/Core/DOM.js';

/**
 * Block all interaction inside the composer (model switcher, buttons, textarea, attachment actions).
 * Prefers `inert` when available; otherwise toggles disabled on buttons and textarea with restore.
 *
 * @param {HTMLElement | null | undefined} inputBox
 * @param {HTMLTextAreaElement | null | undefined} textarea
 * @returns {() => void} Call to unlock.
 */
function lockComposerDuringEnhance(inputBox, textarea) {
  modelDropdown?.classList.remove('open');

  if (!inputBox) {
    if (textarea) textarea.disabled = true;
    return () => {
      if (textarea) textarea.disabled = false;
    };
  }

  if (typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype) {
    inputBox.inert = true;
    if (textarea) textarea.disabled = true;
    return () => {
      inputBox.inert = false;
      if (textarea) textarea.disabled = false;
    };
  }

  const controls = inputBox.querySelectorAll('button, textarea');
  /** @type {Map<Element, boolean>} */
  const prevDisabled = new Map();
  controls.forEach((el) => {
    prevDisabled.set(el, el.disabled);
    el.disabled = true;
  });
  return () => {
    prevDisabled.forEach((was, el) => {
      el.disabled = was;
    });
  };
}

/**
 * Initialise the ✨ Enhance prompt button feature.
 *
 * @param {{ textarea: HTMLTextAreaElement, enhanceBtn: HTMLButtonElement, state: object }} options
 * @returns {{ cleanup: Function }}
 */
export function createEnhanceFeature({ textarea, enhanceBtn, state }) {
  const inputBox = textarea?.closest('.input-box');
  /** @type {(() => void) | null} */
  let enhanceUnlock = null;

  function updateEnhanceBtn() {
    if (!enhanceBtn || !textarea) return;
    const has = textarea.value.trim().length > 0;
    enhanceBtn.classList.toggle('enhance-active', has && !state.isTyping);
    enhanceBtn.disabled = !has || state.isTyping;
  }

  async function handleEnhance() {
    if (
      !textarea?.value.trim() ||
      state.isTyping ||
      !state.selectedProvider ||
      !state.selectedModel
    )
      return;
    enhanceBtn.classList.remove('enhance-active');
    enhanceBtn.classList.add('enhance-loading');
    enhanceBtn.disabled = true;
    inputBox?.classList.add('input-box--enhancing');
    inputBox?.setAttribute('aria-busy', 'true');
    const hadFocus = document.activeElement === textarea;
    enhanceUnlock = lockComposerDuringEnhance(inputBox, textarea);
    const labelEl = enhanceBtn.querySelector('.enhance-btn-label');
    if (labelEl) labelEl.textContent = 'Enhancing...';
    try {
      const result = await fetchWithTools(
        state.selectedProvider,
        state.selectedModel,
        [{ role: 'user', content: textarea.value.trim(), attachments: [] }],
        [
          'You are a prompt-enhancement assistant. Rewrite the user message into one clearer prompt they can send as-is.',
          'Keep the same goal and tone. Do not change "do this for me" into "explain how I could do it" unless they asked for an explanation.',
          'If they want something run, fixed, or opened (e.g. local dev server, URL in browser), keep it action-directed: ask the assistant to inspect the repo, pick the right commands, run them, read terminal output for the URL, and open it — not to quiz the user on stack (React vs static vs Flask) or paste multi-branch tutorials.',
          'Do not add rhetorical questions back to the user, "which type are you?", or long option lists unless the original message explicitly asked for choices.',
          'Stay concise: similar length or modestly longer than the original; never replace a short ask with a long lecture.',
          'Return ONLY the enhanced prompt — no preamble, quotes, or labels.',
        ].join(' '),
        [],
      );
      if (result.type === 'text' && result.text && result.text !== '(empty response)') {
        textarea.value = result.text;
        textarea.dispatchEvent(new Event('input'));
      }
    } catch (err) {
      console.warn('[Chat] Enhance failed:', err.message);
    } finally {
      enhanceBtn.classList.remove('enhance-loading');
      inputBox?.classList.remove('input-box--enhancing');
      inputBox?.removeAttribute('aria-busy');
      enhanceUnlock?.();
      enhanceUnlock = null;
      if (hadFocus) textarea.focus();
      if (labelEl) labelEl.textContent = 'Enhance';
      updateEnhanceBtn();
    }
  }

  enhanceBtn?.addEventListener('click', handleEnhance);
  textarea?.addEventListener('input', updateEnhanceBtn);
  updateEnhanceBtn();

  return {
    /** Call when the page unmounts to remove listeners. */
    cleanup() {
      enhanceBtn?.removeEventListener('click', handleEnhance);
      textarea?.removeEventListener('input', updateEnhanceBtn);
      inputBox?.classList.remove('input-box--enhancing');
      inputBox?.removeAttribute('aria-busy');
      enhanceUnlock?.();
      enhanceUnlock = null;
      if (inputBox && 'inert' in HTMLElement.prototype) inputBox.inert = false;
      if (textarea) textarea.disabled = false;
    },
  };
}
