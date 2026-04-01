import { getPersonasHTML } from './Templates/PersonasTemplate.js';
import { buildDefaultCard, buildPersonaCard } from './Components/PersonasCards.js';

// ── Module-level refs (reset on each mount) ──────────────────────────────────
let activeBanner  = null;
let activeNameEl  = null;
let personasGrid  = null;
let searchInput   = null;
let searchClearBtn = null;
let countEl       = null;
let _navigate     = null;
let _activePersona = null;
let _allPersonas  = [];

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  return _navigate?.('chat', { startFreshChat: true });
}

// ── Rendering ─────────────────────────────────────────────────────────────────
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
    if (item._isDefault) {
      personasGrid.appendChild(buildDefaultCard({
        isActive: !_activePersona,
        searchQuery: () => searchInput?.value?.trim() ?? '',
        onActivate: async () => {
          await window.electronAPI?.resetActivePersona?.();
          _activePersona = null;
          render(searchInput?.value?.trim() ?? '');
        },
        onChat: async () => {
          await window.electronAPI?.resetActivePersona?.();
          _activePersona = null;
          await navigateToChat();
        },
      }));
    } else {
      personasGrid.appendChild(buildPersonaCard({
        persona: item,
        isActive: _activePersona?.filename === item.filename,
        onActivate: async () => {
          const result = await window.electronAPI?.setActivePersona?.(item);
          if (result?.ok !== false) {
            _activePersona = item;
            render(searchInput?.value?.trim() ?? '');
          }
        },
        onDeactivate: async () => {
          await window.electronAPI?.resetActivePersona?.();
          _activePersona = null;
          render(searchInput?.value?.trim() ?? '');
        },
        onChat: async () => {
          const result = await window.electronAPI?.setActivePersona?.(item);
          if (result?.ok !== false) {
            _activePersona = item;
            await navigateToChat();
          }
        },
      }));
    }
  });
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function load() {
  try {
    const [personasResult, activeResult] = await Promise.all([
      window.electronAPI?.getPersonas?.(),
      window.electronAPI?.getActivePersona?.(),
    ]);
    _allPersonas   = personasResult?.personas ?? [];
    _activePersona = activeResult?.persona ?? null;
  } catch (error) {
    console.error('[Personas] Load error:', error);
    _allPersonas   = [];
    _activePersona = null;
  }

  render(searchInput?.value?.trim() ?? '');
}

// ── mount ─────────────────────────────────────────────────────────────────────
export function mount(outlet, { navigate }) {
  outlet.innerHTML = getPersonasHTML();

  activeBanner   = document.getElementById('personas-active-banner');
  activeNameEl   = document.getElementById('personas-active-name');
  personasGrid   = document.getElementById('personas-grid');
  searchInput    = document.getElementById('personas-search');
  searchClearBtn = document.getElementById('personas-search-clear');
  countEl        = document.getElementById('personas-count');
  _navigate      = navigate;

  _activePersona = null;
  _allPersonas   = [];

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

    activeBanner   = null;
    activeNameEl   = null;
    personasGrid   = null;
    searchInput    = null;
    searchClearBtn = null;
    countEl        = null;
    _navigate      = null;
  };
}
