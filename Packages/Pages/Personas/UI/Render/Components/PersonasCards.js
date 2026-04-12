import { escapeHtml } from '../../../../../System/Utils.js';
export { escapeHtml };
export function getAvatarInitials(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : String(name ?? '')
        .trim()
        .slice(0, 2)
        .toUpperCase() || 'AI';
}
export function createPersonaCardPool({
  container: container,
  onActivatePersona: onActivatePersona,
  onDeactivatePersona: onDeactivatePersona,
  onChatPersona: onChatPersona,
  onReadPersona: onReadPersona,
}) {
  const pool = new Map(),
    active = new Set();
  function createCustomCard() {
    const card = document.createElement('div');
    return (
      (card.className = 'persona-card'),
      (card._currentPersona = null),
      (card._isActive = !1),
      (card.innerHTML =
        '\n      <div class="persona-active-badge" style="display:none"><div class="persona-active-badge-dot"></div>Active</div>\n      <div class="persona-avatar"></div>\n      <div class="persona-info">\n        <div class="persona-name-row">\n          <div class="persona-name"></div>\n          <span class="persona-verified" hidden aria-label="Verified Joanium persona" title="Verified Joanium persona">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n              <path d="M9 12.75l2.25 2.25L15 9.75" stroke-linecap="round" stroke-linejoin="round"/>\n              <path d="M12 3l2.6 1.2 2.84-.34 1.2 2.6 2.36 1.62-.8 2.74.8 2.74-2.36 1.62-1.2 2.6-2.84-.34L12 21l-2.6-1.2-2.84.34-1.2-2.6L3 15.92l.8-2.74L3 10.44l2.36-1.62 1.2-2.6 2.84.34L12 3z" stroke-linecap="round" stroke-linejoin="round"/>\n            </svg>\n          </span>\n        </div>\n        <div class="persona-publisher"></div>\n        <div class="persona-description" style="display:none"></div>\n      </div>\n      <div class="persona-personality"></div>\n      <div class="persona-card-footer">\n        <button class="persona-activate-btn" type="button" style="display:none">Activate</button>\n        <button class="persona-deactivate-btn" type="button" style="display:none">Deactivate</button>\n        <button class="persona-read-btn" type="button" title="Read persona">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" stroke-linecap="round" stroke-linejoin="round"/>\n            <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" stroke-linecap="round" stroke-linejoin="round"/>\n          </svg>\n        </button>\n        <button class="persona-chat-btn" type="button" title="Chat with persona">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round"/>\n          </svg>\n        </button>\n      </div>'),
      card.querySelector('.persona-activate-btn')?.addEventListener('click', async (event) => {
        (event.stopPropagation(),
          card._currentPersona && (await onActivatePersona(card._currentPersona)));
      }),
      card.querySelector('.persona-deactivate-btn')?.addEventListener('click', async (event) => {
        (event.stopPropagation(), await onDeactivatePersona());
      }),
      card.querySelector('.persona-read-btn')?.addEventListener('click', (event) => {
        (event.stopPropagation(), card._currentPersona && onReadPersona?.(card._currentPersona));
      }),
      card.querySelector('.persona-chat-btn')?.addEventListener('click', async (event) => {
        (event.stopPropagation(),
          card._currentPersona && (await onChatPersona(card._currentPersona)));
      }),
      card
    );
  }
  function updateCustomCard(card, persona, isActive) {
    ((card._currentPersona = persona),
      (card._isActive = isActive),
      (card.className = 'persona-card' + (isActive ? ' is-active' : '')),
      (card.dataset.personaId = persona.id),
      (card.querySelector('.persona-active-badge').style.display = isActive ? '' : 'none'),
      (card.querySelector('.persona-avatar').textContent = getAvatarInitials(persona.name)),
      (card.querySelector('.persona-name').textContent = persona.name),
      (card.querySelector('.persona-publisher').textContent = persona.publisher),
      (card.querySelector('.persona-verified').hidden = !0 !== persona.isVerified));
    const descEl = card.querySelector('.persona-description');
    persona.description
      ? ((descEl.style.display = ''), (descEl.textContent = persona.description))
      : (descEl.style.display = 'none');
    const tagsEl = card.querySelector('.persona-personality'),
      tags = (persona.personality || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((tag) => `<span class="persona-tag">${escapeHtml(tag)}</span>`)
        .join('');
    ((tagsEl.innerHTML = tags), (tagsEl.style.display = tags ? '' : 'none'));
    const activateBtn = card.querySelector('.persona-activate-btn'),
      deactivateBtn = card.querySelector('.persona-deactivate-btn');
    ((activateBtn.style.display = isActive ? 'none' : ''),
      (deactivateBtn.style.display = isActive ? '' : 'none'));
  }
  return {
    render: function (items, activePersonaId) {
      active.clear();
      for (const item of items) {
        const key = item.id,
          isActive = activePersonaId === item.id;
        let card = pool.get(key);
        (card || ((card = createCustomCard()), pool.set(key, card), container.appendChild(card)),
          updateCustomCard(card, item, isActive),
          (card.style.display = ''),
          active.add(card));
      }
      for (const [, card] of pool) active.has(card) || (card.style.display = 'none');
    },
    clear: function () {
      for (const [, card] of pool) card.remove();
      (pool.clear(), active.clear());
    },
  };
}
