import { createModal } from '../System/ModalFactory.js';
const SPONSOR_URL = 'https://github.com/sponsors/withinjoel';
function openExternal(url) {
  Object.assign(document.createElement('a'), {
    href: url,
    target: '_blank',
    rel: 'noopener noreferrer',
  }).click();
}
export function initAboutModal() {
  const modal = createModal({
    backdropId: 'about-modal-backdrop',
    html: '\n    <div id="about-modal-backdrop">\n      <div id="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-modal-title">\n\n        <button class="settings-modal-close about-modal-close"\n                id="about-modal-close" type="button" aria-label="Close about">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">\n            <path d="M18 6L6 18M6 6l12 12"\n                  stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n          </svg>\n        </button>\n\n        <div class="about-modal-body">\n\n          <div class="about-logo-wrap">\n            <img src="../../../Assets/Logo/Logo.png" alt="Joanium" width="64" height="64" />\n          </div>\n\n          <div class="about-app-name" id="about-modal-title">Joanium</div>\n          <div class="about-version" id="about-version">v1.0.0</div>\n\n          <p class="about-description">\n            An Electron app that connects and controls your world.\n          </p>\n\n          <div class="about-divider"></div>\n\n          <a id="about-sponsor-btn" class="about-sponsor-btn" href="#" role="button">\n            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">\n              <path d="M12 21.593c-.534.542-1.076 1.05-1.524 1.483a.75.75 0 01-1.032-.011\n                       L2.29 16.01C.454 14.174 0 12.023 0 10.14 0 6.262 3.004 3 6.75 3\n                       c1.922 0 3.724.841 4.95 2.174A6.75 6.75 0 0117.25 3C21 3 24 6.263\n                       24 10.14c0 1.883-.454 4.034-2.292 5.87l-7.154 7.065a.75.75 0\n                       01-1.032.011c-.448-.433-.99-.94-1.522-1.482z"/>\n            </svg>\n            Sponsor on GitHub\n          </a>\n\n          <p class="footer-credit">\n            Made with ❤️ by\n            <a id="about-author-link" href="#" class="credit-name">Joel Jolly</a>\n          </p>\n\n        </div>\n\n        <div class="about-update-progress" id="about-update-progress" aria-live="polite" aria-label="Update download progress">\n          <div class="about-update-progress-header">\n            <svg class="about-update-icon" id="about-update-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">\n              <path d="M12 3v13m0 0-4-4m4 4 4-4" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n              <path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-width="1.8"/>\n            </svg>\n            <span class="about-update-label" id="about-update-label">Downloading update…</span>\n            <span class="about-update-pct" id="about-update-pct">0%</span>\n          </div>\n          <div class="about-update-track" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" id="about-update-track">\n            <div class="about-update-fill" id="about-update-fill"></div>\n          </div>\n        </div>\n\n      </div>\n    </div>\n  ',
    closeBtnSelector: '#about-modal-close',
    onInit(backdrop) {
      const versionEl = backdrop.querySelector('#about-version'),
        sponsorBtn = backdrop.querySelector('#about-sponsor-btn'),
        authorLink = backdrop.querySelector('#about-author-link'),
        progressWrap = backdrop.querySelector('#about-update-progress'),
        fillEl = backdrop.querySelector('#about-update-fill'),
        pctEl = backdrop.querySelector('#about-update-pct'),
        labelEl = backdrop.querySelector('#about-update-label'),
        trackEl = backdrop.querySelector('#about-update-track');
      ((async () => {
        try {
          const v = await window.electronAPI?.invoke('get-app-version');
          v && versionEl && (versionEl.textContent = `v${v}`);
        } catch {}
      })(),
        sponsorBtn && (sponsorBtn.href = SPONSOR_URL),
        authorLink && (authorLink.href = 'https://joeljolly.vercel.app'),
        sponsorBtn?.addEventListener('click', (e) => {
          (e.preventDefault(), openExternal(SPONSOR_URL));
        }),
        authorLink?.addEventListener('click', (e) => {
          (e.preventDefault(), openExternal('https://joeljolly.vercel.app'));
        }),
        window.electronAPI?.onUpdateDownloadProgress(({ percent: percent }) =>
          (function (percent) {
            if (!progressWrap) return;
            const pct = Math.min(100, Math.max(0, Math.round(percent)));
            (progressWrap.classList.add('active'),
              progressWrap.classList.remove('done'),
              fillEl && (fillEl.style.width = `${pct}%`),
              pctEl && (pctEl.textContent = `${pct}%`),
              labelEl && (labelEl.textContent = 'Downloading update…'),
              trackEl && trackEl.setAttribute('aria-valuenow', pct));
          })(percent ?? 0),
        ),
        window.electronAPI?.onUpdateDownloaded(() => {
          progressWrap &&
            (progressWrap.classList.add('active', 'done'),
            fillEl && (fillEl.style.width = '100%'),
            labelEl && (labelEl.textContent = 'Update ready — installs on quit'),
            trackEl && trackEl.setAttribute('aria-valuenow', 100));
        }));
    },
  });
  return { open: modal.open, close: modal.close };
}
