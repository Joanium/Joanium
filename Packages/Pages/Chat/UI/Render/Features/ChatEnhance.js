import { fetchWithTools } from '../../../../../Renderer/Features/AI/index.js';

/**
 * Initialise the ✨ Enhance prompt button feature.
 *
 * @param {{ textarea: HTMLTextAreaElement, enhanceBtn: HTMLButtonElement, state: object }} options
 * @returns {{ cleanup: Function }}
 */
export function createEnhanceFeature({ textarea, enhanceBtn, state }) {
  function updateEnhanceBtn() {
    if (!enhanceBtn || !textarea) return;
    const has = textarea.value.trim().length > 0;
    enhanceBtn.classList.toggle('enhance-active', has && !state.isTyping);
    enhanceBtn.disabled = !has || state.isTyping;
  }

  async function handleEnhance() {
    if (!textarea?.value.trim() || state.isTyping || !state.selectedProvider || !state.selectedModel) return;
    enhanceBtn.classList.remove('enhance-active');
    enhanceBtn.classList.add('enhance-loading');
    enhanceBtn.disabled = true;
    const labelEl = enhanceBtn.querySelector('.enhance-btn-label');
    if (labelEl) labelEl.textContent = 'Enhancing...';
    try {
      const result = await fetchWithTools(
        state.selectedProvider, state.selectedModel,
        [{ role: 'user', content: textarea.value.trim(), attachments: [] }],
        'You are a prompt-enhancement assistant. Rewrite the user\'s message into a clearer, more specific prompt. Keep the same intent. Return ONLY the enhanced prompt — no preamble.',
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
    },
  };
}
