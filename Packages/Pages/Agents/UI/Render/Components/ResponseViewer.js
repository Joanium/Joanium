import { fullDateTime } from '../Utils/Utils.js';

export function createResponseViewer() {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="agent-response-viewer">
      <div id="agent-response-viewer-box">
        <div class="agent-rv-header">
          <div>
            <div class="agent-rv-eyebrow" id="agent-rv-eyebrow">Run Result</div>
            <div class="agent-rv-meta" id="agent-rv-meta"></div>
          </div>
          <button class="settings-modal-close" id="agent-rv-close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>
        <div class="agent-rv-body" id="agent-rv-body"></div>
      </div>
    </div>`;

  const root = wrapper.firstElementChild;
  document.body.appendChild(root);

  const eyebrowEl = root.querySelector('#agent-rv-eyebrow');
  const metaEl = root.querySelector('#agent-rv-meta');
  const bodyEl = root.querySelector('#agent-rv-body');
  const closeBtn = root.querySelector('#agent-rv-close');

  function close() {
    root.classList.remove('open');
  }

  function open(entry, jobName) {
    eyebrowEl.textContent = jobName ?? 'Run Result';
    metaEl.textContent = fullDateTime(entry.timestamp);
    bodyEl.textContent = entry.fullResponse || entry.summary || '(no content)';
    root.classList.add('open');
  }

  const onBackdropClick = event => {
    if (event.target === root) close();
  };

  closeBtn.addEventListener('click', close);
  root.addEventListener('click', onBackdropClick);

  return {
    open,
    close,
    destroy() {
      closeBtn.removeEventListener('click', close);
      root.removeEventListener('click', onBackdropClick);
      root.remove();
    },
  };
}
