import { fullDateTime } from '../Utils/Utils.js';
export function createResponseViewer() {
  const wrapper = document.createElement('div');
  wrapper.innerHTML =
    '\n    <div id="agent-response-viewer">\n      <div id="agent-response-viewer-box">\n        <div class="agent-rv-header">\n          <div>\n            <div class="agent-rv-eyebrow" id="agent-rv-eyebrow">Run Result</div>\n            <div class="agent-rv-meta" id="agent-rv-meta"></div>\n          </div>\n          <button class="settings-modal-close" id="agent-rv-close" aria-label="Close">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n            </svg>\n          </button>\n        </div>\n        <div class="agent-rv-body" id="agent-rv-body"></div>\n      </div>\n    </div>';
  const root = wrapper.firstElementChild;
  document.body.appendChild(root);
  const eyebrowEl = root.querySelector('#agent-rv-eyebrow'),
    metaEl = root.querySelector('#agent-rv-meta'),
    bodyEl = root.querySelector('#agent-rv-body'),
    closeBtn = root.querySelector('#agent-rv-close');
  function close() {
    root.classList.remove('open');
  }
  const onBackdropClick = (event) => {
    event.target === root && close();
  };
  return (
    closeBtn.addEventListener('click', close),
    root.addEventListener('click', onBackdropClick),
    {
      open: function (entry, jobName) {
        ((eyebrowEl.textContent = jobName ?? 'Run Result'),
          (metaEl.textContent = fullDateTime(entry.timestamp)),
          (bodyEl.textContent = entry.fullResponse || entry.summary || '(no content)'),
          root.classList.add('open'));
      },
      close: close,
      destroy() {
        (closeBtn.removeEventListener('click', close),
          root.removeEventListener('click', onBackdropClick),
          root.remove());
      },
    }
  );
}
