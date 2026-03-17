import { applyTheme } from './Themes.js';
import { state, avatarBtn, avatarPanel, avatarPanelBadge, avatarPanelName, themePanel } from './Root.js';

/* ══════════════════════════════════════════
   USER INIT — load name from User.json
══════════════════════════════════════════ */
export async function loadUser() {
    try {
        const user = await window.electronAPI?.getUser();
        if (!user?.name) return;

        state.userName = user.name;
        const parts = user.name.trim().split(/\s+/);
        state.userInitials = parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : parts[0].slice(0, 2).toUpperCase();

        // Update sidebar avatar button
        if (avatarBtn) {
            avatarBtn.textContent = state.userInitials;
            avatarBtn.title = user.name;
            avatarBtn.setAttribute('data-tip', user.name);
        }

        // Update avatar panel header
        if (avatarPanelBadge) avatarPanelBadge.textContent = state.userInitials;
        if (avatarPanelName) avatarPanelName.textContent = user.name;

        // Update welcome greeting
        const welcomeTitle = document.querySelector('.welcome-title');
        if (welcomeTitle) welcomeTitle.textContent = `Welcome, ${parts[0]}`;

        // Render connected providers in avatar panel
        renderAvatarProviders();
    } catch (e) {
        console.warn('[openworld] Could not load user:', e);
    }
}

function renderAvatarProviders() {
    const container = document.getElementById('ap-providers-list');
    if (!container) return;

    if (state.providers.length === 0) {
        container.innerHTML = `<div class="ap-empty-hint">No API keys configured</div>`;
        return;
    }

    const providerColors = {
        anthropic: '#cc785c', openai: '#10a37f',
        google: '#4285f4', openrouter: '#9b59b6',
    };

    container.innerHTML = state.providers.map(p => `
    <div class="ap-provider-item">
      <span class="ap-provider-dot" style="background:${providerColors[p.provider] ?? 'var(--accent)'}"></span>
      <span class="ap-provider-name">${p.label}</span>
      <span class="ap-provider-status">Connected</span>
    </div>`).join('');
}

/* ══════════════════════════════════════════
   AVATAR PANEL
══════════════════════════════════════════ */
export function toggleAvatarPanel(e) {
    e?.stopPropagation();
    avatarPanel?.classList.toggle('open');
    themePanel?.classList.remove('open');
}

export function closeAvatarPanel() {
    avatarPanel?.classList.remove('open');
}

avatarBtn?.addEventListener('click', toggleAvatarPanel);

// Handle theme buttons inside avatar panel
avatarPanel?.addEventListener('click', e => {
    const opt = e.target.closest('.ap-theme-option');
    if (opt) applyTheme(opt.dataset.theme);
});