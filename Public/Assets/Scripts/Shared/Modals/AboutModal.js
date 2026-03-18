// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Shared/AboutModal.js
//
//  Self-contained About modal. Injects its own HTML,
//  wires all events, and exports open / close.
//
//  Usage (any page):
//    import { initAboutModal } from '../Shared/AboutModal.js';
//    const about = initAboutModal();
//    // then: about.open() / about.close()
// ─────────────────────────────────────────────

const SPONSOR_URL = 'https://github.com/sponsors/withinjoel';
const AUTHOR_URL  = 'https://joeljolly.vercel.app';

/* ══════════════════════════════════════════
   HTML TEMPLATE
══════════════════════════════════════════ */
function buildHTML() {
  return /* html */`
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
            <svg class="about-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2L8 6H4v4L2 12l2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4L12 2z"
                    stroke-width="1.4"/>
            </svg>
          </div>

          <div class="about-app-name" id="about-modal-title">openworld</div>
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
      </div>
    </div>
  `;
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function openExternal(url) {
  const a = Object.assign(document.createElement('a'), {
    href: url, target: '_blank', rel: 'noopener noreferrer',
  });
  a.click();
}

/* ══════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════ */
export function initAboutModal() {

  /* ── 1. Inject HTML (only once) ── */
  if (!document.getElementById('about-modal-backdrop')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = buildHTML();
    document.body.appendChild(wrap.firstElementChild);
  }

  /* ── 2. Element refs ── */
  const backdrop   = document.getElementById('about-modal-backdrop');
  const closeBtn   = document.getElementById('about-modal-close');
  const versionEl  = document.getElementById('about-version');
  const sponsorBtn = document.getElementById('about-sponsor-btn');
  const authorLink = document.getElementById('about-author-link');

  /* ── 3. Hydrate dynamic values ── */
  // Try Electron API for version; fall back to DOM meta or hardcoded
  (async () => {
    try {
      const v = await window.electronAPI?.getAppVersion?.();
      if (v && versionEl) versionEl.textContent = `v${v}`;
    } catch { /* keep default */ }
  })();

  if (sponsorBtn) sponsorBtn.href = SPONSOR_URL;
  if (authorLink) authorLink.href = AUTHOR_URL;

  /* ── 4. Wire events ── */
  sponsorBtn?.addEventListener('click', e => { e.preventDefault(); openExternal(SPONSOR_URL); });
  authorLink?.addEventListener('click', e => { e.preventDefault(); openExternal(AUTHOR_URL); });

  closeBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', e => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && backdrop?.classList.contains('open')) close();
  });

  /* ── 5. Public API ── */
  function open() {
    backdrop?.classList.add('open');
    document.body.classList.add('modal-open');
  }

  function close() {
    backdrop?.classList.remove('open');
    document.body.classList.remove('modal-open');
  }

  return { open, close };
}
