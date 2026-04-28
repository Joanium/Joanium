import { t } from '../../../../../System/I18n/index.js';
let _confirmResolve = null;
export function injectConfirmDialog() {
  if (document.getElementById('skills-confirm-backdrop')) return;
  const el = document.createElement('div');
  el.innerHTML = `\n    <div id="skills-confirm-backdrop">\n      <div class="skills-confirm-box">\n        <div class="skills-confirm-icon" id="skills-confirm-icon"></div>\n        <h3 id="skills-confirm-title"></h3>\n        <p id="skills-confirm-body"></p>\n        <div class="skills-confirm-actions">\n          <button class="skills-confirm-btn skills-confirm-btn--cancel" id="skills-confirm-cancel">${t('skills.cancel')}</button>\n          <button class="skills-confirm-btn skills-confirm-btn--ok" id="skills-confirm-ok"></button>\n        </div>\n      </div>\n    </div>`;
  document.body.appendChild(el.firstElementChild);
  document.getElementById('skills-confirm-cancel')?.addEventListener('click', closeConfirm);
  document.getElementById('skills-confirm-backdrop')?.addEventListener('click', (event) => {
    'skills-confirm-backdrop' === event.target.id && closeConfirm();
  });
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
