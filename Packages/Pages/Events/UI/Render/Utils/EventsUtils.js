import { escapeHtml } from '../../../../../System/Utils.js';
export const esc = escapeHtml;
export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso);
  return diff < 3e4
    ? 'just now'
    : diff < 12e4
      ? `${Math.floor(diff / 1e3)}s ago`
      : diff < 72e5
        ? `${Math.floor(diff / 6e4)}m ago`
        : diff < 1728e5
          ? `${Math.floor(diff / 36e5)}h ago`
          : new Date(iso).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
}
export function runningDuration(startedAt) {
  if (!startedAt) return '';
  const seconds = Math.floor((Date.now() - new Date(startedAt)) / 1e3);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
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
export function triggerLabel(trigger) {
  if (!trigger) return '';
  if (trigger.label) return String(trigger.label);
  switch (trigger.type) {
    case 'on_startup':
      return 'Startup';
    case 'cron':
      return trigger.expression ? `Cron: ${trigger.expression}` : 'Scheduled';
    case 'interval':
      return `Every ${trigger.minutes}m`;
    case 'hourly':
      return 'Hourly';
    case 'daily':
      return `Daily ${trigger.time ?? ''}`.trim();
    case 'weekly':
      return `${trigger.day ?? ''} ${trigger.time ?? ''}`.trim();
    default:
      return trigger.type;
  }
}
