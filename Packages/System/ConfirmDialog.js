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
    !(function () {
      if (document.getElementById('generic-confirm-style')) return;
      const style = document.createElement('style');
      ((style.id = 'generic-confirm-style'),
        (style.textContent =
          '\n    #generic-confirm-backdrop {\n      position: fixed; inset: 0;\n      display: flex; align-items: center; justify-content: center;\n      padding: 32px;\n      background: rgba(8,11,18,0.55);\n      backdrop-filter: blur(12px);\n      z-index: 500;\n      opacity: 0; pointer-events: none;\n      transition: opacity 0.22s ease;\n    }\n    #generic-confirm-backdrop.open { opacity: 1; pointer-events: auto; }\n    .generic-confirm-box {\n      background: var(--bg-secondary);\n      border: 1px solid var(--border);\n      border-radius: 24px;\n      padding: 32px 28px 26px;\n      width: min(400px, calc(100vw - 48px));\n      box-shadow: 0 32px 96px rgba(0,0,0,0.32);\n      transform: translateY(16px) scale(0.95);\n      transition: transform 0.28s var(--ease-spring);\n      display: flex; flex-direction: column; align-items: center;\n      text-align: center; gap: 0;\n    }\n    #generic-confirm-backdrop.open .generic-confirm-box { transform: translateY(0) scale(1); }\n    .generic-confirm-icon {\n      width: 52px; height: 52px; border-radius: 15px;\n      display: flex; align-items: center; justify-content: center;\n      margin-bottom: 16px; flex-shrink: 0;\n    }\n    .generic-confirm-icon--danger {\n      background: var(--danger-dim, rgba(239,68,68,0.12));\n      border: 1px solid color-mix(in srgb, var(--danger, #ef4444) 25%, transparent);\n      color: var(--danger, #ef4444);\n    }\n    .generic-confirm-icon--default {\n      background: var(--bg-tertiary);\n      border: 1px solid var(--border);\n      color: var(--text-muted);\n    }\n    #generic-confirm-title { font-size: 17px; font-weight: 600; color: var(--text-primary); margin: 0 0 10px; }\n    #generic-confirm-body { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin: 0 0 26px; max-width: 300px; }\n    .generic-confirm-actions { display: flex; gap: 10px; width: 100%; }\n    .generic-confirm-btn {\n      flex: 1; padding: 10px; border-radius: 12px;\n      font-family: var(--font-ui); font-size: 13px; font-weight: 600;\n      cursor: pointer; border: none;\n      transition: opacity 0.15s, transform 0.1s, background 0.15s;\n    }\n    .generic-confirm-btn:hover { opacity: 0.88; }\n    .generic-confirm-btn:active { transform: scale(0.97); }\n    .generic-confirm-btn--cancel { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border); }\n    .generic-confirm-btn--cancel:hover { background: var(--bg-hover); opacity: 1; }\n    .generic-confirm-btn--confirm { background: var(--accent); color: #fff; box-shadow: 0 4px 14px var(--accent-glow); }\n    .generic-confirm-btn--danger { background: var(--danger, #ef4444); color: #fff; }\n  '),
        document.head.appendChild(style));
    })();
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
