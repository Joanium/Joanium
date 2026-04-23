import { createCardPool } from '../../../../System/CardPool.js';
import { escapeHtml, renderMarkdownToHtml } from '../../../../System/Utils.js';
import { getMarketplaceHTML } from './Templates/MarketplaceTemplate.js';
import { t } from '../../../../System/I18n/index.js';
let countEl = null,
  sourceEl = null,
  gridEl = null,
  loadingEl = null,
  loadingCopyEl = null,
  errorEl = null,
  emptyEl = null,
  _emptyTitleEl = null,
  _emptyCopyEl = null,
  sentinelEl = null,
  searchInput = null,
  searchClearBtn = null,
  sortSelect = null,
  tabButtons = [],
  filterButtons = [],
  modalBackdrop = null,
  modalNameEl = null,
  modalMetaEl = null,
  modalIconEl = null,
  modalVerifiedEl = null,
  modalStatusEl = null,
  modalContentEl = null,
  modalInstallBtn = null,
  modalCloseBtn = null,
  _cardPool = null,
  _observer = null,
  _items = [],
  _selectedItem = null,
  _requestToken = 0,
  _activeType = 'skills',
  _activeFilter = 'all',
  _activeSort = 'az',
  _loading = !1,
  _nextPage = 1,
  _hasMore = !1,
  _total = 0,
  _origins = [],
  _activeOrigin = '';
function getTypeLabel(type) {
  return 'personas' === type ? t('marketplace.personas') : t('marketplace.skills');
}
function getItemIcon(type) {
  return 'personas' === type
    ? '\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n        <circle cx="12" cy="8" r="3.5" />\n        <path d="M5.5 19a6.5 6.5 0 0113 0" stroke-linecap="round" />\n      </svg>\n    '
    : '\n    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke-linecap="round" stroke-linejoin="round" />\n    </svg>\n  ';
}
function updateListSurface() {
  // Count — prefer the server-reported total so the badge is accurate on first load
  if (countEl) {
    const label = getTypeLabel(_activeType).toLowerCase();
    const displayCount = _total > 0 ? _total : _items.length;
    countEl.textContent = `${displayCount} ${label}`;
  }

  // Source
  if (sourceEl) {
    if (!_activeOrigin) {
      sourceEl.hidden = true;
      sourceEl.textContent = '';
    } else {
      try {
        sourceEl.textContent = new URL(_activeOrigin).host;
      } catch {
        sourceEl.textContent = _activeOrigin;
      }
      sourceEl.hidden = false;
    }
  }

  const hasItems = _items.length > 0;
  const hasSearch = !!searchInput?.value.trim();
  const label = getTypeLabel(_activeType).toLowerCase();

  // Grid + pagination
  if (gridEl) gridEl.hidden = !hasItems;
  if (sentinelEl) sentinelEl.hidden = !_hasMore;

  // ✅ Error only when search returns no results
  if (errorEl) {
    if (hasSearch && !hasItems && !_loading) {
      const query = searchInput.value.trim();
      errorEl.textContent = `No ${label} match "${query}".`;
      errorEl.hidden = false;
    } else {
      errorEl.hidden = true;
    }
  }

  // ❌ Disable empty state
  if (emptyEl) emptyEl.hidden = true;
}
function setLoading(visible, copy = 'Loading marketplace...') {
  loadingEl && loadingCopyEl && ((loadingEl.hidden = !visible), (loadingCopyEl.textContent = copy));
}
function setError(message = '') {
  if (!errorEl) return;
  if (!message) return ((errorEl.hidden = !0), void (errorEl.textContent = ''));
  const originHint = _origins.length ? ` Tried: ${_origins.join(', ')}` : '';
  ((errorEl.textContent = `${message}${originHint}`), (errorEl.hidden = !1));
}
function mergeItems(existingItems, nextItems) {
  const byId = new Map(existingItems.map((item) => [item.id, item]));
  for (const item of nextItems) byId.set(item.id, item);
  return [...byId.values()];
}
function buildMetaChips(item) {
  const chips = [
    `<span class="marketplace-chip marketplace-chip--type">${escapeHtml(((type = item.type), 'personas' === type ? 'persona' : 'skill'))}</span>`,
    `<span class="marketplace-chip">${escapeHtml(item.publisher)}</span>`,
  ];
  var type;
  return (
    item.downloads > 0 &&
      chips.push(`<span class="marketplace-chip">${item.downloads} downloads</span>`),
    item.stars > 0 && chips.push(`<span class="marketplace-chip">${item.stars} stars</span>`),
    chips.join('')
  );
}
function createCard() {
  const card = document.createElement('article');
  return (
    (card.className = 'marketplace-card'),
    (card.innerHTML =
      '\n    <div class="marketplace-card-head">\n      <div class="marketplace-card-icon"></div>\n      <div class="marketplace-card-title-group">\n        <div class="marketplace-card-name-row">\n          <div class="marketplace-card-name"></div>\n          <span class="marketplace-card-verified" hidden aria-label="Verified Joanium item" title="Verified Joanium item">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n              <path d="M9 12.75l2.25 2.25L15 9.75" stroke-linecap="round" stroke-linejoin="round" />\n              <path d="M12 3l2.6 1.2 2.84-.34 1.2 2.6 2.36 1.62-.8 2.74.8 2.74-2.36 1.62-1.2 2.6-2.84-.34L12 21l-2.6-1.2-2.84.34-1.2-2.6L3 15.92l.8-2.74L3 10.44l2.36-1.62 1.2-2.6 2.84.34L12 3z" stroke-linecap="round" stroke-linejoin="round" />\n            </svg>\n          </span>\n        </div>\n        <div class="marketplace-card-publisher"></div>\n      </div>\n      <span class="marketplace-card-status" hidden></span>\n    </div>\n    <div class="marketplace-card-description"></div>\n    <div class="marketplace-card-tags"></div>\n    <div class="marketplace-card-footer">\n      <button class="marketplace-card-read-btn" type="button">Read</button>\n      <button class="marketplace-card-install-btn" type="button">Install</button>\n    </div>\n  '),
    card.addEventListener('click', (event) => {
      event.target.closest('button') || (card._item && openModal(card._item));
    }),
    card.querySelector('.marketplace-card-read-btn')?.addEventListener('click', (event) => {
      (event.stopPropagation(), card._item && openModal(card._item));
    }),
    card
      .querySelector('.marketplace-card-install-btn')
      ?.addEventListener('click', async (event) => {
        (event.stopPropagation(), card._item && (await installItem(card._item)));
      }),
    card
  );
}
function updateCard(card, item) {
  ((card._item = item),
    (card.dataset.itemId = item.id),
    (card.querySelector('.marketplace-card-icon').innerHTML = getItemIcon(item.type)),
    (card.querySelector('.marketplace-card-name').textContent = item.name),
    (card.querySelector('.marketplace-card-publisher').textContent = item.publisher),
    (card.querySelector('.marketplace-card-description').textContent = t('marketplace.cardDesc')),
    (card.querySelector('.marketplace-card-tags').innerHTML = buildMetaChips(item)),
    (card.querySelector('.marketplace-card-verified').hidden = !0 !== item.isVerified));
  const statusEl = card.querySelector('.marketplace-card-status');
  ((statusEl.hidden = !0 !== item.isInstalled),
    (statusEl.textContent = item.isInstalled ? 'Installed' : ''));
  const installBtn = card.querySelector('.marketplace-card-install-btn');
  ((installBtn.textContent = item.isInstalled
    ? t('marketplace.installed')
    : t('marketplace.install')),
    (installBtn.disabled = !0 === item.isInstalled));
}
function updateModal(item) {
  ((modalNameEl.textContent = item.name),
    (modalMetaEl.innerHTML = buildMetaChips(item)),
    (modalIconEl.innerHTML = getItemIcon(item.type)),
    (modalVerifiedEl.hidden = !0 !== item.isVerified),
    (modalInstallBtn.disabled = !0 === item.isInstalled),
    (modalInstallBtn.textContent = item.isInstalled
      ? t('marketplace.installed')
      : t('marketplace.install')));
}
function setModalStatus(message = '', tone = 'info') {
  if (modalStatusEl) {
    if (!message)
      return (
        (modalStatusEl.hidden = !0),
        (modalStatusEl.textContent = ''),
        void (modalStatusEl.dataset.tone = '')
      );
    ((modalStatusEl.hidden = !1),
      (modalStatusEl.dataset.tone = tone),
      (modalStatusEl.textContent = message));
  }
}
async function openModal(item) {
  if (
    ((_selectedItem = item),
    updateModal(item),
    (modalContentEl.innerHTML = item.markdown ? renderMarkdownToHtml(item.markdown) : ''),
    setModalStatus(item.markdown ? '' : t('marketplace.loadingItem'), 'info'),
    modalBackdrop.classList.add('open'),
    document.body.classList.add('modal-open'),
    !item.markdown)
  )
    try {
      const result = await window.electronAPI?.invoke?.('marketplace-get-item-detail', {
        type: item.type,
        item: item,
      });
      if (!result?.ok) throw new Error(result?.error || 'Could not load the marketplace item.');
      const detail = result.item ?? item;
      ((_selectedItem = detail),
        (_items = mergeItems(_items, [detail])),
        _cardPool?.render(_items),
        updateListSurface(),
        updateModal(detail),
        (modalContentEl.innerHTML = renderMarkdownToHtml(detail.markdown)),
        setModalStatus('', 'info'));
    } catch (error) {
      ((modalContentEl.innerHTML = ''), setModalStatus(error.message, 'error'));
    }
}
function closeModal() {
  (modalBackdrop?.classList.remove('open'),
    document.body.classList.remove('modal-open'),
    setModalStatus('', 'info'));
}
async function installItem(item) {
  const previousLabel = modalInstallBtn?.textContent;
  _selectedItem?.id === item.id &&
    ((modalInstallBtn.disabled = !0),
    (modalInstallBtn.textContent = t('marketplace.installing')),
    setModalStatus(t('marketplace.installingItem'), 'info'));
  try {
    const result = await window.electronAPI?.invoke?.('marketplace-install-item', {
      type: item.type,
      item: item,
    });
    if (!result?.ok) throw new Error(result?.error || 'Install failed.');
    const installedItem = { ...(result.item ?? item), isInstalled: !0, installedSource: 'user' };
    ((_items = mergeItems(
      _items.map((entry) => (entry.id === installedItem.id ? installedItem : entry)),
      [installedItem],
    )),
      _cardPool?.render(_items),
      updateListSurface(),
      _selectedItem?.id === installedItem.id &&
        ((_selectedItem = installedItem),
        updateModal(installedItem),
        setModalStatus(t('marketplace.installSuccess'), 'success')));
  } catch (error) {
    _selectedItem?.id === item.id &&
      ((modalInstallBtn.disabled = !1),
      (modalInstallBtn.textContent = previousLabel || 'Install'),
      setModalStatus(error.message, 'error'));
  }
}
async function loadItems({ reset: reset = !1 } = {}) {
  if (_loading && !reset) return;
  if (reset)
    ((_items = []),
      (_nextPage = 1),
      (_hasMore = !1),
      (_total = 0),
      _cardPool?.render(_items),
      updateListSurface());
  else if (!_hasMore || !_nextPage) return;
  const token = ++_requestToken;
  ((_loading = !0),
    setError(''),
    setLoading(
      !0,
      reset ? `Loading ${getTypeLabel(_activeType).toLowerCase()}...` : 'Loading more...',
    ));
  try {
    const result = await window.electronAPI?.invoke?.('marketplace-list-items', {
      type: _activeType,
      page: reset ? 1 : _nextPage,
      search: searchInput?.value.trim() ?? '',
      filter: _activeFilter,
      sort: _activeSort,
      limit: 24,
    });
    if (token !== _requestToken) return;
    if (!result?.ok) throw new Error(result?.error || 'Marketplace loading failed.');
    ((_activeOrigin = result.origin ?? _activeOrigin),
      (_items = reset ? (result.items ?? []) : mergeItems(_items, result.items ?? [])),
      (_total = Number(result.total) || _items.length),
      (_nextPage = result.nextPage ?? null),
      (_hasMore = Boolean(result.hasMore)),
      _cardPool?.render(_items));
  } catch (error) {
    if (token !== _requestToken) return;
    setError(error.message || 'Marketplace loading failed.');
  } finally {
    token === _requestToken && ((_loading = !1), setLoading(!1), updateListSurface());
  }
}
function refreshMarketplace() {
  (tabButtons.forEach((button) => {
    const isActive = button.dataset.type === _activeType;
    (button.classList.toggle('is-active', isActive),
      button.setAttribute('aria-selected', isActive ? 'true' : 'false'));
  }),
    filterButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.filter === _activeFilter);
    }),
    loadItems({ reset: !0 }));
}
export function mount(outlet) {
  ((outlet.innerHTML = getMarketplaceHTML()),
    // Move modal to body so position:fixed covers full viewport incl. titlebar
    document.getElementById('marketplace-modal-backdrop') &&
      document.body.appendChild(document.getElementById('marketplace-modal-backdrop')),
    (countEl = document.getElementById('marketplace-count')),
    (sourceEl = document.getElementById('marketplace-source')),
    (gridEl = document.getElementById('marketplace-grid')),
    (loadingEl = document.getElementById('marketplace-loading')),
    (loadingCopyEl = document.getElementById('marketplace-loading-copy')),
    (errorEl = document.getElementById('marketplace-error')),
    (emptyEl = document.getElementById('marketplace-empty')),
    (_emptyTitleEl = document.getElementById('marketplace-empty-title')),
    (_emptyCopyEl = document.getElementById('marketplace-empty-copy')),
    (sentinelEl = document.getElementById('marketplace-sentinel')),
    (searchInput = document.getElementById('marketplace-search')),
    (searchClearBtn = document.getElementById('marketplace-search-clear')),
    (sortSelect = document.getElementById('marketplace-sort')),
    (tabButtons = Array.from(document.querySelectorAll('.marketplace-tab'))),
    (filterButtons = Array.from(document.querySelectorAll('.marketplace-filter-chip'))),
    (modalBackdrop = document.getElementById('marketplace-modal-backdrop')),
    (modalNameEl = document.getElementById('marketplace-modal-name')),
    (modalMetaEl = document.getElementById('marketplace-modal-meta')),
    (modalIconEl = document.getElementById('marketplace-modal-icon')),
    (modalVerifiedEl = document.getElementById('marketplace-modal-verified')),
    (modalStatusEl = document.getElementById('marketplace-modal-status')),
    (modalContentEl = document.getElementById('marketplace-modal-content')),
    (modalInstallBtn = document.getElementById('marketplace-modal-install')),
    (modalCloseBtn = document.getElementById('marketplace-modal-close')),
    (_items = []),
    (_selectedItem = null),
    (_requestToken = 0),
    (_activeType = 'skills'),
    (_activeFilter = 'all'),
    (_activeSort = 'az'),
    (_loading = !1),
    (_nextPage = 1),
    (_hasMore = !1),
    (_total = 0),
    (_activeOrigin = ''),
    (_cardPool = createCardPool({
      container: gridEl,
      createCard: createCard,
      updateCard: updateCard,
      getKey: (item) => item.id,
    })),
    sentinelEl &&
      ((_observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          entry?.isIntersecting && !_loading && _hasMore && loadItems({ reset: !1 });
        },
        { rootMargin: '240px 0px' },
      )),
      _observer.observe(sentinelEl)));
  const onSearchInput = () => {
      (searchClearBtn?.classList.toggle('visible', (searchInput?.value.length ?? 0) > 0),
        refreshMarketplace());
    },
    onSearchClear = () => {
      (searchInput && (searchInput.value = ''),
        searchClearBtn?.classList.remove('visible'),
        refreshMarketplace(),
        searchInput?.focus());
    },
    onSortChange = () => {
      ((_activeSort = sortSelect?.value ?? 'az'), refreshMarketplace());
    },
    onTabClick = (event) => {
      const nextType = event.currentTarget?.dataset?.type;
      nextType && nextType !== _activeType && ((_activeType = nextType), refreshMarketplace());
    },
    onFilterClick = (event) => {
      const nextFilter = event.currentTarget?.dataset?.filter;
      nextFilter &&
        nextFilter !== _activeFilter &&
        ((_activeFilter = nextFilter), refreshMarketplace());
    },
    onModalClose = () => closeModal(),
    onModalBackdropClick = (event) => {
      event.target === modalBackdrop && closeModal();
    },
    onModalInstall = async () => {
      _selectedItem && (await installItem(_selectedItem));
    },
    onKeydown = (event) => {
      'Escape' === event.key && closeModal();
    };
  (searchInput?.addEventListener('input', onSearchInput),
    searchClearBtn?.addEventListener('click', onSearchClear),
    sortSelect?.addEventListener('change', onSortChange),
    tabButtons.forEach((button) => button.addEventListener('click', onTabClick)),
    filterButtons.forEach((button) => button.addEventListener('click', onFilterClick)),
    modalCloseBtn?.addEventListener('click', onModalClose),
    modalBackdrop?.addEventListener('click', onModalBackdropClick),
    modalInstallBtn?.addEventListener('click', onModalInstall),
    document.addEventListener('keydown', onKeydown));
  const configPromise = window.electronAPI?.invoke?.('marketplace-get-config');
  return (
    configPromise?.then((config) => {
      _origins = config?.origins ?? [];
    }),
    refreshMarketplace(),
    function () {
      (closeModal(),
        modalBackdrop?.remove(),
        _observer?.disconnect(),
        (_observer = null),
        _cardPool?.clear(),
        (_cardPool = null),
        searchInput?.removeEventListener('input', onSearchInput),
        searchClearBtn?.removeEventListener('click', onSearchClear),
        sortSelect?.removeEventListener('change', onSortChange),
        tabButtons.forEach((button) => button.removeEventListener('click', onTabClick)),
        filterButtons.forEach((button) => button.removeEventListener('click', onFilterClick)),
        modalCloseBtn?.removeEventListener('click', onModalClose),
        modalBackdrop?.removeEventListener('click', onModalBackdropClick),
        modalInstallBtn?.removeEventListener('click', onModalInstall),
        document.removeEventListener('keydown', onKeydown),
        (countEl = sourceEl = gridEl = loadingEl = loadingCopyEl = null),
        (errorEl = emptyEl = _emptyTitleEl = _emptyCopyEl = sentinelEl = null),
        (searchInput = searchClearBtn = sortSelect = null),
        (tabButtons = []),
        (filterButtons = []),
        (modalBackdrop = modalNameEl = modalMetaEl = modalIconEl = null),
        (modalVerifiedEl =
          modalStatusEl =
          modalContentEl =
          modalInstallBtn =
          modalCloseBtn =
            null));
    }
  );
}
