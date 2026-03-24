// Romelson — Features/Chat/Executors/PhotoExecutor.js
import { safeJson } from './utils.js';

const HANDLED = new Set(['search_photos']);

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => { }) {
    if (toolName !== 'search_photos') throw new Error(`PhotoExecutor: unknown tool "${toolName}"`);

    const { query, count = 5, orientation } = params;
    if (!query) throw new Error('Missing required param: query');

    let apiKey = '';
    try {
        const config = await window.electronAPI?.getFreeConnectorConfig?.('unsplash');
        apiKey = config?.credentials?.apiKey?.trim() ?? '';
    } catch { /* optional */ }

    if (!apiKey) {
        return [
            `Unsplash photo search requires an API key.`,
            ``,
            `To set up:`,
            `1. Go to unsplash.com/developers`,
            `2. Create a free account and register an app`,
            `3. Copy your Access Key`,
            `4. In Romelson: Settings → Connectors → Unsplash → Add key`,
            ``,
            `The free tier allows 50 requests/hour.`,
        ].join('\n');
    }

    onStage(`📷 Searching Unsplash for "${query}"…`);

    const perPage = Math.min(count, 10);
    const orientParam = orientation ? `&orientation=${orientation}` : '';
    const data = await safeJson(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}${orientParam}`,
        { headers: { Authorization: `Client-ID ${apiKey}` } }
    );

    if (!data.results?.length) {
        return `No photos found for "${query}" on Unsplash. Try different keywords.`;
    }

    const photos = data.results.map((p, i) => {
        const desc = p.description || p.alt_description || 'No description';
        return [
            `${i + 1}. ${desc}`,
            `   📸 By: ${p.user?.name ?? 'Unknown'} (@${p.user?.username ?? '?'})`,
            `   🔗 Full: ${p.urls?.full ?? p.links?.html}`,
            `   🖼️ Regular: ${p.urls?.regular}`,
            `   🔸 Thumb: ${p.urls?.thumb}`,
            `   ❤️ Likes: ${p.likes ?? 0} | 📐 ${p.width}×${p.height}`,
        ].join('\n');
    }).join('\n\n');

    return [
        `📷 Unsplash results for "${query}" (${data.total?.toLocaleString() ?? '?'} total):`,
        ``,
        photos,
        ``,
        `Source: Unsplash (unsplash.com)`,
    ].join('\n');
}