export const CLOSE_BUTTON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>';
export function syncAllModals() {
  const hasOpen = Boolean(document.querySelector('[id$="-backdrop"].open'));
  document.body.classList.toggle('modal-open', hasOpen);
}
export function createModal({
  backdropId: backdropId,
  html: html,
  multiple: multiple = !1,
  onOpen: onOpen,
  onClose: onClose,
  onInit: onInit,
  closeBtnSelector: closeBtnSelector = '.settings-modal-close',
}) {
  let _backdrop = null,
    _initialized = !1;
  function ensureInjected() {
    if (_initialized) return;
    _initialized = !0;
    const existing = document.getElementById(backdropId);
    if (existing) return void (_backdrop = existing);
    const wrap = document.createElement('div');
    ((wrap.innerHTML = html),
      multiple
        ? document.body.append(...Array.from(wrap.children))
        : document.body.appendChild(wrap.firstElementChild),
      (_backdrop = document.getElementById(backdropId)),
      (function () {
        if (!_backdrop) return;
        const closeBtn = _backdrop.querySelector(closeBtnSelector);
        (closeBtn?.addEventListener('click', close),
          _backdrop.addEventListener('click', (e) => {
            e.target === _backdrop && close();
          }),
          document.addEventListener('keydown', (e) => {
            'Escape' === e.key && isOpen() && close();
          }));
      })(),
      onInit?.(_backdrop));
  }
  function close() {
    (_backdrop?.classList.remove('open'), syncAllModals(), onClose?.());
  }
  function isOpen() {
    return _backdrop?.classList.contains('open') ?? !1;
  }
  return {
    open: function () {
      (ensureInjected(), _backdrop?.classList.add('open'), syncAllModals(), onOpen?.());
    },
    close: close,
    isOpen: isOpen,
    getBackdrop: function () {
      return (ensureInjected(), _backdrop);
    },
    ensureInjected: ensureInjected,
  };
}
