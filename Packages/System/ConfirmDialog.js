let _confirmResolve = null;
export function closeConfirm() {
  (document.getElementById('generic-confirm-backdrop')?.classList.remove('open'),
    _confirmResolve?.(!1),
    (_confirmResolve = null));
}
export function openConfirm({
  title: title,
  body: body,
  confirmText: confirmText = 'Confirm',
  cancelText: cancelText = 'Cancel',
  variant: variant = 'default',
  iconSvg: iconSvg,
}) {
  !(function () {
    if (document.getElementById('generic-confirm-backdrop')) return;
    const el = document.createElement('div');
    ((el.innerHTML =
      '\n    <div id="generic-confirm-backdrop">\n      <div class="generic-confirm-box">\n        <div class="generic-confirm-icon generic-confirm-icon--default" id="generic-confirm-icon"></div>\n        <h3 id="generic-confirm-title"></h3>\n        <p id="generic-confirm-body"></p>\n        <div class="generic-confirm-actions">\n          <button class="generic-confirm-btn generic-confirm-btn--cancel" id="generic-confirm-cancel">Cancel</button>\n          <button class="generic-confirm-btn generic-confirm-btn--confirm" id="generic-confirm-ok"></button>\n        </div>\n      </div>\n    </div>'),
      document.body.appendChild(el.firstElementChild),
      document.getElementById('generic-confirm-cancel')?.addEventListener('click', closeConfirm),
      document.getElementById('generic-confirm-backdrop')?.addEventListener('click', (event) => {
        'generic-confirm-backdrop' === event.target.id && closeConfirm();
      }));
  })();
  const backdrop = document.getElementById('generic-confirm-backdrop'),
    iconEl = document.getElementById('generic-confirm-icon'),
    titleEl = document.getElementById('generic-confirm-title'),
    bodyEl = document.getElementById('generic-confirm-body'),
    okBtn = document.getElementById('generic-confirm-ok'),
    cancelBtn = document.getElementById('generic-confirm-cancel');
  return backdrop && iconEl && titleEl && bodyEl && okBtn
    ? ((titleEl.textContent = title),
      (bodyEl.textContent = body),
      (okBtn.textContent = confirmText),
      cancelBtn && (cancelBtn.textContent = cancelText),
      (iconEl.className = `generic-confirm-icon generic-confirm-icon--${variant}`),
      (iconEl.innerHTML =
        iconSvg ||
        ('danger' === variant
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="26" height="26"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          : '')),
      (okBtn.className =
        'generic-confirm-btn generic-confirm-btn--' +
        ('danger' === variant ? 'danger' : 'confirm')),
      backdrop.classList.add('open'),
      new Promise((resolve) => {
        _confirmResolve = resolve;
        const freshOk = okBtn.cloneNode(!0);
        (okBtn.replaceWith(freshOk),
          freshOk.addEventListener('click', () => {
            ((_confirmResolve = null), closeConfirm(), resolve(!0));
          }));
      }))
    : Promise.resolve(!1);
}
