/**
 * HTML-escape a value for safe innerHTML injection.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Derive 1–2 character initials from a persona name.
 * @param {string} name
 * @returns {string}
 */
export function getAvatarInitials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return String(name ?? '').trim().slice(0, 2).toUpperCase() || 'AI';
}

/**
 * Build the "Default Assistant" persona card.
 *
 * @param {{
 *   isActive: boolean,
 *   searchQuery: () => string,
 *   onActivate: () => Promise<void>,
 *   onChat: () => Promise<void>,
 * }} opts
 * @returns {HTMLElement}
 */
export function buildDefaultCard({ isActive, searchQuery, onActivate, onChat }) {
  const card = document.createElement('div');
  card.className = `persona-card persona-card--default${isActive ? ' is-active' : ''}`;

  card.innerHTML = `
    ${isActive ? `<div class="persona-active-badge"><div class="persona-active-badge-dot"></div>Active</div>` : ''}
    <div class="persona-avatar persona-avatar--default">
      <img src="../Icons/Logo.png" alt="Joanium" width="50" height="50">
    </div>
    <div class="persona-info">
      <div class="persona-name">Default Assistant</div>
      <div class="persona-description">The standard Joanium AI - helpful, accurate, and contextually aware of your system, repos, and email.</div>
    </div>
    <div class="persona-personality">
      <span class="persona-tag">helpful</span>
      <span class="persona-tag">accurate</span>
      <span class="persona-tag">contextual</span>
    </div>
    <div class="persona-card-footer">
      ${isActive
      ? `<button class="persona-status-btn" disabled>Currently active</button>`
      : `<button class="persona-activate-btn" type="button">Set active</button>`}
      <button class="persona-chat-btn" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Chat
      </button>
    </div>`;

  card.querySelector('.persona-activate-btn')?.addEventListener('click', async event => {
    event.stopPropagation();
    await onActivate();
  });

  card.querySelector('.persona-chat-btn')?.addEventListener('click', async event => {
    event.stopPropagation();
    await onChat();
  });

  return card;
}

/**
 * Build a custom persona card.
 *
 * @param {{
 *   persona: object,
 *   isActive: boolean,
 *   onActivate: () => Promise<void>,
 *   onDeactivate: () => Promise<void>,
 *   onChat: () => Promise<void>,
 * }} opts
 * @returns {HTMLElement}
 */
export function buildPersonaCard({ persona, isActive, onActivate, onDeactivate, onChat }) {
  const card = document.createElement('div');
  card.className = `persona-card${isActive ? ' is-active' : ''}`;

  const tags = (persona.personality || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map(tag => `<span class="persona-tag">${escapeHtml(tag)}</span>`)
    .join('');

  card.innerHTML = `
    ${isActive ? `<div class="persona-active-badge"><div class="persona-active-badge-dot"></div>Active</div>` : ''}
    <div class="persona-avatar">${escapeHtml(getAvatarInitials(persona.name))}</div>
    <div class="persona-info">
      <div class="persona-name">${escapeHtml(persona.name)}</div>
      ${persona.description ? `<div class="persona-description">${escapeHtml(persona.description)}</div>` : ''}
    </div>
    ${tags ? `<div class="persona-personality">${tags}</div>` : ''}
    <div class="persona-card-footer">
      ${isActive
      ? `<button class="persona-deactivate-btn" type="button">Deactivate</button>`
      : `<button class="persona-activate-btn" type="button">Activate</button>`}
      <button class="persona-chat-btn" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Chat
      </button>
    </div>`;

  card.querySelector('.persona-activate-btn')?.addEventListener('click', async event => {
    event.stopPropagation();
    await onActivate();
  });

  card.querySelector('.persona-deactivate-btn')?.addEventListener('click', async event => {
    event.stopPropagation();
    await onDeactivate();
  });

  card.querySelector('.persona-chat-btn')?.addEventListener('click', async event => {
    event.stopPropagation();
    await onChat();
  });

  return card;
}
