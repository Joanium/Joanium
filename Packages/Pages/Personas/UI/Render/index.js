import { getPersonasHTML } from './Templates/PersonasTemplate.js';
import { createPersonaCardPool, getAvatarInitials } from './Components/PersonasCards.js';
import { renderMarkdownToHtml } from '../../../../System/Utils.js';

// ── Module-level refs (reset on each mount) ──────────────────────────────────
let activeBanner = null;
let activeNameEl = null;
let personasGrid = null;
let personasEmpty = null;
let searchWrapper = null;
let searchInput = null;
let searchClearBtn = null;
let countEl = null;
let _navigate = null;
let _activePersona = null;
let _allPersonas = [];
let _personaPool = null;
let modalBackdrop = null;
let modalNameEl = null;
let modalAvatarEl = null;
let modalContent = null;
let modalCloseBtn = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function matchesSearch(persona, query) {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  return [
    persona.name,
    persona.publisher,
    persona.personality,
    persona.description,
    persona.instructions,
    persona.filename,
  ]
    .join(' ')
    .toLowerCase()
    .includes(lowerQuery);
}

function openModal(persona) {
  if (!modalBackdrop || !modalNameEl || !modalContent) return;
  modalNameEl.textContent = persona.name || 'Persona';
  if (modalAvatarEl) {
    modalAvatarEl.textContent = getAvatarInitials(persona.name);
    modalAvatarEl.className = 'persona-modal-avatar';
  }
  modalContent.innerHTML = renderMarkdownToHtml(persona.instructions || persona.description || '');
  modalBackdrop.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeModal() {
  modalBackdrop?.classList.remove('open');
  document.body.classList.remove('modal-open');
}

function updateBanner() {
  if (!activeBanner || !activeNameEl) return;
  const hasActivePersona = _allPersonas.length > 0 && Boolean(_activePersona?.name);
  activeBanner.hidden = !hasActivePersona;
  activeNameEl.textContent = hasActivePersona ? _activePersona.name : '';
}

function navigateToChat() {
  return _navigate?.('chat', { startFreshChat: true });
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function render(query = '') {
  updateBanner();

  const total = _allPersonas.length;
  if (countEl) countEl.textContent = `${total} persona${total !== 1 ? 's' : ''}`;

  if (!personasGrid || !_personaPool) return;

  if (_allPersonas.length === 0) {
    _personaPool.render([], null);
    if (personasEmpty) personasEmpty.hidden = false;
    if (searchWrapper) searchWrapper.hidden = true;
    personasGrid.hidden = true;
    return;
  }

  if (personasEmpty) personasEmpty.hidden = true;
  if (searchWrapper) searchWrapper.hidden = false;
  personasGrid.hidden = false;

  const filteredCustom = _allPersonas.filter((persona) => matchesSearch(persona, query));
  const visibleItems = [...filteredCustom];
  let noResults = personasGrid.querySelector('.personas-no-results');

  if (visibleItems.length === 0) {
    _personaPool.render([], null);
    if (!noResults) {
      noResults = document.createElement('div');
      noResults.className = 'personas-no-results';
      noResults.hidden = true;
      personasGrid.appendChild(noResults);
    }
    noResults.textContent = `No personas match "${query}"`;
    noResults.hidden = false;
    return;
  }

  if (noResults) noResults.hidden = true;

  _personaPool.render(visibleItems, _activePersona?.id ?? null);
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function load() {
  try {
    const [personasResult, activeResult] = await Promise.all([
      window.electronAPI?.invoke?.('get-personas'),
      window.electronAPI?.invoke?.('get-active-persona'),
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

// ── mount ─────────────────────────────────────────────────────────────────────
export function mount(outlet, { navigate }) {
  outlet.innerHTML = getPersonasHTML();

  activeBanner = document.getElementById('personas-active-banner');
  activeNameEl = document.getElementById('personas-active-name');
  personasGrid = document.getElementById('personas-grid');
  personasEmpty = document.getElementById('personas-empty');
  searchWrapper = document.getElementById('personas-search-wrapper');
  searchInput = document.getElementById('personas-search');
  searchClearBtn = document.getElementById('personas-search-clear');
  countEl = document.getElementById('personas-count');
  modalBackdrop = document.getElementById('persona-modal-backdrop');
  modalNameEl = document.getElementById('persona-modal-name');
  modalAvatarEl = document.getElementById('persona-modal-avatar');
  modalContent = document.getElementById('persona-modal-content');
  modalCloseBtn = document.getElementById('persona-modal-close');
  _navigate = navigate;

  _activePersona = null;
  _allPersonas = [];

  _personaPool = createPersonaCardPool({
    container: personasGrid,
    onActivatePersona: async (persona) => {
      const result = await window.electronAPI?.invoke?.('set-active-persona', persona);
      if (result?.ok !== false) {
        _activePersona = persona;
        render(searchInput?.value?.trim() ?? '');
      }
    },
    onDeactivatePersona: async () => {
      await window.electronAPI?.invoke?.('reset-active-persona');
      const activeResult = await window.electronAPI?.invoke?.('get-active-persona');
      _activePersona = activeResult?.persona ?? null;
      render(searchInput?.value?.trim() ?? '');
    },
    onChatPersona: async (persona) => {
      const result = await window.electronAPI?.invoke?.('set-active-persona', persona);
      if (result?.ok !== false) {
        _activePersona = persona;
        await navigateToChat();
      }
    },
    onReadPersona: (persona) => {
      openModal(persona);
    },
  });

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
  const onModalClose = () => closeModal();
  const onModalBackdropClick = (e) => {
    if (e.target === modalBackdrop) closeModal();
  };
  const onKeydown = (e) => {
    if (e.key === 'Escape') closeModal();
  };

  modalCloseBtn?.addEventListener('click', onModalClose);
  modalBackdrop?.addEventListener('click', onModalBackdropClick);
  searchInput?.addEventListener('input', onSearchInput);
  searchClearBtn?.addEventListener('click', onSearchClear);
  document
    .getElementById('personas-go-marketplace')
    ?.addEventListener('click', () => _navigate?.('marketplace'));
  document.addEventListener('keydown', onKeydown);

  load();

  return function cleanup() {
    closeModal();
    modalCloseBtn?.removeEventListener('click', onModalClose);
    modalBackdrop?.removeEventListener('click', onModalBackdropClick);
    searchInput?.removeEventListener('input', onSearchInput);
    searchClearBtn?.removeEventListener('click', onSearchClear);
    document.removeEventListener('keydown', onKeydown);

    _personaPool?.clear();
    _personaPool = null;
    activeBanner = null;
    activeNameEl = null;
    personasGrid = null;
    personasEmpty = null;
    searchWrapper = null;
    searchInput = null;
    searchClearBtn = null;
    countEl = null;
    _navigate = null;
    modalBackdrop = null;
    modalNameEl = null;
    modalAvatarEl = null;
    modalContent = null;
    modalCloseBtn = null;
  };
}
