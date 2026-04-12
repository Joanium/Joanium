function assertNonEmptyString(value, label) {
  if ('string' != typeof value || !value.trim())
    throw new Error(`[Page] ${label} must be a non-empty string.`);
}
export function definePage(page = {}) {
  if (null == page || 'object' != typeof page || Array.isArray(page))
    throw new Error('[Page] Page definition must be an object.');
  const id = String(page.id ?? '').trim(),
    moduleUrl = String(page.moduleUrl ?? '').trim();
  return (
    assertNonEmptyString(id, 'Page id'),
    assertNonEmptyString(moduleUrl, 'Page moduleUrl'),
    Object.freeze({
      id: id,
      label: String(page.label ?? id).trim(),
      icon: String(page.icon ?? '').trim(),
      css: 'string' == typeof page.css && page.css.trim() ? page.css.trim() : null,
      order: Number.isFinite(page.order) ? page.order : 999,
      section: 'bottom' === page.section ? 'bottom' : 'top',
      showInSidebar: !1 !== page.showInSidebar,
      moduleUrl: moduleUrl,
    })
  );
}
export default definePage;
