import { createModal } from '../System/ModalFactory.js';

const SPONSOR_URL = 'https://github.com/sponsors/withinjoel';
const AUTHOR_URL = 'https://joeljolly.vercel.app';

function buildHTML() {
  return /* html */ `
    <div id="about-modal-backdrop">
      <div id="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-modal-title">

        <button class="settings-modal-close about-modal-close"
                id="about-modal-close" type="button" aria-label="Close about">
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
            An Electron app that connects and controls your world.
          </p>

          <div class="about-divider"></div>

          <a id="about-sponsor-btn" class="about-sponsor-btn" href="#" role="button">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 21.593c-.534.542-1.076 1.05-1.524 1.483a.75.75 0 01-1.032-.011
                       L2.29 16.01C.454 14.174 0 12.023 0 10.14 0 6.262 3.004 3 6.75 3
                       c1.922 0 3.724.841 4.95 2.174A6.75 6.75 0 0117.25 3C21 3 24 6.263
                       24 10.14c0 1.883-.454 4.034-2.292 5.87l-7.154 7.065a.75.75 0
                       01-1.032.011c-.448-.433-.99-.94-1.522-1.482z"/>
            </svg>
            Sponsor on GitHub
          </a>

          <p class="footer-credit">
            Made with ❤️ by
            <a id="about-author-link" href="#" class="credit-name">Joel Jolly</a>
          </p>

        </div>

        <div class="about-update-progress" id="about-update-progress" aria-live="polite" aria-label="Update download progress">
          <div class="about-update-progress-header">
            <svg class="about-update-icon" id="about-update-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M12 3v13m0 0-4-4m4 4 4-4" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
              <path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-width="1.8"/>
            </svg>
            <span class="about-update-label" id="about-update-label">Downloading update…</span>
            <span class="about-update-pct" id="about-update-pct">0%</span>
          </div>
          <div class="about-update-track" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" id="about-update-track">
            <div class="about-update-fill" id="about-update-fill"></div>
          </div>
        </div>

      </div>
    </div>
  `;
}

function openExternal(url) {
  const a = Object.assign(document.createElement('a'), {
    href: url,
    target: '_blank',
    rel: 'noopener noreferrer',
  });
  a.click();
}

export function initAboutModal() {
  const modal = createModal({
    backdropId: 'about-modal-backdrop',
    html: buildHTML(),
    closeBtnSelector: '#about-modal-close',
    onInit(backdrop) {
      const versionEl = backdrop.querySelector('#about-version');
      const sponsorBtn = backdrop.querySelector('#about-sponsor-btn');
      const authorLink = backdrop.querySelector('#about-author-link');
      const progressWrap = backdrop.querySelector('#about-update-progress');
      const fillEl = backdrop.querySelector('#about-update-fill');
      const pctEl = backdrop.querySelector('#about-update-pct');
      const labelEl = backdrop.querySelector('#about-update-label');
      const trackEl = backdrop.querySelector('#about-update-track');

      (async () => {
        try {
          const v = await window.electronAPI?.invoke('get-app-version');
          if (v && versionEl) versionEl.textContent = `v${v}`;
        } catch {
          /* keep default */
        }
      })();

      if (sponsorBtn) sponsorBtn.href = SPONSOR_URL;
      if (authorLink) authorLink.href = AUTHOR_URL;

      sponsorBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openExternal(SPONSOR_URL);
      });
      authorLink?.addEventListener('click', (e) => {
        e.preventDefault();
        openExternal(AUTHOR_URL);
      });

      function setProgress(percent) {
        if (!progressWrap) return;
        const pct = Math.min(100, Math.max(0, Math.round(percent)));
        progressWrap.classList.add('active');
        progressWrap.classList.remove('done');
        if (fillEl) fillEl.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${pct}%`;
        if (labelEl) labelEl.textContent = 'Downloading update\u2026';
        if (trackEl) {
          trackEl.setAttribute('aria-valuenow', pct);
        }
      }

      function setDone() {
        if (!progressWrap) return;
        progressWrap.classList.add('active', 'done');
        if (fillEl) fillEl.style.width = '100%';
        if (labelEl) labelEl.textContent = 'Update ready \u2014 installs on quit';
        if (trackEl) trackEl.setAttribute('aria-valuenow', 100);
      }

      const onProgress = ({ percent }) => setProgress(percent ?? 0);
      const onDone = () => setDone();

      window.electronAPI?.onUpdateDownloadProgress(onProgress);
      window.electronAPI?.onUpdateDownloaded(onDone);
    },
  });

  return { open: modal.open, close: modal.close };
}
