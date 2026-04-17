export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
export function renderMarkdownToHtml(raw = '') {
  let html = escapeHtml(
    String(raw)
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
      .trim(),
  );
  return (
    (html = html.replace(/```([\s\S]*?)```/g, (_match, inner) => {
      const newlineIndex = inner.indexOf('\n');
      return `</p><pre><code>${newlineIndex >= 0 ? inner.slice(newlineIndex + 1) : inner}</code></pre><p>`;
    })),
    (html = html.replace(/`([^`]+)`/g, '<code>$1</code>')),
    (html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')),
    (html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')),
    (html = html.replace(/^### (.+)$/gm, '</p><h3>$1</h3><p>')),
    (html = html.replace(/^## (.+)$/gm, '</p><h2>$1</h2><p>')),
    (html = html.replace(/^# (.+)$/gm, '</p><h1>$1</h1><p>')),
    (html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>')),
    (html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')),
    (html = `<p>${html}</p>`),
    (html = html.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')),
    (html = html.replace(/<p>\s*<\/p>/g, '').replace(/<p><br><\/p>/g, '')),
    html
  );
}
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
export function formatChatDate(date) {
  const diff = new Date() - date;
  return diff < 864e5
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : diff < 6048e5
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
export function getInitials(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0] ?? 'JO').slice(0, 2).toUpperCase();
}
export function formatTrigger(trigger) {
  if (!trigger) return '?';
  switch (trigger.type) {
    case 'on_startup':
      return '⚡ Startup';
    case 'interval':
      return `⏱ Every ${trigger.minutes}m`;
    case 'hourly':
      return '⏰ Hourly';
    case 'daily':
      return `🌅 Daily ${trigger.time ?? ''}`;
    case 'weekly':
      return `📅 ${capitalize(trigger.day ?? '')} ${trigger.time ?? ''}`;
    default:
      return trigger.type;
  }
}
export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso);
  return diff < 6e4
    ? 'just now'
    : diff < 36e5
      ? `${Math.floor(diff / 6e4)}m ago`
      : diff < 864e5
        ? `${Math.floor(diff / 36e5)}h ago`
        : new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export function fullDateTime(iso) {
  return iso
    ? new Date(iso).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';
}
export function sortModelsByRank(modelsArray) {
  return [...modelsArray].sort((l, r) => (l.rank ?? 999) - (r.rank ?? 999));
}
