// Window controls
import '../Shared/WindowControls.js';

// Modals
import { initSidebar }       from '../Shared/Sidebar.js';
import { initAboutModal }    from '../Shared/Modals/AboutModal.js';
import { initLibraryModal }  from '../Shared/Modals/LibraryModal.js';
import { initSettingsModal } from '../Shared/Modals/SettingsModal.js';

const about    = initAboutModal();
const settings = initSettingsModal();

const library = initLibraryModal({
  onChatSelect: (chatId) => {
    if (chatId) localStorage.setItem('ow-pending-chat', chatId);
    window.electronAPI?.launchMain();
  },
});

const sidebar = initSidebar({
  activePage:    'personas',
  onNewChat:     () => window.electronAPI?.launchMain(),
  onLibrary:     () => library.isOpen() ? library.close() : library.open(),
  onAutomations: () => window.electronAPI?.launchAutomations?.(),
  onAgents:      () => window.electronAPI?.launchAgents?.(),
  onEvents:      () => window.electronAPI?.launchEvents?.(),
  onSkills:      () => window.electronAPI?.launchSkills?.(),
  onPersonas:    () => { /* already here */ },
  onUsage:       () => window.electronAPI?.launchUsage?.(),
  onSettings:    () => settings.open(),
  onAbout:       () => about.open(),
});

window.addEventListener('ow:user-profile-updated', e => sidebar.setUser(e.detail?.name ?? ''));
settings.loadUser().then(user => sidebar.setUser(user?.name ?? ''));

// ── DOM refs ─────────────────────────────────────────────────────────────
const activeBanner  = document.getElementById('personas-active-banner');
const activeNameEl  = document.getElementById('personas-active-name');
const personasGrid  = document.getElementById('personas-grid');
const searchWrapper = document.getElementById('personas-search-wrapper');
const searchInput   = document.getElementById('personas-search');
const countEl       = document.getElementById('personas-count');

// ── State ─────────────────────────────────────────────────────────────────
let _activePersona = null;
let _allPersonas   = [];

// ── Helpers ───────────────────────────────────────────────────────────────

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getAvatarInitials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return String(name ?? '').trim().slice(0, 2).toUpperCase() || 'AI';
}

function isActiveCustom(persona) {
  return _activePersona?.filename === persona?.filename;
}

function isDefaultActive() {
  return !_activePersona;
}

function matchesSearch(persona, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [persona.name, persona.personality, persona.description, persona.instructions, persona.filename]
    .join(' ').toLowerCase().includes(q);
}

// ── Banner ────────────────────────────────────────────────────────────────

function updateBanner() {
  if (!activeBanner || !activeNameEl) return;
  activeBanner.hidden      = false;
  activeNameEl.textContent = _activePersona ? _activePersona.name : 'Default Assistant';
}

// ── Default persona card ──────────────────────────────────────────────────

function buildDefaultCard() {
  const active = isDefaultActive();
  const card   = document.createElement('div');
  card.className = `persona-card persona-card--default${active ? ' is-active' : ''}`;

  card.innerHTML = `
    ${active ? `<div class="persona-active-badge"><div class="persona-active-badge-dot"></div>Active</div>` : ''}
    <div class="persona-avatar persona-avatar--default">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:24px;height:24px">
        <path d="M12 2L8 6H4v4L2 12l2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4L12 2z"/>
      </svg>
    </div>
    <div class="persona-info">
      <div class="persona-name">Default Assistant</div>
      <div class="persona-description">The standard Romelson AI — helpful, accurate, and contextually aware of your system, repos, and email.</div>
    </div>
    <div class="persona-personality">
      <span class="persona-tag">helpful</span>
      <span class="persona-tag">accurate</span>
      <span class="persona-tag">contextual</span>
    </div>
    <div class="persona-card-footer">
      ${active
        ? `<button class="persona-status-btn" disabled>Currently active</button>`
        : `<button class="persona-activate-btn" type="button">Set active</button>`
      }
      <button class="persona-chat-btn" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Chat
      </button>
    </div>`;

  card.querySelector('.persona-activate-btn')?.addEventListener('click', async e => {
    e.stopPropagation();
    await window.electronAPI?.resetActivePersona?.();
    _activePersona = null;
    render(searchInput?.value?.trim() ?? '');
  });

  card.querySelector('.persona-chat-btn')?.addEventListener('click', async e => {
    e.stopPropagation();
    await window.electronAPI?.resetActivePersona?.();
    window.electronAPI?.launchMain();
  });

  return card;
}

// ── Custom persona card ───────────────────────────────────────────────────

function buildPersonaCard(persona) {
  const active = isActiveCustom(persona);
  const card   = document.createElement('div');
  card.className = `persona-card${active ? ' is-active' : ''}`;

  const tags = (persona.personality || '')
    .split(',').map(t => t.trim()).filter(Boolean).slice(0, 5)
    .map(t => `<span class="persona-tag">${escapeHtml(t)}</span>`).join('');

  card.innerHTML = `
    ${active ? `<div class="persona-active-badge"><div class="persona-active-badge-dot"></div>Active</div>` : ''}
    <div class="persona-avatar">${escapeHtml(getAvatarInitials(persona.name))}</div>
    <div class="persona-info">
      <div class="persona-name">${escapeHtml(persona.name)}</div>
      ${persona.description ? `<div class="persona-description">${escapeHtml(persona.description)}</div>` : ''}
    </div>
    ${tags ? `<div class="persona-personality">${tags}</div>` : ''}
    <div class="persona-card-footer">
      ${active
        ? `<button class="persona-deactivate-btn" type="button">Deactivate</button>`
        : `<button class="persona-activate-btn" type="button">Activate</button>`
      }
      <button class="persona-chat-btn" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Chat
      </button>
    </div>`;

  card.querySelector('.persona-activate-btn')?.addEventListener('click', async e => {
    e.stopPropagation();
    const res = await window.electronAPI?.setActivePersona?.(persona);
    if (res?.ok !== false) { _activePersona = persona; render(searchInput?.value?.trim() ?? ''); }
  });

  card.querySelector('.persona-deactivate-btn')?.addEventListener('click', async e => {
    e.stopPropagation();
    await window.electronAPI?.resetActivePersona?.();
    _activePersona = null;
    render(searchInput?.value?.trim() ?? '');
  });

  card.querySelector('.persona-chat-btn')?.addEventListener('click', async e => {
    e.stopPropagation();
    await window.electronAPI?.setActivePersona?.(persona);
    window.electronAPI?.launchMain();
  });

  return card;
}

// ── Full render ───────────────────────────────────────────────────────────

function render(query = '') {
  updateBanner();

  const total = 1 + _allPersonas.length;
  if (countEl) countEl.textContent = `${total} persona${total !== 1 ? 's' : ''}`;

  if (!personasGrid) return;
  personasGrid.innerHTML = '';

  const defaultKeywords = 'default assistant helpful accurate contextual romelson standard';
  const showDefault = !query || defaultKeywords.includes(query.toLowerCase()) ||
    'default assistant'.includes(query.toLowerCase());

  const filteredCustom = _allPersonas.filter(p => matchesSearch(p, query));
  const showItems = [];
  if (showDefault) showItems.push({ _isDefault: true });
  showItems.push(...filteredCustom);

  if (showItems.length === 0) {
    const nope = document.createElement('div');
    nope.className   = 'personas-no-results';
    nope.textContent = `No personas match "${query}"`;
    personasGrid.appendChild(nope);
    return;
  }

  showItems.forEach(item => {
    if (item._isDefault) {
      personasGrid.appendChild(buildDefaultCard());
    } else {
      personasGrid.appendChild(buildPersonaCard(item));
    }
  });
}

// ── Search wiring ─────────────────────────────────────────────────────────

const personasClearBtn = document.getElementById('personas-search-clear');

searchInput?.addEventListener('input', () => {
  render(searchInput.value.trim());
  if (personasClearBtn) personasClearBtn.classList.toggle('visible', searchInput.value.length > 0);
});

personasClearBtn?.addEventListener('click', () => {
  if (searchInput) searchInput.value = '';
  personasClearBtn.classList.remove('visible');
  render('');
  searchInput?.focus();
});

// ── Boot ──────────────────────────────────────────────────────────────────

async function load() {
  try {
    const [personasRes, activeRes] = await Promise.all([
      window.electronAPI?.getPersonas?.(),
      window.electronAPI?.getActivePersona?.(),
    ]);
    _allPersonas   = personasRes?.personas  ?? [];
    _activePersona = activeRes?.persona     ?? null;
  } catch (err) {
    console.error('[Personas] Load error:', err);
  }
  render();
}

load();
