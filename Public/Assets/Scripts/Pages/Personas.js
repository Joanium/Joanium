let activeBanner = null;
let activeNameEl = null;
let personasGrid = null;
let searchInput = null;
let searchClearBtn = null;
let countEl = null;
let _navigate = null;
let _activePersona = null;
let _allPersonas = [];

function getHTML() {
  return /* html */`
<main id="main" class="personas-main">
  <div class="personas-scroll">
    <div class="personas-page-header">
      <div class="personas-page-header-copy">
        <h2>Personas</h2>
        <p>Choose a personality for your AI - the active persona shapes every conversation</p>
      </div>
      <span class="page-count" id="personas-count"></span>
    </div>

    <div id="personas-active-banner" class="personas-active-banner" hidden>
      <div class="personas-active-banner-dot"></div>
      <div class="personas-active-banner-text">
        Active persona: <strong id="personas-active-name">Default Assistant</strong>
      </div>
    </div>

    <div id="personas-search-wrapper" class="page-search-wrapper">
      <div class="page-search-box">
        <svg class="page-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="M16.5 16.5L21 21" stroke-linecap="round" />
        </svg>
        <input id="personas-search" type="text" class="page-search-input" placeholder="Search by name, personality, description..." autocomplete="off" spellcheck="false" />
        <button class="page-search-clear" id="personas-search-clear" type="button" aria-label="Clear search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <div id="personas-grid" class="personas-grid"></div>
  </div>
</main>
`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  const lowerQuery = query.toLowerCase();
  return [persona.name, persona.personality, persona.description, persona.instructions, persona.filename]
    .join(' ')
    .toLowerCase()
    .includes(lowerQuery);
}

function updateBanner() {
  if (!activeBanner || !activeNameEl) return;
  activeBanner.hidden = false;
  activeNameEl.textContent = _activePersona ? _activePersona.name : 'Default Assistant';
}

function navigateToChat() {
  return _navigate?.('chat');
}

function buildDefaultCard() {
  const active = isDefaultActive();
  const card = document.createElement('div');
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
      <div class="persona-description">The standard Evelina AI - helpful, accurate, and contextually aware of your system, repos, and email.</div>
    </div>
    <div class="persona-personality">
      <span class="persona-tag">helpful</span>
      <span class="persona-tag">accurate</span>
      <span class="persona-tag">contextual</span>
    </div>
    <div class="persona-card-footer">
      ${active
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
    await window.electronAPI?.resetActivePersona?.();
    _activePersona = null;
    render(searchInput?.value?.trim() ?? '');
  });

  card.querySelector('.persona-chat-btn')?.addEventListener('click', async event => {
    event.stopPropagation();
    await window.electronAPI?.resetActivePersona?.();
    _activePersona = null;
    await navigateToChat();
  });

  return card;
}

function buildPersonaCard(persona) {
  const active = isActiveCustom(persona);
  const card = document.createElement('div');
  card.className = `persona-card${active ? ' is-active' : ''}`;

  const tags = (persona.personality || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map(tag => `<span class="persona-tag">${escapeHtml(tag)}</span>`)
    .join('');

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
    const result = await window.electronAPI?.setActivePersona?.(persona);
    if (result?.ok !== false) {
      _activePersona = persona;
      render(searchInput?.value?.trim() ?? '');
    }
  });

  card.querySelector('.persona-deactivate-btn')?.addEventListener('click', async event => {
    event.stopPropagation();
    await window.electronAPI?.resetActivePersona?.();
    _activePersona = null;
    render(searchInput?.value?.trim() ?? '');
  });

  card.querySelector('.persona-chat-btn')?.addEventListener('click', async event => {
    event.stopPropagation();
    const result = await window.electronAPI?.setActivePersona?.(persona);
    if (result?.ok !== false) {
      _activePersona = persona;
      await navigateToChat();
    }
  });

  return card;
}

function render(query = '') {
  updateBanner();

  const total = 1 + _allPersonas.length;
  if (countEl) countEl.textContent = `${total} persona${total !== 1 ? 's' : ''}`;

  if (!personasGrid) return;
  personasGrid.innerHTML = '';

  const defaultKeywords = 'default assistant helpful accurate contextual standard';
  const lowerQuery = query.toLowerCase();
  const showDefault = !query || defaultKeywords.includes(lowerQuery) || 'default assistant'.includes(lowerQuery);

  const filteredCustom = _allPersonas.filter(persona => matchesSearch(persona, query));
  const visibleItems = [];
  if (showDefault) visibleItems.push({ _isDefault: true });
  visibleItems.push(...filteredCustom);

  if (visibleItems.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'personas-no-results';
    noResults.textContent = `No personas match "${query}"`;
    personasGrid.appendChild(noResults);
    return;
  }

  visibleItems.forEach(item => {
    personasGrid.appendChild(item._isDefault ? buildDefaultCard() : buildPersonaCard(item));
  });
}

async function load() {
  try {
    const [personasResult, activeResult] = await Promise.all([
      window.electronAPI?.getPersonas?.(),
      window.electronAPI?.getActivePersona?.(),
    ]);
    _allPersonas = personasResult?.personas ?? [];
    _activePersona = activeResult?.persona ?? null;
  } catch (error) {
    console.error('[Personas] Load error:', error);
    _allPersonas = [];
    _activePersona = null;
  }

  render(searchInput?.value?.trim() ?? '');
}

export function mount(outlet, { navigate }) {
  outlet.innerHTML = getHTML();

  activeBanner = document.getElementById('personas-active-banner');
  activeNameEl = document.getElementById('personas-active-name');
  personasGrid = document.getElementById('personas-grid');
  searchInput = document.getElementById('personas-search');
  searchClearBtn = document.getElementById('personas-search-clear');
  countEl = document.getElementById('personas-count');
  _navigate = navigate;

  _activePersona = null;
  _allPersonas = [];

  const onSearchInput = () => {
    render(searchInput?.value.trim() ?? '');
    searchClearBtn?.classList.toggle('visible', (searchInput?.value.length ?? 0) > 0);
  };
  const onSearchClear = () => {
    if (searchInput) searchInput.value = '';
    searchClearBtn?.classList.remove('visible');
    render('');
    searchInput?.focus();
  };

  searchInput?.addEventListener('input', onSearchInput);
  searchClearBtn?.addEventListener('click', onSearchClear);

  load();

  return function cleanup() {
    searchInput?.removeEventListener('input', onSearchInput);
    searchClearBtn?.removeEventListener('click', onSearchClear);

    activeBanner = null;
    activeNameEl = null;
    personasGrid = null;
    searchInput = null;
    searchClearBtn = null;
    countEl = null;
    _navigate = null;
  };
}
