import { createModal } from '../System/ModalFactory.js';
import { t } from '../System/I18n/index.js';
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
    html: `
    <div id="about-modal-backdrop">
      <div id="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-modal-title">

        <button class="settings-modal-close about-modal-close"
                id="about-modal-close" type="button" aria-label="${t('about.closeLabel')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12"
                  stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
          </svg>
        </button>

        <div class="about-modal-body">

          <div class="about-logo-wrap">
            <img src="../../../Assets/Logo/Logo.png" alt="Joanium" width="64" height="64" />
          </div>

          <div class="about-app-name" id="about-modal-title">Joanium</div>
          <div class="about-version" id="about-version">v1.0.0</div>

          <p class="about-description">
            ${t('about.description')}
          </p>

          <div class="about-divider"></div>

          <a id="about-sponsor-btn" class="about-sponsor-btn" href="#" role="button">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true">
              <path d="M12 21.593c-.534.542-1.076 1.05-1.524 1.407a.75.75 0 01-.952 0C9.076 22.643 3 17.107 3 12a9 9 0 0118 0c0 5.107-6.076 10.643-6.524 10.993a.75.75 0 01-.476.6z" fill="none"/>
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            ${t('about.sponsorBtn')}
          </a>

          <p class="footer-credit">
            ${t('about.madeWithLove')}
          </p>

        </div>

        <div class="about-update-progress" id="about-update-progress" aria-live="polite" aria-label="Update download progress">
          <div class="about-update-progress-header">
            <svg class="about-update-icon" id="about-update-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M12 3v13m0 0-4-4m4 4 4-4" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
              <path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-width="1.8"/>
            </svg>
            <span class="about-update-label" id="about-update-label">${t('about.downloading')}</span>
            <span class="about-update-pct" id="about-update-pct">0%</span>
          </div>
          <div class="about-update-track" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" id="about-update-track">
            <div class="about-update-fill" id="about-update-fill"></div>
          </div>
        </div>

      </div>
    </div>
  `,
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
              labelEl && (labelEl.textContent = t('about.downloading')),
              trackEl && trackEl.setAttribute('aria-valuenow', pct));
          })(percent ?? 0),
        ),
        window.electronAPI?.onUpdateDownloaded(() => {
          progressWrap &&
            (progressWrap.classList.add('active', 'done'),
            fillEl && (fillEl.style.width = '100%'),
            labelEl && (labelEl.textContent = t('about.updateReady')),
            trackEl && trackEl.setAttribute('aria-valuenow', 100));
        }));
    },
  });
  return { open: modal.open, close: modal.close };
}
