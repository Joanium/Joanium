export function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}
export function normalizeFileList(value) {
  const raw = Array.isArray(value) ? value : [value];
  return [...new Set(raw.map((entry) => String(entry ?? '').trim()).filter(Boolean))].slice(0, 12);
}
