import { fetchWithTools } from '../../../../../Features/AI/index.js';
import { modelDropdown } from '../../../../Shared/Core/DOM.js';
export function createEnhanceFeature({ textarea: textarea, enhanceBtn: enhanceBtn, state: state }) {
  const inputBox = textarea?.closest('.input-box');
  let enhanceUnlock = null;
  function updateEnhanceBtn() {
    if (!enhanceBtn || !textarea) return;
    const has = textarea.value.trim().length > 0;
    (enhanceBtn.classList.toggle('enhance-active', has && !state.isTyping),
      (enhanceBtn.disabled = !has || state.isTyping));
  }
  async function handleEnhance() {
    if (
      !textarea?.value.trim() ||
      state.isTyping ||
      !state.selectedProvider ||
      !state.selectedModel
    )
      return;
    (enhanceBtn.classList.remove('enhance-active'),
      enhanceBtn.classList.add('enhance-loading'),
      (enhanceBtn.disabled = !0),
      inputBox?.classList.add('input-box--enhancing'),
      inputBox?.setAttribute('aria-busy', 'true'));
    const hadFocus = document.activeElement === textarea;
    enhanceUnlock = (function (inputBox, textarea) {
      if ((modelDropdown?.classList.remove('open'), !inputBox))
        return (
          textarea && (textarea.disabled = !0),
          () => {
            textarea && (textarea.disabled = !1);
          }
        );
      if ('undefined' != typeof HTMLElement && 'inert' in HTMLElement.prototype)
        return (
          (inputBox.inert = !0),
          textarea && (textarea.disabled = !0),
          () => {
            ((inputBox.inert = !1), textarea && (textarea.disabled = !1));
          }
        );
      const controls = inputBox.querySelectorAll('button, textarea'),
        prevDisabled = new Map();
      return (
        controls.forEach((el) => {
          (prevDisabled.set(el, el.disabled), (el.disabled = !0));
        }),
        () => {
          prevDisabled.forEach((was, el) => {
            el.disabled = was;
          });
        }
      );
    })(inputBox, textarea);
    const labelEl = enhanceBtn.querySelector('.enhance-btn-label');
    labelEl && (labelEl.textContent = 'Enhancing...');
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
      'text' === result.type &&
        result.text &&
        '(empty response)' !== result.text &&
        ((textarea.value = result.text), textarea.dispatchEvent(new Event('input')));
    } catch (err) {
      console.warn('[Chat] Enhance failed:', err.message);
    } finally {
      (enhanceBtn.classList.remove('enhance-loading'),
        inputBox?.classList.remove('input-box--enhancing'),
        inputBox?.removeAttribute('aria-busy'),
        enhanceUnlock?.(),
        (enhanceUnlock = null),
        hadFocus && textarea.focus(),
        labelEl && (labelEl.textContent = 'Enhance'),
        updateEnhanceBtn());
    }
  }
  return (
    enhanceBtn?.addEventListener('click', handleEnhance),
    textarea?.addEventListener('input', updateEnhanceBtn),
    updateEnhanceBtn(),
    {
      cleanup() {
        (enhanceBtn?.removeEventListener('click', handleEnhance),
          textarea?.removeEventListener('input', updateEnhanceBtn),
          inputBox?.classList.remove('input-box--enhancing'),
          inputBox?.removeAttribute('aria-busy'),
          enhanceUnlock?.(),
          (enhanceUnlock = null),
          inputBox && 'inert' in HTMLElement.prototype && (inputBox.inert = !1),
          textarea && (textarea.disabled = !1));
      },
    }
  );
}
