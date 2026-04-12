export function cloneValue(value) {
  if (null == value || 'object' != typeof value) return value;
  if ('function' == typeof globalThis.structuredClone)
    try {
      return globalThis.structuredClone(value);
    } catch {}
  return JSON.parse(JSON.stringify(value));
}
export default cloneValue;
