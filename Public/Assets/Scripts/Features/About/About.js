// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Features/About/About.js
//  About modal — version info + sponsor link.
// ─────────────────────────────────────────────

import Properties from '../../../../../Packages/System/Properties.js';
import { closeAvatarPanel } from '../User/User.js';

/* ── DOM refs ── */
const backdrop    = document.getElementById('about-modal-backdrop');
const closeBtn    = document.getElementById('about-modal-close');
const versionEl   = document.getElementById('about-version');
const sponsorBtn  = document.getElementById('about-sponsor-btn');
const authorLink  = document.getElementById('about-author-link');
const openAboutBtn = document.getElementById('avatar-about-btn');

/* ── Hydrate static content ── */
if (versionEl)  versionEl.textContent = `v${Properties.version}`;
if (sponsorBtn) sponsorBtn.href       = Properties.sponsorUrl;
if (authorLink) authorLink.href       = Properties.authorUrl;

function openExternal(url) {
  const a = Object.assign(document.createElement('a'), {
    href: url, target: '_blank', rel: 'noopener noreferrer',
  });
  a.click();
}

sponsorBtn?.addEventListener('click', e => { e.preventDefault(); openExternal(Properties.sponsorUrl); });
authorLink?.addEventListener('click', e => { e.preventDefault(); openExternal(Properties.authorUrl); });

/* ── Open / close ── */
export function open() {
  closeAvatarPanel();
  backdrop?.classList.add('open');
  document.body.classList.add('modal-open');
}

export function close() {
  backdrop?.classList.remove('open');
  document.body.classList.remove('modal-open');
}

/* ── Events ── */
openAboutBtn?.addEventListener('click', e => { e.stopPropagation(); open(); });
closeBtn?.addEventListener('click', close);
backdrop?.addEventListener('click', e => { if (e.target === backdrop) close(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && backdrop?.classList.contains('open')) close();
});
