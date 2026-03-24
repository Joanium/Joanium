// Romelson — Features/Chat/Executors/HackerNewsExecutor.js
import { safeJson } from './utils.js';

const HANDLED = new Set(['get_hacker_news']);

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => { }) {
    if (toolName !== 'get_hacker_news') throw new Error(`HackerNewsExecutor: unknown tool "${toolName}"`);

    const { count = 5, type = 'top' } = params;
    const max = Math.min(Math.max(count, 1), 15);

    const typeMap = {
        top: 'topstories',
        new: 'newstories',
        best: 'beststories',
        ask: 'askstories',
    };
    const endpoint = typeMap[type] ?? 'topstories';
    onStage(`🔶 Fetching ${type} Hacker News stories…`);

    // HN Firebase API — free, no key, no rate limit
    const ids = await safeJson(`https://hacker-news.firebaseio.com/v0/${endpoint}.json`);
    if (!Array.isArray(ids) || !ids.length) {
        return 'Could not fetch Hacker News stories right now. Try again later.';
    }

    const topIds = ids.slice(0, max);
    onStage(`📖 Loading ${topIds.length} stories…`);

    const stories = await Promise.all(
        topIds.map(id =>
            safeJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)
        )
    );

    const storyLines = stories.filter(Boolean).map((s, i) => {
        const points = s.score ? `⬆ ${s.score}` : '';
        const comments = s.descendants != null ? `💬 ${s.descendants}` : '';
        const by = s.by ? `by ${s.by}` : '';
        const time = s.time ? new Date(s.time * 1000).toLocaleDateString() : '';
        const url = s.url || `https://news.ycombinator.com/item?id=${s.id}`;
        const hnLink = `https://news.ycombinator.com/item?id=${s.id}`;

        return [
            `${i + 1}. **${s.title}**`,
            `   ${[points, comments, by, time].filter(Boolean).join(' · ')}`,
            `   🔗 ${url}`,
            s.url ? `   💬 ${hnLink}` : '',
        ].filter(Boolean).join('\n');
    }).join('\n\n');

    return [
        `🔶 Hacker News — ${type.charAt(0).toUpperCase() + type.slice(1)} Stories`,
        ``,
        storyLines,
        ``,
        `Source: Hacker News (news.ycombinator.com)`,
    ].join('\n');
}
