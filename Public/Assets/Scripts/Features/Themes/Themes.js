// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Features/Themes/Themes.js
//  Theme switching with flash animation and localStorage persistence.
// ─────────────────────────────────────────────

import { state }                        from '../../Shared/State.js';
import { themeBtn, themePanel, themeOptions, avatarPanel } from '../../Shared/DOM.js';

const THEMES = ['dark', 'light', 'midnight', 'forest', 'pinky'];

// Inject the keyframe once
const style = document.createElement('style');
style.textContent = `@keyframes themeFlash { 0%{opacity:.3} 100%{opacity:0} }`;
document.head.appendChild(style);

/** Apply a theme by name, with an optional flash transition. */
export function applyTheme(theme, animate = true) {
  if (!THEMES.includes(theme)) theme = 'dark';

  if (animate) {
    const flash = document.createElement('div');
    flash.style.cssText =
      'position:fixed;inset:0;z-index:9999;background:var(--accent-glow);pointer-events:none;animation:themeFlash .35s ease forwards;';
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
  }

  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ow-theme', theme);
  state.theme = theme;

  // Sync all theme-option buttons (sidebar + settings modal)
  document.querySelectorAll('.theme-option, .ap-theme-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === theme);
  });
}

/** Wire up the theme picker panel and sidebar toggle button. */
export function init() {
  // Apply saved theme immediately without flash
  applyTheme(state.theme, false);

  themeBtn?.addEventListener('click', e => {
    e.stopPropagation();
    themePanel?.classList.toggle('open');
    avatarPanel?.classList.remove('open');
  });

  themeOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      applyTheme(opt.dataset.theme);
      themePanel?.classList.remove('open');
    });
  });

  // Close panel on outside click
  document.addEventListener('click', e => {
    if (!themePanel?.contains(e.target) && e.target !== themeBtn)
      themePanel?.classList.remove('open');
  });
}
