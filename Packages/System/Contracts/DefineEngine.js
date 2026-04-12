function assertNonEmptyString(value, label) {
  if ('string' != typeof value || !value.trim())
    throw new Error(`[Engine] ${label} must be a non-empty string.`);
}
function normalizeNeeds(needs = []) {
  if (!Array.isArray(needs)) throw new Error('[Engine] needs must be an array when provided.');
  return Object.freeze(
    needs.map((need, index) => (assertNonEmptyString(need, `Need at index ${index}`), need.trim())),
  );
}
function normalizeStorage(storage) {
  if (null == storage) return Object.freeze([]);
  const items = Array.isArray(storage) ? storage : [storage];
  return Object.freeze(
    items.map((item, index) => {
      if ('string' == typeof item) {
        const key = item.trim();
        return (
          assertNonEmptyString(key, `Storage key at index ${index}`),
          Object.freeze({ key: key })
        );
      }
      if (!item || 'object' != typeof item || Array.isArray(item))
        throw new Error(`[Engine] Storage descriptor at index ${index} must be an object.`);
      const key = String(item.key ?? item.id ?? '').trim();
      return (
        assertNonEmptyString(key, `Storage descriptor key at index ${index}`),
        Object.freeze({ ...item, key: key })
      );
    }),
  );
}
export function defineEngine(meta = {}) {
  if (null == meta || 'object' != typeof meta || Array.isArray(meta))
    throw new Error('[Engine] Engine metadata must be an object.');
  if ('function' != typeof meta.create)
    throw new Error('[Engine] Engine metadata must include a create(context) function.');
  const id = 'string' == typeof meta.id ? meta.id.trim() : '',
    provides = 'string' == typeof meta.provides ? meta.provides.trim() : '';
  return Object.freeze({
    ...meta,
    id: id,
    provides: provides,
    needs: normalizeNeeds(meta.needs),
    storage: normalizeStorage(meta.storage),
    create: meta.create,
  });
}
export default defineEngine;
