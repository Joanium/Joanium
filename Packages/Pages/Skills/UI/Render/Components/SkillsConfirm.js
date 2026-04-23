import { t } from '../../../../../System/I18n/index.js';
let _confirmResolve = null;
export function injectConfirmDialog() {
  if (document.getElementById('skills-confirm-backdrop')) return;
  const el = document.createElement('div');
  if (
    ((el.innerHTML = `\n    <div id="skills-confirm-backdrop">\n      <div class="skills-confirm-box">\n        <div class="skills-confirm-icon" id="skills-confirm-icon"></div>\n        <h3 id="skills-confirm-title"></h3>\n        <p id="skills-confirm-body"></p>\n        <div class="skills-confirm-actions">\n          <button class="skills-confirm-btn skills-confirm-btn--cancel" id="skills-confirm-cancel">${t('skills.cancel')}</button>\n          <button class="skills-confirm-btn skills-confirm-btn--ok" id="skills-confirm-ok"></button>\n        </div>\n      </div>\n    </div>`),
    document.body.appendChild(el.firstElementChild),
    !document.getElementById('skills-confirm-style'))
  ) {
    const style = document.createElement('style');
    ((style.id = 'skills-confirm-style'),
      (style.textContent =
        '\n      #skills-confirm-backdrop {\n        position: fixed; inset: 0;\n        display: flex; align-items: center; justify-content: center;\n        padding: 32px;\n        background: rgba(8,11,18,0.55);\n        backdrop-filter: blur(12px);\n        z-index: 500;\n        opacity: 0; pointer-events: none;\n        transition: opacity 0.22s ease;\n      }\n      #skills-confirm-backdrop.open { opacity: 1; pointer-events: auto; }\n      .skills-confirm-box {\n        background: var(--bg-secondary);\n        border: 1px solid var(--border);\n        border-radius: 24px;\n        padding: 32px 28px 26px;\n        width: min(400px, calc(100vw - 48px));\n        box-shadow: 0 32px 96px rgba(0,0,0,0.32);\n        transform: translateY(16px) scale(0.95);\n        transition: transform 0.28s var(--ease-spring);\n        display: flex; flex-direction: column; align-items: center;\n        text-align: center; gap: 0;\n      }\n      #skills-confirm-backdrop.open .skills-confirm-box { transform: translateY(0) scale(1); }\n      .skills-confirm-icon {\n        width: 52px; height: 52px; border-radius: 15px;\n        display: flex; align-items: center; justify-content: center;\n        margin-bottom: 16px; flex-shrink: 0;\n      }\n      .skills-confirm-icon--enable {\n        background: var(--accent-dim);\n        border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);\n        color: var(--accent);\n      }\n      .skills-confirm-icon--disable {\n        background: var(--bg-tertiary);\n        border: 1px solid var(--border);\n        color: var(--text-muted);\n      }\n      #skills-confirm-title { font-size: 17px; font-weight: 600; color: var(--text-primary); margin: 0 0 10px; }\n      #skills-confirm-body { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin: 0 0 26px; max-width: 300px; }\n      .skills-confirm-actions { display: flex; gap: 10px; width: 100%; }\n      .skills-confirm-btn {\n        flex: 1; padding: 10px; border-radius: 12px;\n        font-family: var(--font-ui); font-size: 13px; font-weight: 600;\n        cursor: pointer; border: none;\n        transition: opacity 0.15s, transform 0.1s, background 0.15s;\n      }\n      .skills-confirm-btn:hover { opacity: 0.88; }\n      .skills-confirm-btn:active { transform: scale(0.97); }\n      .skills-confirm-btn--cancel { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border); }\n      .skills-confirm-btn--cancel:hover { background: var(--bg-hover); opacity: 1; }\n      .skills-confirm-btn--ok--enable { background: var(--accent); color: #fff; box-shadow: 0 4px 14px var(--accent-glow); }\n      .skills-confirm-btn--ok--disable { background: var(--bg-hover); color: var(--text-primary); border: 1px solid var(--border); }\n    '),
      document.head.appendChild(style));
  }
  (document.getElementById('skills-confirm-cancel')?.addEventListener('click', closeConfirm),
    document.getElementById('skills-confirm-backdrop')?.addEventListener('click', (event) => {
      'skills-confirm-backdrop' === event.target.id && closeConfirm();
    }));
}
export function closeConfirm() {
  (document.getElementById('skills-confirm-backdrop')?.classList.remove('open'),
    document.body.classList.remove('modal-open'),
    _confirmResolve?.(!1),
    (_confirmResolve = null));
}
export function openConfirm({ type: type, totalCount: totalCount, enabledCount: enabledCount }) {
  injectConfirmDialog();
  const backdrop = document.getElementById('skills-confirm-backdrop'),
    iconEl = document.getElementById('skills-confirm-icon'),
    titleEl = document.getElementById('skills-confirm-title'),
    bodyEl = document.getElementById('skills-confirm-body'),
    okBtn = document.getElementById('skills-confirm-ok');
  return backdrop && iconEl && titleEl && bodyEl && okBtn
    ? ('enable' === type
        ? ((iconEl.className = 'skills-confirm-icon skills-confirm-icon--enable'),
          (iconEl.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="26" height="26"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
          (titleEl.textContent = t('skills.enableAllTitle')),
          (bodyEl.textContent = t('skills.enableAllBody', { count: totalCount })),
          (okBtn.className =
            'skills-confirm-btn skills-confirm-btn--ok skills-confirm-btn--ok--enable'),
          (okBtn.textContent = t('skills.enableAllOk')))
        : ((iconEl.className = 'skills-confirm-icon skills-confirm-icon--disable'),
          (iconEl.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="26" height="26"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14" stroke-linecap="round"/></svg>'),
          (titleEl.textContent = t('skills.disableAllTitle')),
          (bodyEl.textContent = t('skills.disableAllBody', { count: enabledCount })),
          (okBtn.className =
            'skills-confirm-btn skills-confirm-btn--ok skills-confirm-btn--ok--disable'),
          (okBtn.textContent = t('skills.disableAllOk'))),
      backdrop.classList.add('open'),
      document.body.classList.add('modal-open'),
      new Promise((resolve) => {
        _confirmResolve = resolve;
        const newOkBtn = okBtn.cloneNode(!0);
        (okBtn.replaceWith(newOkBtn),
          newOkBtn.addEventListener('click', () => {
            ((_confirmResolve = null), closeConfirm(), resolve(!0));
          }));
      }))
    : Promise.resolve(!1);
}
