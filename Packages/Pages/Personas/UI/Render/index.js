import { getPersonasHTML } from './Templates/PersonasTemplate.js';
import { createPersonaCardPool, getAvatarInitials } from './Components/PersonasCards.js';
import { renderMarkdownToHtml } from '../../../../System/Utils.js';
import { openConfirm } from '../../../../System/ConfirmDialog.js';
import { t } from '../../../../System/I18n/index.js';
let activeBanner = null,
  activeNameEl = null,
  personasGrid = null,
  personasEmpty = null,
  searchWrapper = null,
  searchInput = null,
  searchClearBtn = null,
  countEl = null,
  _navigate = null,
  _activePersona = null,
  _allPersonas = [],
  _personaPool = null,
  modalBackdrop = null,
  modalNameEl = null,
  modalAvatarEl = null,
  modalContent = null,
  modalCloseBtn = null;
function closeModal() {
  (modalBackdrop?.classList.remove('open'), document.body.classList.remove('modal-open'));
}
function render(query = '') {
  !(function () {
    if (!activeBanner || !activeNameEl) return;
    const hasActivePersona = _allPersonas.length > 0 && Boolean(_activePersona?.name);
    ((activeBanner.hidden = !hasActivePersona),
      (activeNameEl.textContent = hasActivePersona ? _activePersona.name : ''));
  })();
  const total = _allPersonas.length;
  if (
    (countEl &&
      (countEl.textContent =
        1 === total
          ? t('personas.personaCount', { count: total })
          : t('personas.personasCount', { count: total })),
    !personasGrid || !_personaPool)
  )
    return;
  if (0 === _allPersonas.length)
    return (
      _personaPool.render([], null),
      personasEmpty && (personasEmpty.hidden = !1),
      searchWrapper && (searchWrapper.hidden = !0),
      void (personasGrid.hidden = !0)
    );
  (personasEmpty && (personasEmpty.hidden = !0),
    searchWrapper && (searchWrapper.hidden = !1),
    (personasGrid.hidden = !1));
  const filteredCustom = _allPersonas.filter((persona) =>
      (function (persona, query) {
        if (!query) return !0;
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
      })(persona, query),
    ),
    visibleItems = [...filteredCustom];
  let noResults = personasGrid.querySelector('.personas-no-results');
  if (0 === visibleItems.length)
    return (
      _personaPool.render([], null),
      noResults ||
        ((noResults = document.createElement('div')),
        (noResults.className = 'personas-no-results'),
        (noResults.hidden = !0),
        personasGrid.appendChild(noResults)),
      (noResults.textContent = t('personas.noMatch', { query })),
      void (noResults.hidden = !1)
    );
  (noResults && (noResults.hidden = !0),
    _personaPool.render(visibleItems, _activePersona?.id ?? null));
}
export function mount(outlet, { navigate: navigate }) {
  ((outlet.innerHTML = getPersonasHTML()),
    // Move modal to body so position:fixed covers full viewport incl. titlebar
    document.getElementById('persona-modal-backdrop') &&
      document.body.appendChild(document.getElementById('persona-modal-backdrop')),
    (activeBanner = document.getElementById('personas-active-banner')),
    (activeNameEl = document.getElementById('personas-active-name')),
    (personasGrid = document.getElementById('personas-grid')),
    (personasEmpty = document.getElementById('personas-empty')),
    (searchWrapper = document.getElementById('personas-search-wrapper')),
    (searchInput = document.getElementById('personas-search')),
    (searchClearBtn = document.getElementById('personas-search-clear')),
    (countEl = document.getElementById('personas-count')),
    (modalBackdrop = document.getElementById('persona-modal-backdrop')),
    (modalNameEl = document.getElementById('persona-modal-name')),
    (modalAvatarEl = document.getElementById('persona-modal-avatar')),
    (modalContent = document.getElementById('persona-modal-content')),
    (modalCloseBtn = document.getElementById('persona-modal-close')),
    (_navigate = navigate),
    (_activePersona = null),
    (_allPersonas = []),
    (_personaPool = createPersonaCardPool({
      container: personasGrid,
      onActivatePersona: async (persona) => {
        const result = await window.electronAPI?.invoke?.('set-active-persona', persona);
        !1 !== result?.ok && ((_activePersona = persona), render(searchInput?.value?.trim() ?? ''));
      },
      onDeactivatePersona: async () => {
        await window.electronAPI?.invoke?.('reset-active-persona');
        const activeResult = await window.electronAPI?.invoke?.('get-active-persona');
        ((_activePersona = activeResult?.persona ?? null),
          render(searchInput?.value?.trim() ?? ''));
      },
      onChatPersona: async (persona) => {
        const result = await window.electronAPI?.invoke?.('set-active-persona', persona);
        !1 !== result?.ok &&
          ((_activePersona = persona), await _navigate?.('chat', { startFreshChat: !0 }));
      },
      onReadPersona: (persona) => {
        !(function (persona) {
          modalBackdrop &&
            modalNameEl &&
            modalContent &&
            ((modalNameEl.textContent = persona.name || 'Persona'),
            modalAvatarEl &&
              ((modalAvatarEl.textContent = getAvatarInitials(persona.name)),
              (modalAvatarEl.className = 'persona-modal-avatar')),
            (modalContent.innerHTML = renderMarkdownToHtml(
              persona.instructions || persona.description || '',
            )),
            modalBackdrop.classList.add('open'),
            document.body.classList.add('modal-open'));
        })(persona);
      },
      onDeletePersona: async (persona) => {
        const confirmed = await openConfirm({
          title: t('personas.deleteTitle', { name: persona.name }),
          body: t('personas.deleteBody'),
          confirmText: t('personas.delete'),
          variant: 'danger',
        });
        if (!confirmed) return;
        const result = await window.electronAPI?.invoke?.('delete-persona', persona.id);
        if (result?.ok) {
          if (_activePersona?.id === persona.id) _activePersona = null;
          _allPersonas = _allPersonas.filter((p) => p.id !== persona.id);
          render(searchInput?.value?.trim() ?? '');
        } else {
          console.error('[Personas] Delete failed:', result?.error);
        }
      },
    })));
  const onSearchInput = () => {
      (render(searchInput?.value.trim() ?? ''),
        searchClearBtn?.classList.toggle('visible', (searchInput?.value.length ?? 0) > 0));
    },
    onSearchClear = () => {
      (searchInput && (searchInput.value = ''),
        searchClearBtn?.classList.remove('visible'),
        render(''),
        searchInput?.focus());
    },
    onModalClose = () => closeModal(),
    onModalBackdropClick = (e) => {
      e.target === modalBackdrop && closeModal();
    },
    onKeydown = (e) => {
      'Escape' === e.key && closeModal();
    };
  return (
    modalCloseBtn?.addEventListener('click', onModalClose),
    modalBackdrop?.addEventListener('click', onModalBackdropClick),
    searchInput?.addEventListener('input', onSearchInput),
    searchClearBtn?.addEventListener('click', onSearchClear),
    document
      .getElementById('personas-go-marketplace')
      ?.addEventListener('click', () => _navigate?.('marketplace')),
    document.addEventListener('keydown', onKeydown),
    (async function () {
      try {
        const [personasResult, activeResult] = await Promise.all([
          window.electronAPI?.invoke?.('get-personas'),
          window.electronAPI?.invoke?.('get-active-persona'),
        ]);
        ((_allPersonas = personasResult?.personas ?? []),
          (_activePersona = activeResult?.persona ?? null));
      } catch (error) {
        (console.error('[Personas] Load error:', error),
          (_allPersonas = []),
          (_activePersona = null));
      }
      render(searchInput?.value?.trim() ?? '');
    })(),
    function () {
      (closeModal(),
        modalBackdrop?.remove(),
        modalCloseBtn?.removeEventListener('click', onModalClose),
        modalBackdrop?.removeEventListener('click', onModalBackdropClick),
        searchInput?.removeEventListener('input', onSearchInput),
        searchClearBtn?.removeEventListener('click', onSearchClear),
        document.removeEventListener('keydown', onKeydown),
        _personaPool?.clear(),
        (_personaPool = null),
        (activeBanner = null),
        (activeNameEl = null),
        (personasGrid = null),
        (personasEmpty = null),
        (searchWrapper = null),
        (searchInput = null),
        (searchClearBtn = null),
        (countEl = null),
        (_navigate = null),
        (modalBackdrop = null),
        (modalNameEl = null),
        (modalAvatarEl = null),
        (modalContent = null),
        (modalCloseBtn = null));
    }
  );
}
