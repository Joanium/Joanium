// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Shared/Utils.js
//  Pure helper functions — no DOM, no state, no side effects.
//  Import freely from anywhere in the renderer.
// ─────────────────────────────────────────────

/** Escape a string for safe insertion into HTML. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

/**
 * Generate a unique ID with an optional prefix.
 * @param {string} [prefix='id']
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Format a Date object relative to now for the chat library.
 * @param {Date} date
 */
export function formatChatDate(date) {
  const now  = new Date();
  const diff = now - date;
  const DAY  = 86_400_000;
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  if (diff < DAY)       return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 7 * DAY)   return DAYS[date.getDay()];
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Capitalize the first letter of a string. */
export function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Get user initials (up to 2 chars) from a display name. */
export function getInitials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] ?? 'OW').slice(0, 2).toUpperCase();
}
