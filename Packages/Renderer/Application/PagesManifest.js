let _pagesCache = null,
  _featurePages = [];
function normalizeFeaturePage(page = {}) {
  return page?.id
    ? 'function' == typeof page.load
      ? page
      : 'string' == typeof page.moduleUrl && page.moduleUrl
        ? { ...page, load: () => import(page.moduleUrl) }
        : null
    : null;
}
export function registerFeaturePages(pages = []) {
  _featurePages = pages.map(normalizeFeaturePage).filter(Boolean);
}
export async function discoverPages() {
  if (_pagesCache) return _pagesCache;
  const builtinPages = await (async function () {
      if (!window.electronAPI?.invoke) return [];
      const pages = await window.electronAPI.invoke('get-pages');
      return Array.isArray(pages)
        ? pages
            .filter((page) => page?.id && page?.moduleUrl)
            .map((page) => ({ ...page, load: () => import(page.moduleUrl), css: page.css ?? null }))
        : [];
    })(),
    byId = new Map();
  for (const page of [...builtinPages, ..._featurePages]) byId.set(page.id, page);
  return (
    (_pagesCache = [...byId.values()].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))),
    _pagesCache
  );
}
export function buildPagesMap() {
  const map = {},
    pages = _pagesCache ?? [];
  for (const page of pages) map[page.id] = { load: page.load, css: page.css };
  return map;
}
export function buildSidebarNav() {
  const pages = _pagesCache ?? [],
    top = [],
    bottom = [];
  for (const page of pages) {
    if (!1 === page.showInSidebar) continue;
    const item = { id: page.id, label: page.label, icon: page.icon };
    'bottom' === page.section ? bottom.push(item) : top.push(item);
  }
  const marketplaceIndex = top.findIndex((item) => 'marketplace' === item.id);
  if (-1 !== marketplaceIndex && marketplaceIndex !== top.length - 1) {
    const [marketplaceItem] = top.splice(marketplaceIndex, 1);
    top.push(marketplaceItem);
  }
  return { top: top, bottom: bottom };
}
