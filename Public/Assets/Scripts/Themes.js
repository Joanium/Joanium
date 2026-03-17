/* ══════════════════════════════════════════
   THEME SYSTEM
══════════════════════════════════════════ */
import { state, themeOptions, themeBtn, themePanel, avatarPanel } from './Root.js';

const THEMES = ['dark', 'light', 'midnight', 'forest', 'pinky'];

export function applyTheme(theme, animate = true) {
    if (!THEMES.includes(theme)) theme = 'dark';

    if (animate) {
        const flash = document.createElement('div');
        flash.style.cssText = `position:fixed;inset:0;z-index:9999;background:var(--accent-glow);pointer-events:none;animation:themeFlash 0.35s ease forwards;`;
        document.body.appendChild(flash);
        flash.addEventListener('animationend', () => flash.remove());
    }

    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ow-theme', theme);
    state.theme = theme;

    themeOptions.forEach(opt => opt.classList.toggle('active', opt.dataset.theme === theme));
    document.querySelectorAll('.ap-theme-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === theme);
    });
}

const styleEl = document.createElement('style');
styleEl.textContent = `@keyframes themeFlash { 0%{opacity:.3} 100%{opacity:0} }`;
document.head.appendChild(styleEl);

applyTheme(state.theme, false);

themeBtn?.addEventListener('click', e => {
    e.stopPropagation();
    themePanel.classList.toggle('open');
    avatarPanel?.classList.remove('open');
});

themeOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        applyTheme(opt.dataset.theme);
        themePanel.classList.remove('open');
    });
});