import { ACTION_META } from '../Config/Constants.js';

export function escapeHtml(v) {
    return String(v ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function generateId() {
    return `auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

export function formatTrigger(trigger) {
    if (!trigger) return 'Unknown trigger';
    switch (trigger.type) {
        case 'on_startup': return '⚡ On app startup';
        case 'interval': return `⏱️ Every ${trigger.minutes || 30} min`;
        case 'hourly': return '⏰ Every hour';
        case 'daily': return `🌅 Daily at ${trigger.time || '09:00'}`;
        case 'weekly': return `📅 ${capitalize(trigger.day || 'monday')}s at ${trigger.time || '09:00'}`;
        default: return trigger.type;
    }
}

export function formatActionsSummary(actions = []) {
    if (!actions.length) return 'No actions configured';
    const label = actions.length === 1 ? '1 action' : `${actions.length} actions`;
    const types = [...new Set(actions.map(action => {
        const meta = ACTION_META[action.type];
        const base = meta?.label || action.type;
        if (action.type === 'open_folder') return base + (action.openTerminal ? ' + terminal' : '');
        if (action.type === 'run_command') return base + (action.silent ? ' (silent)' : '');
        return base;
    }))];
    return `${label}: ${types.join(', ')}`;
}

export function formatLastRun(lastRun) {
    if (!lastRun) return '';
    const d = new Date(lastRun), now = new Date(), diff = now - d;
    const min = 60_000, hour = 3_600_000, day = 86_400_000;
    if (diff < min) return 'Last run: just now';
    if (diff < hour) return `Last run: ${Math.floor(diff / min)}m ago`;
    if (diff < day) return `Last run: ${Math.floor(diff / hour)}h ago`;
    return `Last run: ${d.toLocaleDateString()}`;
}
