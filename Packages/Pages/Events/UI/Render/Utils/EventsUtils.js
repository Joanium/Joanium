/** HTML-escape a value so it is safe to inject into innerHTML. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Human-readable relative time string (e.g. "3m ago", "just now"). */
export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso);
  const second = 1_000;
  const minute = 60 * second;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < 30 * second) return 'just now';
  if (diff < 2 * minute) return `${Math.floor(diff / second)}s ago`;
  if (diff < 2 * hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < 2 * day) return `${Math.floor(diff / hour)}h ago`;
  return new Date(iso).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Elapsed duration string for a currently-running job (e.g. "42s", "3m 15s"). */
export function runningDuration(startedAt) {
  if (!startedAt) return '';
  const seconds = Math.floor((Date.now() - new Date(startedAt)) / 1_000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** Full locale date+time string for title/detail views. */
export function fullDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Human-readable label for a trigger configuration object. */
export function triggerLabel(trigger) {
  if (!trigger) return '';
  switch (trigger.type) {
    case 'on_startup': return 'Startup';
    case 'interval': return `Every ${trigger.minutes}m`;
    case 'hourly': return 'Hourly';
    case 'daily': return `Daily ${trigger.time ?? ''}`.trim();
    case 'weekly': return `${trigger.day ?? ''} ${trigger.time ?? ''}`.trim();
    default: return trigger.type;
  }
}
